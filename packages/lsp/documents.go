package main

import (
	"sync"

	"go.lsp.dev/uri"
)

// The open documents, kept in full: the server syncs with full
// text on every change, so the store is just URI -> text.
type documentStore struct {
	mu   sync.RWMutex
	docs map[uri.URI]string
}

func newDocumentStore() *documentStore {
	return &documentStore{docs: map[uri.URI]string{}}
}

func (s *documentStore) open(uri uri.URI, text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.docs[uri] = text
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
	s.mu.RLock()
	defer s.mu.RUnlock()
	text, ok := s.docs[uri]
	return text, ok
}
