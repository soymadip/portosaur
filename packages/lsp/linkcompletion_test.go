package main

import (
	"path/filepath"
	"testing"

	"go.lsp.dev/protocol"
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

func TestLinkCompletionJSXProp(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n<Link href=\"/blog/")
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

func TestLinkCompletionSameFileHeadingsCustomID(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](#\n\n## Details [#info]\n")
	items := s.complete(t, documentURI, 2, 5)
	if len(items) != 2 || !hasLabel(items, "page") || !hasLabel(items, "info") {
		t.Fatalf("completions = %v, want page and the custom id info", labels(items))
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

func TestLinkCompletionRelativeAngledIsLiteral(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](<./>)")
	items := s.complete(t, documentURI, 2, 7)
	if !hasLabel(items, "./my page.mdx") {
		t.Fatalf("completions = %v, want ./my page.mdx (literal spaces)", labels(items))
	}
	if text, ok := editText(items, "./my page.mdx"); !ok || text != "./my page.mdx" {
		t.Fatalf("my page edit = %q, want the literal insert", text)
	}
	if !hasLabel(items, "./1 - getting-started/") {
		t.Fatalf("completions = %v, want ./1 - getting-started/ (literal, with trailing /)", labels(items))
	}
	if hasLabel(items, "./my%20page.mdx") {
		t.Fatalf("completions = %v, include the %%20 form in an angled destination", labels(items))
	}
}

func TestLinkCompletionRelativeJSXIsLiteral(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n<Link href=\"./")
	items := s.complete(t, documentURI, 2, 14)
	if !hasLabel(items, "./my page.mdx") {
		t.Fatalf("completions = %v, want ./my page.mdx (literal spaces)", labels(items))
	}
	if text, ok := editText(items, "./my page.mdx"); !ok || text != "./my page.mdx" {
		t.Fatalf("my page edit = %q, want the literal insert", text)
	}
	if hasLabel(items, "./my%20page.mdx") {
		t.Fatalf("completions = %v, include the %%20 form in a Link prop", labels(items))
	}
}

func TestLinkCompletionRelativePlainIsEncoded(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](./")
	items := s.complete(t, documentURI, 2, 6)
	if text, ok := editText(items, "./my%20page.mdx"); !ok || text != "./my%20page.mdx" {
		t.Fatalf("my page edit = %q, want the %%20-encoded insert", text)
	}
	if hasLabel(items, "./my page.mdx") {
		t.Fatalf("completions = %v, include the literal form in a plain destination", labels(items))
	}
}

func TestLinkCompletionRelativeUnclosedAngledIsLiteral(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](<./")
	items := s.complete(t, documentURI, 2, 7)
	if !hasLabel(items, "./my page.mdx") {
		t.Fatalf("completions = %v, want ./my page.mdx (literal spaces)", labels(items))
	}
	if text, ok := editText(items, "./my page.mdx"); !ok || text != "./my page.mdx" {
		t.Fatalf("my page edit = %q, want the literal insert", text)
	}
	if hasLabel(items, "./my%20page.mdx") {
		t.Fatalf("completions = %v, include the %%20 form in an unclosed angled destination", labels(items))
	}
}

func TestLinkCompletionRelativeUnclosedAngledFilters(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](<./my")
	items := s.complete(t, documentURI, 2, 9)
	if len(items) != 1 || items[0].Label != "./my page.mdx" {
		t.Fatalf("completions = %v, want only ./my page.mdx", labels(items))
	}
}

func TestLinkCompletionUnclosedAngledEmptyOffersPageURLs(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](<")
	items := s.complete(t, documentURI, 2, 5)
	// The fixture has 5 pages: installation, getting-started,
	// sibling, my page, first-post.
	if len(items) != 5 {
		t.Fatalf("completions = %v, want 5 pages", labels(items))
	}
	if !hasLabel(items, "/docs/sibling/") {
		t.Fatalf("completions = %v, missing /docs/sibling/", labels(items))
	}
	if text, ok := editText(items, "/docs/sibling/"); !ok || text != "/docs/sibling/" {
		t.Fatalf("sibling edit = %q, want the clean URL", text)
	}
}

func TestRefLabelCompletion(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n[install]: /docs/getting-started/installation/\n[guide]: /docs/getting-started/\n\nSee [the guide]["
	items := s.complete(t, s.open(t, filepath.Join(s.root, "docs", "page.mdx"), doc), 5, 16)
	if len(items) != 2 || !hasLabel(items, "install") || !hasLabel(items, "guide") {
		t.Fatalf("completions = %v, want the two defined labels", labels(items))
	}
	if items[0].Kind != protocol.CompletionItemKindReference {
		t.Fatalf("kind = %v, want Reference", items[0].Kind)
	}
}

func TestRefLabelCompletionShowsDestination(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n[install]: /docs/getting-started/installation/\n\nSee [x]["
	items := s.complete(t, s.open(t, filepath.Join(s.root, "docs", "page.mdx"), doc), 4, 9)
	if len(items) != 1 {
		t.Fatalf("completions = %v, want one label", labels(items))
	}
	if detail, ok := items[0].Detail.Get(); !ok || detail != "/docs/getting-started/installation/" {
		t.Fatalf("detail = %q, want the definition destination", detail)
	}
}

func TestRefLabelCompletionFiltersCaseInsensitively(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n[install]: /docs/getting-started/installation/\n[guide]: /docs/getting-started/\n\nSee [the guide][INS"
	items := s.complete(t, s.open(t, filepath.Join(s.root, "docs", "page.mdx"), doc), 5, 19)
	if len(items) != 1 || items[0].Label != "install" {
		t.Fatalf("completions = %v, want only install", labels(items))
	}
	if text, ok := editText(items, "install"); !ok || text != "install" {
		t.Fatalf("install edit = %q, want the label", text)
	}
}

func TestRefLabelCompletionNoMatchIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n[install]: /docs/getting-started/installation/\n\nSee [x][zzz"
	items := s.complete(t, s.open(t, filepath.Join(s.root, "docs", "page.mdx"), doc), 4, 12)
	if len(items) != 0 {
		t.Fatalf("completions = %v, want none (no label matches, and no fall-through to components)", labels(items))
	}
}

func TestLinkCompletionRefDefinitionDestination(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install]: /docs/get")
	items := s.complete(t, documentURI, 2, 20)
	if len(items) != 2 || !hasLabel(items, "/docs/getting-started/") || !hasLabel(items, "/docs/getting-started/installation/") {
		t.Fatalf("completions = %v, want the two getting-started URLs", labels(items))
	}
}

func TestLinkCompletionRefDefinitionHeadings(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install]: /docs/getting-started/installation/#")
	items := s.complete(t, documentURI, 2, 47)
	if len(items) != 2 || !hasLabel(items, "installation") || !hasLabel(items, "setup") {
		t.Fatalf("completions = %v, want the installation page's heading ids", labels(items))
	}
}

func TestLinkCompletionRefDefinitionRelative(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install]: ./")
	items := s.complete(t, documentURI, 2, 13)
	if !hasLabel(items, "./sibling.mdx") || !hasLabel(items, "./my%20page.mdx") {
		t.Fatalf("completions = %v, want the sibling files", labels(items))
	}
}
