package main

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

func (s *testServer) inlayHints(t *testing.T, documentURI uri.URI, rng protocol.Range) []protocol.InlayHint {
	t.Helper()
	hints, err := s.server.InlayHint(context.Background(), &protocol.InlayHintParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
		Range:        rng,
	})
	if err != nil {
		t.Fatalf("inlayHint: %v", err)
	}
	return hints
}

func hintLabels(hints []protocol.InlayHint) []string {
	var out []string
	for _, hint := range hints {
		label, ok := hint.Label.(protocol.String)
		if !ok {
			out = append(out, "")
			continue
		}
		out = append(out, string(label))
	}
	return out
}

func wholeDocument() protocol.Range {
	return protocol.Range{
		Start: protocol.Position{Line: 0, Character: 0},
		End:   protocol.Position{Line: 1000, Character: 0},
	}
}

func TestVarsInlayHintShowsValue(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\nWelcome to {vars.project.name} at {vars.site.url}.\n")
	hints := s.inlayHints(t, documentURI, wholeDocument())
	if labels := hintLabels(hints); len(labels) != 2 || labels[0] != "Portosaur" || labels[1] != "https://example.com" {
		t.Fatalf("inlay hints = %v, want [Portosaur https://example.com]", labels)
	}
	// Each hint sits right after its reference's closing brace.
	if hints[0].Position != (protocol.Position{Line: 2, Character: 30}) {
		t.Fatalf("first hint position = %+v, want line 2 character 30", hints[0].Position)
	}
	if hints[1].Position != (protocol.Position{Line: 2, Character: 49}) {
		t.Fatalf("second hint position = %+v, want line 2 character 49", hints[1].Position)
	}
	if hints[0].PaddingLeft == nil || !*hints[0].PaddingLeft {
		t.Fatal("first hint has no left padding")
	}
}

func TestVarsInlayHintSkipsUnknownAndNonScalar(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.nope} and {vars.project} and {vars.project.name}\n")
	hints := s.inlayHints(t, documentURI, wholeDocument())
	if labels := hintLabels(hints); len(labels) != 1 || labels[0] != "Portosaur" {
		t.Fatalf("inlay hints = %v, want only Portosaur", labels)
	}
}

func TestVarsInlayHintSkipsEscape(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{{vars.project.name}}\n")
	hints := s.inlayHints(t, documentURI, wholeDocument())
	if len(hints) != 0 {
		t.Fatalf("inlay hints = %v, want none for the escape form", hintLabels(hints))
	}
}

func TestVarsInlayHintRespectsRange(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.project.name}\n\n{vars.site.url}\n")
	rng := protocol.Range{
		Start: protocol.Position{Line: 4, Character: 0},
		End:   protocol.Position{Line: 4, Character: 20},
	}
	hints := s.inlayHints(t, documentURI, rng)
	if labels := hintLabels(hints); len(labels) != 1 || labels[0] != "https://example.com" {
		t.Fatalf("inlay hints = %v, want only the site url", labels)
	}
}

func TestVarsHoverDescription(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\nWelcome to {vars.project.name}.\n")
	content := s.hover(t, documentURI, 2, 15)
	if content == nil {
		t.Fatal("no hover for a {vars.} reference")
	}
	for _, want := range []string{"{vars.project.name}", "vars:", "porto.yml"} {
		if !strings.Contains(content.Value, want) {
			t.Fatalf("hover = %q, want it to mention %q", content.Value, want)
		}
	}
	if strings.Contains(content.Value, "Portosaur") {
		t.Fatalf("hover = %q, want no value in the hover (it shows inline)", content.Value)
	}
	if strings.Contains(content.Value, "string") {
		t.Fatalf("hover = %q, want no type in the hover", content.Value)
	}
}

func TestVarsHoverUnknownKeyIsEmpty(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.nope} here.\n")
	if content := s.hover(t, documentURI, 2, 4); content != nil {
		t.Fatalf("hover for an unknown key = %q, want nil", content.Value)
	}
}

func TestVarsHoverPlainTextIsEmpty(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\nJust some words.\n")
	if content := s.hover(t, documentURI, 2, 5); content != nil {
		t.Fatalf("hover on plain text = %q, want nil", content.Value)
	}
}
