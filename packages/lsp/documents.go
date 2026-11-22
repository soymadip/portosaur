package main

import (
	"strings"
	"sync"
	"time"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// The open documents, kept in full: the server syncs with full
// text on every change, so the store is just URI -> text.
//
// The library releases every request for concurrent handling as
// soon as it arrives, so a completion can start before the
// didOpen ahead of it on the wire has stored the document — the
// two handlers race through the decode step. waitFor closes
// that gap: the open is already in flight, so a short wait for
// the document to appear is enough. The same race applies to a
// didChange: a request sent right after a keystroke can run
// before the change ahead of it lands, and then it answers from
// the stale text. waitForPosition closes that gap too: a
// request's position always exists in the text the client
// holds, so a stored text that does not cover it must be stale.
type documentStore struct {
	mu   sync.Mutex
	cond *sync.Cond
	docs map[uri.URI]string
}

func newDocumentStore() *documentStore {
	s := &documentStore{docs: map[uri.URI]string{}}
	s.cond = sync.NewCond(&s.mu)
	return s
}

func (s *documentStore) open(uri uri.URI, text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.docs[uri] = text
	s.cond.Broadcast()
}

func (s *documentStore) change(uri uri.URI, text string) {
	s.open(uri, text)
}

func (s *documentStore) close(uri uri.URI) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.docs, uri)
}

func (s *documentStore) get(uri uri.URI) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	text, ok := s.docs[uri]
	return text, ok
}

// waitFor returns the document's text, waiting up to the timeout
// for it to appear. A document that never appears (a client
// asking about a file it never opened) returns false when the
// timeout elapses. It is waitForPosition for the zero position,
// which exists in any stored text.
func (s *documentStore) waitFor(uri uri.URI, timeout time.Duration) (string, bool) {
	return s.waitForPosition(uri, protocol.Position{}, timeout)
}

// waitForPosition returns the document's text, waiting up to the
// timeout for a text that covers pos. The didChange carrying the
// newer text is already in flight when the position is beyond
// the stored text, and the change lands in the store before the
// didChange handler does anything slower, so the wait is short
// in practice and the normal path (a position the stored text
// already covers) returns at once. When nothing newer arrives
// in time, the latest text there is wins, so a genuinely
// out-of-range position still answers instead of hanging.
func (s *documentStore) waitForPosition(uri uri.URI, pos protocol.Position, timeout time.Duration) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	timer := time.AfterFunc(timeout, func() {
		s.mu.Lock()
		s.cond.Broadcast()
		s.mu.Unlock()
	})
	defer timer.Stop()
	deadline := time.Now().Add(timeout)
	for {
		if text, ok := s.docs[uri]; ok && positionInText(text, pos) {
			return text, true
		}
		if time.Now().After(deadline) {
			text, ok := s.docs[uri]
			return text, ok
		}
		s.cond.Wait()
	}
}

// positionInText reports whether pos exists in text: its line is
// within the document and its character is within that line.
// The character is in UTF-16 code units and the line length is
// in bytes, and a UTF-16 length never exceeds the byte length,
// so a character past the byte length is certainly past the
// line.
func positionInText(text string, pos protocol.Position) bool {
	lines := strings.Split(text, "\n")
	if int(pos.Line) >= len(lines) {
		return false
	}
	return int(pos.Character) <= len(lines[pos.Line])
}
