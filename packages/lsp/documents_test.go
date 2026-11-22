package main

import (
	"testing"
	"time"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

func TestPositionInText(t *testing.T) {
	cases := []struct {
		name string
		text string
		pos  protocol.Position
		want bool
	}{
		{"start of empty doc", "", protocol.Position{Line: 0, Character: 0}, true},
		{"past the only line", "", protocol.Position{Line: 1, Character: 0}, false},
		{"end of first line", "ab\ncd", protocol.Position{Line: 0, Character: 2}, true},
		{"past end of first line", "ab\ncd", protocol.Position{Line: 0, Character: 3}, false},
		{"start of second line", "ab\ncd", protocol.Position{Line: 1, Character: 0}, true},
		{"past last line", "ab\ncd", protocol.Position{Line: 2, Character: 0}, false},
		{"trailing newline makes an empty last line", "ab\n", protocol.Position{Line: 1, Character: 0}, true},
	}
	for _, tc := range cases {
		if got := positionInText(tc.text, tc.pos); got != tc.want {
			t.Errorf("%s: positionInText(%q, %+v) = %v, want %v", tc.name, tc.text, tc.pos, got, tc.want)
		}
	}
}

func TestWaitForPositionCoveredReturnsAtOnce(t *testing.T) {
	s := newDocumentStore()
	documentURI := uri.File("/docs/page.mdx")
	s.open(documentURI, "# Page\n\ntext\n")
	start := time.Now()
	text, ok := s.waitForPosition(documentURI, protocol.Position{Line: 2, Character: 1}, 100*time.Millisecond)
	if !ok || text != "# Page\n\ntext\n" {
		t.Fatalf("waitForPosition = %q, %v, want the stored text", text, ok)
	}
	if elapsed := time.Since(start); elapsed > 50*time.Millisecond {
		t.Fatalf("waitForPosition took %v for a covered position, want an immediate return", elapsed)
	}
}

func TestWaitForPositionWaitsForChange(t *testing.T) {
	s := newDocumentStore()
	documentURI := uri.File("/docs/page.mdx")
	s.open(documentURI, "# Page\n")
	go func() {
		time.Sleep(20 * time.Millisecond)
		s.change(documentURI, "# Page\n\n<")
	}()
	text, ok := s.waitForPosition(documentURI, protocol.Position{Line: 2, Character: 1}, 100*time.Millisecond)
	if !ok || text != "# Page\n\n<" {
		t.Fatalf("waitForPosition = %q, %v, want the changed text", text, ok)
	}
}

func TestWaitForPositionTimesOutWithStaleText(t *testing.T) {
	s := newDocumentStore()
	documentURI := uri.File("/docs/page.mdx")
	s.open(documentURI, "# Page\n")
	text, ok := s.waitForPosition(documentURI, protocol.Position{Line: 2, Character: 1}, 50*time.Millisecond)
	if !ok || text != "# Page\n" {
		t.Fatalf("waitForPosition = %q, %v, want the stale text and true", text, ok)
	}
}

func TestWaitForPositionMissingDoc(t *testing.T) {
	s := newDocumentStore()
	_, ok := s.waitForPosition(uri.File("/docs/missing.mdx"), protocol.Position{}, 50*time.Millisecond)
	if ok {
		t.Fatal("waitForPosition on a missing document returned true")
	}
}
