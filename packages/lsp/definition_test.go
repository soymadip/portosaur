package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// definition sends a textDocument/definition request and returns
// the locations, or nil when there is no definition.
func (s *testServer) definition(t *testing.T, documentURI uri.URI, line, character uint32) []protocol.Location {
	t.Helper()
	result, err := s.server.Definition(context.Background(), &protocol.DefinitionParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
			Position:     protocol.Position{Line: line, Character: character},
		},
	})
	if err != nil {
		t.Fatalf("definition: %v", err)
	}
	switch locations := result.(type) {
	case nil:
		return nil
	case protocol.LocationSlice:
		return []protocol.Location(locations)
	case *protocol.Location:
		return []protocol.Location{*locations}
	default:
		t.Fatalf("definition result is %T, want a location", result)
		return nil
	}
}

// contentFixture builds a project with porto.yml config and the
// given content files on disk (relative path -> contents).
func contentFixture(t *testing.T, config string, files map[string]string) string {
	t.Helper()
	root := fixtureProject(t)
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(config), 0o644); err != nil {
		t.Fatal(err)
	}
	for rel, content := range files {
		path := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

// docsFixture is a docs-mode project: a numbered getting-started
// section, a sibling page, and a blog post.
func docsFixture(t *testing.T) string {
	t.Helper()
	return contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/1 - getting-started/2 - installation.mdx": "# Installation\n\n## Setup\n\nSome text.\n",
		"docs/1 - getting-started/index.mdx":            "# Getting Started\n",
		"docs/sibling.mdx":                              "# Sibling\n",
		"docs/my page.mdx":                              "# My Page\n",
		"blog/first-post.mdx":                           "# First Post\n",
	})
}

func TestDefinitionCleanURL(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install](/docs/getting-started/installation/)\n")
	locations := s.definition(t, documentURI, 2, 20)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "2 - installation.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
	if locations[0].Range.Start.Line != 0 {
		t.Fatalf("definition line = %d, want 0", locations[0].Range.Start.Line)
	}
}

func TestDefinitionCleanURLNoTrailingSlash(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install](/docs/getting-started/installation)\n")
	locations := s.definition(t, documentURI, 2, 20)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
}

func TestDefinitionSectionIndex(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[gs](/docs/getting-started/)\n")
	locations := s.definition(t, documentURI, 2, 12)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "index.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
}

func TestDefinitionBlogURL(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[post](/blog/first-post/)\n")
	locations := s.definition(t, documentURI, 2, 12)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "blog", "first-post.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
}

func TestDefinitionHashJumpsToHeading(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[setup](/docs/getting-started/installation/#setup)\n")
	locations := s.definition(t, documentURI, 2, 30)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	if locations[0].Range.Start.Line != 2 {
		t.Fatalf("definition line = %d, want 2 (the Setup heading)", locations[0].Range.Start.Line)
	}
}

func TestDefinitionUnknownHashJumpsToTop(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[setup](/docs/getting-started/installation/#nope)\n")
	locations := s.definition(t, documentURI, 2, 30)
	if len(locations) != 1 || locations[0].Range.Start.Line != 0 {
		t.Fatalf("definition = %v, want the file top", locations)
	}
}

func TestDefinitionSameFileHash(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[here](#details)\n\n## Details\n")
	locations := s.definition(t, documentURI, 2, 10)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	if locations[0].URI != documentURI {
		t.Fatalf("definition URI = %v, want the same file", locations[0].URI)
	}
	if locations[0].Range.Start.Line != 4 {
		t.Fatalf("definition line = %d, want 4 (the Details heading)", locations[0].Range.Start.Line)
	}
}

func TestDefinitionRelativePath(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[sib](./sibling.mdx)\n\n[up](../docs/sibling.mdx)\n")
	locations := s.definition(t, documentURI, 2, 10)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "docs", "sibling.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
	locations = s.definition(t, documentURI, 4, 10)
	if len(locations) != 1 || locations[0].URI != want {
		t.Fatalf("definition for ../docs/sibling.mdx = %v, want %v", locations, want)
	}
}

func TestDefinitionRelativePathEncoded(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[mp](./my%20page.mdx)\n")
	locations := s.definition(t, documentURI, 2, 10)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "docs", "my page.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
}

func TestDefinitionJSXLink(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n<Link href=\"/docs/getting-started/installation/\">x</Link>\n\n<Btn href=\"./sibling.mdx\">x</Btn>\n")
	locations := s.definition(t, documentURI, 2, 20)
	if len(locations) != 1 {
		t.Fatalf("definition for Link href = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "2 - installation.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
	locations = s.definition(t, documentURI, 4, 15)
	if len(locations) != 1 {
		t.Fatalf("definition for Btn href = %v, want one location", locations)
	}
	want = uri.File(filepath.Join(s.root, "docs", "sibling.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
}

func TestDefinitionExternalIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](https://example.com/page)\n\n[y](/docs/no-such-page/)\n\n[z](./missing.mdx)\n")
	for _, line := range []uint32{2, 4, 6} {
		if locations := s.definition(t, documentURI, line, 10); len(locations) != 0 {
			t.Fatalf("definition on line %d = %v, want none", line, locations)
		}
	}
}

func TestDefinitionNotOnLinkIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\nJust some text here.\n")
	if locations := s.definition(t, documentURI, 2, 8); len(locations) != 0 {
		t.Fatalf("definition = %v, want none", locations)
	}
}

func TestDefinitionSlugOverride(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/old-name.mdx": "# Old\n",
		"docs/renamed.mdx":  "---\nslug: /custom-path\n---\n# Renamed\n",
	})
	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[r](/docs/custom-path/)\n")
	locations := s.definition(t, documentURI, 2, 10)
	if len(locations) != 1 {
		t.Fatalf("definition = %v, want one location", locations)
	}
	want := uri.File(filepath.Join(s.root, "docs", "renamed.mdx"))
	if locations[0].URI != want {
		t.Fatalf("definition URI = %v, want %v", locations[0].URI, want)
	}
}

func TestDefinitionPortfolioModeUsesNotes(t *testing.T) {
	root := contentFixture(t, "", map[string]string{
		"notes/first-note.mdx": "# First Note\n",
		"docs/ignored.mdx":     "# Ignored\n",
	})
	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "notes", "page.mdx"), "# Page\n\n[n](/notes/first-note/)\n\n[i](/docs/ignored/)\n")
	locations := s.definition(t, documentURI, 2, 10)
	if len(locations) != 1 {
		t.Fatalf("definition for /notes/first-note/ = %v, want one location", locations)
	}
	if locations := s.definition(t, documentURI, 4, 10); len(locations) != 0 {
		t.Fatalf("definition for /docs/ignored/ = %v, want none (portfolio mode reads notes, not docs)", locations)
	}
}

func TestPageIndexInvalidatesOnOpen(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[n](/docs/new-page/)\n")
	if locations := s.definition(t, documentURI, 2, 10); len(locations) != 0 {
		t.Fatalf("definition before the page exists = %v, want none", locations)
	}
	// The page appears on disk and is opened: the index
	// invalidates and the link resolves.
	newPage := filepath.Join(s.root, "docs", "new-page.mdx")
	if err := os.WriteFile(newPage, []byte("# New Page\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	s.open(t, newPage, "# New Page\n")
	locations := s.definition(t, documentURI, 2, 10)
	if len(locations) != 1 {
		t.Fatalf("definition after the page appears = %v, want one location", locations)
	}
}
