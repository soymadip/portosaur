package main

import (
	"sync"
	"time"

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
// the document to appear is enough.
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
// timeout elapses.
func (s *documentStore) waitFor(uri uri.URI, timeout time.Duration) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if text, ok := s.docs[uri]; ok {
		return text, true
	}
	timer := time.AfterFunc(timeout, func() {
		s.mu.Lock()
		s.cond.Broadcast()
		s.mu.Unlock()
	})
	defer timer.Stop()
	deadline := time.Now().Add(timeout)
	for {
		if text, ok := s.docs[uri]; ok {
			return text, true
		}
		if time.Now().After(deadline) {
			return "", false
		}
		s.cond.Wait()
	}
}
