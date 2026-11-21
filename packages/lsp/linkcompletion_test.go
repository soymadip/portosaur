package main

import (
	"path/filepath"
	"testing"
)

func TestLinkCompletionPageURLs(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](")
	items := s.complete(t, documentURI, 2, 4)
	// The fixture has 5 pages: installation, getting-started,
	// sibling, my page, first-post.
	if len(items) != 5 {
		t.Fatalf("completions = %v, want 5 pages", labels(items))
	}
	for _, want := range []string{"/docs/getting-started/installation/", "/docs/getting-started/", "/docs/sibling/", "/docs/my-page/", "/blog/first-post/"} {
		if !hasLabel(items, want) {
			t.Fatalf("completions = %v, missing %q", labels(items), want)
		}
	}
	if text, ok := editText(items, "/docs/sibling/"); !ok || text != "/docs/sibling/" {
		t.Fatalf("sibling edit = %q, want the clean URL", text)
	}
}

func TestLinkCompletionFiltersByPrefix(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](/docs/getting-started/")
	items := s.complete(t, documentURI, 2, 26)
	if len(items) != 2 || !hasLabel(items, "/docs/getting-started/") || !hasLabel(items, "/docs/getting-started/installation/") {
		t.Fatalf("completions = %v, want the two getting-started URLs", labels(items))
	}
}

func TestLinkCompletionJSXTo(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n<Link to=\"/blog/")
	items := s.complete(t, documentURI, 2, 16)
	if len(items) != 1 || items[0].Label != "/blog/first-post/" {
		t.Fatalf("completions = %v, want only /blog/first-post/", labels(items))
	}
}

func TestLinkCompletionHeadings(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](/docs/getting-started/installation/#")
	items := s.complete(t, documentURI, 2, 40)
	if len(items) != 2 || !hasLabel(items, "installation") || !hasLabel(items, "setup") {
		t.Fatalf("completions = %v, want the installation page's heading ids", labels(items))
	}
	if text, ok := editText(items, "setup"); !ok || text != "setup" {
		t.Fatalf("setup edit = %q, want only the id (the # stays)", text)
	}
}

func TestLinkCompletionHeadingsFilter(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](/docs/getting-started/installation/#se")
	items := s.complete(t, documentURI, 2, 42)
	if len(items) != 1 || items[0].Label != "setup" {
		t.Fatalf("completions = %v, want only setup", labels(items))
	}
}

func TestLinkCompletionSameFileHeadings(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](#\n\n## Details\n")
	items := s.complete(t, documentURI, 2, 5)
	if len(items) != 2 || !hasLabel(items, "page") || !hasLabel(items, "details") {
		t.Fatalf("completions = %v, want the current file's heading ids", labels(items))
	}
}

func TestLinkCompletionUnknownPageHeadingsIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](/docs/nope/#")
	items := s.complete(t, documentURI, 2, 16)
	if len(items) != 0 {
		t.Fatalf("completions = %v, want none", labels(items))
	}
}

func TestLinkCompletionDotOffersNavigation(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](.")
	items := s.complete(t, documentURI, 2, 5)
	if len(items) != 2 || !hasLabel(items, "./") || !hasLabel(items, "../") {
		t.Fatalf("completions = %v, want ./ and ../", labels(items))
	}
	documentURI = s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](..")
	items = s.complete(t, documentURI, 2, 6)
	if len(items) != 1 || items[0].Label != "../" {
		t.Fatalf("completions = %v, want only ../", labels(items))
	}
}

func TestLinkCompletionRelativeFiles(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](./")
	items := s.complete(t, documentURI, 2, 6)
	if !hasLabel(items, "./sibling.mdx") || !hasLabel(items, "./my%20page.mdx") {
		t.Fatalf("completions = %v, want the sibling files (%%20-encoded)", labels(items))
	}
	if !hasLabel(items, "./1%20-%20getting-started/") {
		t.Fatalf("completions = %v, want the getting-started directory (%%20-encoded)", labels(items))
	}
	if hasLabel(items, "./page.mdx") {
		t.Fatalf("completions = %v, include the unsaved page itself (not on disk)", labels(items))
	}
}

func TestLinkCompletionRelativeFilter(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](./sib")
	items := s.complete(t, documentURI, 2, 9)
	if len(items) != 1 || items[0].Label != "./sibling.mdx" {
		t.Fatalf("completions = %v, want only ./sibling.mdx", labels(items))
	}
}

func TestLinkCompletionRelativeParent(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "1 - getting-started", "page.mdx"), "# Page\n\n[x](../")
	items := s.complete(t, documentURI, 2, 7)
	if !hasLabel(items, "../sibling.mdx") {
		t.Fatalf("completions = %v, want ../sibling.mdx", labels(items))
	}
	if !hasLabel(items, "../my%20page.mdx") {
		t.Fatalf("completions = %v, want ../my%%20page.mdx", labels(items))
	}
}

func TestLinkCompletionRelativeSkipsNonContent(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/page.mdx":   "# Page\n",
		"other/stray.mdx": "# Stray\n",
	})
	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](../")
	items := s.complete(t, documentURI, 2, 7)
	if hasLabel(items, "../other/") {
		t.Fatalf("completions = %v, include ../other/ (not a content dir)", labels(items))
	}
}
