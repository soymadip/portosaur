package main

import (
	"context"
	"path/filepath"
	"testing"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// symbols sends a textDocument/documentSymbol request and
// returns the top-level symbols, or nil when there are none.
func (s *testServer) symbols(t *testing.T, documentURI uri.URI) []protocol.DocumentSymbol {
	t.Helper()
	result, err := s.server.DocumentSymbol(context.Background(), &protocol.DocumentSymbolParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
	})
	if err != nil {
		t.Fatalf("documentSymbol: %v", err)
	}
	switch symbols := result.(type) {
	case nil:
		return nil
	case protocol.DocumentSymbolSlice:
		return []protocol.DocumentSymbol(symbols)
	default:
		t.Fatalf("documentSymbol result is %T, want a document symbol slice", result)
		return nil
	}
}

func symbolNames(symbols []protocol.DocumentSymbol) []string {
	var out []string
	for _, symbol := range symbols {
		out = append(out, symbol.Name)
	}
	return out
}

func TestDocumentSymbolsOutline(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: Guide\ndraft: false\n---\n# Top\n\n## First\n\n### Deep\n\n## Second\n\n# Another\n")
	symbols := s.symbols(t, documentURI)
	if len(symbols) != 3 {
		t.Fatalf("top-level symbols = %v, want Frontmatter, Top, Another", symbolNames(symbols))
	}
	frontmatter := symbols[0]
	if frontmatter.Name != "Frontmatter" || frontmatter.Kind != protocol.SymbolKindObject {
		t.Fatalf("first symbol = %+v, want the Frontmatter object", frontmatter)
	}
	if len(frontmatter.Children) != 2 || frontmatter.Children[0].Name != "title" || frontmatter.Children[1].Name != "draft" {
		t.Fatalf("frontmatter children = %v, want title and draft", symbolNames(frontmatter.Children))
	}
	if frontmatter.Children[0].Kind != protocol.SymbolKindProperty {
		t.Fatalf("title kind = %v, want property", frontmatter.Children[0].Kind)
	}
	if frontmatter.Children[0].Detail == nil || *frontmatter.Children[0].Detail != "Guide" {
		t.Fatalf("title detail = %v, want Guide", frontmatter.Children[0].Detail)
	}
	if frontmatter.Range.Start.Line != 0 || frontmatter.Range.End.Line != 3 {
		t.Fatalf("frontmatter range = %+v, want lines 0-3", frontmatter.Range)
	}
	top := symbols[1]
	if top.Name != "Top" || top.Kind != protocol.SymbolKindString {
		t.Fatalf("second symbol = %+v, want the Top heading", top)
	}
	if top.Detail == nil || *top.Detail != "#top" {
		t.Fatalf("Top detail = %v, want #top", top.Detail)
	}
	if len(top.Children) != 2 || top.Children[0].Name != "First" || top.Children[1].Name != "Second" {
		t.Fatalf("Top children = %v, want First and Second", symbolNames(top.Children))
	}
	if len(top.Children[0].Children) != 1 || top.Children[0].Children[0].Name != "Deep" {
		t.Fatalf("First children = %v, want Deep", symbolNames(top.Children[0].Children))
	}
	if symbols[2].Name != "Another" || len(symbols[2].Children) != 0 {
		t.Fatalf("third symbol = %+v, want the Another heading with no children", symbols[2])
	}
}

func TestDocumentSymbolsHeadingRanges(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Top\n\nText.\n\n## Child\n\nMore.\n")
	symbols := s.symbols(t, documentURI)
	if len(symbols) != 1 {
		t.Fatalf("symbols = %v, want only Top", symbolNames(symbols))
	}
	top := symbols[0]
	if top.Range.Start.Line != 0 || top.Range.End.Line != 6 {
		t.Fatalf("Top range = %+v, want lines 0-6 (the whole section)", top.Range)
	}
	if top.SelectionRange.Start.Line != 0 || top.SelectionRange.Start.Character != 2 || top.SelectionRange.End.Character != 5 {
		t.Fatalf("Top selection range = %+v, want the text Top (characters 2-5)", top.SelectionRange)
	}
	child := top.Children[0]
	if child.Range.Start.Line != 4 || child.Range.End.Line != 6 {
		t.Fatalf("Child range = %+v, want lines 4-6", child.Range)
	}
	if child.SelectionRange.Start.Character != 3 || child.SelectionRange.End.Character != 8 {
		t.Fatalf("Child selection range = %+v, want the text Child (characters 3-8)", child.SelectionRange)
	}
}

func TestDocumentSymbolsNoFrontmatter(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Only\n")
	symbols := s.symbols(t, documentURI)
	if len(symbols) != 1 || symbols[0].Name != "Only" {
		t.Fatalf("symbols = %v, want only Only", symbolNames(symbols))
	}
}

func TestDocumentSymbolsSkipsCode(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Real\n\n```\n# Not a heading\n```\n\n## Also Real\n")
	symbols := s.symbols(t, documentURI)
	if len(symbols) != 1 || len(symbols[0].Children) != 1 {
		t.Fatalf("symbols = %+v, want Real with one child", symbols)
	}
}

func TestDocumentSymbolsEmptyDocument(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Just prose, no headings.\n")
	if symbols := s.symbols(t, documentURI); len(symbols) != 0 {
		t.Fatalf("symbols = %v, want none", symbolNames(symbols))
	}
}

func TestDocumentSymbolsNonMDXIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "other.yaml"), "# Not MDX\n")
	if symbols := s.symbols(t, documentURI); len(symbols) != 0 {
		t.Fatalf("symbols = %v, want none", symbolNames(symbols))
	}
}
