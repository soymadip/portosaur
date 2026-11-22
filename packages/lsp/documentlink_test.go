package main

import (
	"context"
	"path/filepath"
	"testing"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// documentLinks sends a textDocument/documentLink request and
// returns the links.
func (s *testServer) documentLinks(t *testing.T, documentURI uri.URI) []protocol.DocumentLink {
	t.Helper()
	links, err := s.server.DocumentLink(context.Background(), &protocol.DocumentLinkParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
	})
	if err != nil {
		t.Fatalf("documentLink: %v", err)
	}
	return links
}

// linkTargetString returns the target URI string of a link, or ""
// when the link has no target.
func linkTargetString(link protocol.DocumentLink) string {
	if link.Target == nil {
		return ""
	}
	return link.Target.String()
}

func TestDocumentLinkCleanURL(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install](/docs/getting-started/installation/)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("document links = %d, want 1", len(links))
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "2 - installation.mdx")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("link target = %q, want %q", linkTargetString(links[0]), want)
	}
	if links[0].Range.Start != (protocol.Position{Line: 2, Character: 10}) || links[0].Range.End != (protocol.Position{Line: 2, Character: 45}) {
		t.Fatalf("link range = %v, want (2,10)-(2,45) covering the destination", links[0].Range)
	}
}

func TestDocumentLinkRelativePath(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[sib](./sibling.mdx)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("document links = %d, want 1", len(links))
	}
	want := uri.File(filepath.Join(s.root, "docs", "sibling.mdx")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("link target = %q, want %q", linkTargetString(links[0]), want)
	}
	if links[0].Range.Start != (protocol.Position{Line: 2, Character: 6}) || links[0].Range.End != (protocol.Position{Line: 2, Character: 19}) {
		t.Fatalf("link range = %v, want (2,6)-(2,19) covering the destination", links[0].Range)
	}
}

func TestDocumentLinkExternal(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](https://example.com/page)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("document links = %d, want 1", len(links))
	}
	if linkTargetString(links[0]) != "https://example.com/page" {
		t.Fatalf("link target = %q, want the URL itself", linkTargetString(links[0]))
	}
}

func TestDocumentLinkImage(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"static/logo.png": "fake png",
		"docs/pic.png":    "fake png",
	})
	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n![logo](/logo.png)\n\n![pic](./pic.png)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 2 {
		t.Fatalf("document links = %d, want 2", len(links))
	}
	want := uri.File(filepath.Join(s.root, "static", "logo.png")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("first link target = %q, want %q (absolute srcs live under static/)", linkTargetString(links[0]), want)
	}
	want = uri.File(filepath.Join(s.root, "docs", "pic.png")).String()
	if linkTargetString(links[1]) != want {
		t.Fatalf("second link target = %q, want %q (relative srcs live next to the page)", linkTargetString(links[1]), want)
	}
}

func TestDocumentLinkJSXProps(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n<Link href=\"/docs/getting-started/installation/\">x</Link>\n\n<Btn href=\"./sibling.mdx\">x</Btn>\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 2 {
		t.Fatalf("document links = %d, want 2", len(links))
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "2 - installation.mdx")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("Link target = %q, want %q", linkTargetString(links[0]), want)
	}
	want = uri.File(filepath.Join(s.root, "docs", "sibling.mdx")).String()
	if linkTargetString(links[1]) != want {
		t.Fatalf("Btn target = %q, want %q", linkTargetString(links[1]), want)
	}
	if links[0].Range.Start != (protocol.Position{Line: 2, Character: 12}) || links[0].Range.End != (protocol.Position{Line: 2, Character: 47}) {
		t.Fatalf("Link range = %v, want (2,12)-(2,47) covering the prop value", links[0].Range)
	}
}

func TestDocumentLinkBrokenIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](/docs/no-such-page/)\n\n[y](./missing.mdx)\n\n![z](./missing.png)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 0 {
		t.Fatalf("document links = %d, want none (broken links have nothing to open)", len(links))
	}
}

func TestDocumentLinkVarsAndEnvIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[x](/docs/{vars.page}/)\n\n![i]({env.IMG})\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 0 {
		t.Fatalf("document links = %d, want none (substituted destinations resolve at build time)", len(links))
	}
}

func TestDocumentLinkHashDropped(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[setup](/docs/getting-started/installation/#setup)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("document links = %d, want 1", len(links))
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "2 - installation.mdx")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("link target = %q, want %q (the hash is dropped, the target is the file)", linkTargetString(links[0]), want)
	}
}

func TestDocumentLinkAnchorOnlyIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[here](#details)\n\n## Details\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 0 {
		t.Fatalf("document links = %d, want none (a bare anchor points at the open document)", len(links))
	}
}

func TestDocumentLinkSkipsCodeAndFrontmatter(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "---\ndesc: \"see [x](/docs/getting-started/installation/)\"\n---\n\n# Page\n\n`[y](/docs/getting-started/installation/)`\n\n```md\n[z](/docs/getting-started/installation/)\n```\n\n[real](/docs/getting-started/installation/)\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("document links = %d, want 1 (frontmatter, code spans, and fences hold no links)", len(links))
	}
	if links[0].Range.Start.Line != 12 {
		t.Fatalf("link line = %d, want 12 (the real link)", links[0].Range.Start.Line)
	}
}

func TestDocumentLinkRefDefinition(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install]: /docs/getting-started/installation/\n\nSee [it][install].\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("links = %v, want only the definition destination (the use site gets none)", links)
	}
	want := uri.File(filepath.Join(s.root, "docs", "1 - getting-started", "2 - installation.mdx")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("target = %q, want %q", linkTargetString(links[0]), want)
	}
	if links[0].Range.Start.Line != 2 || links[0].Range.Start.Character != 11 {
		t.Fatalf("range = %+v, want the destination", links[0].Range)
	}
}

func TestDocumentLinkRefDefinitionBrokenIsEmpty(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install]: /docs/missing/\n")
	if links := s.documentLinks(t, documentURI); len(links) != 0 {
		t.Fatalf("links = %v, want none for a broken destination", links)
	}
}

func TestDocumentLinkRefImageDefinition(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/page.mdx":         "# Page\n",
		"static/images/pic.png": "fake png",
	})
	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n![alt][pic]\n\n[pic]: /images/pic.png\n")
	links := s.documentLinks(t, documentURI)
	if len(links) != 1 {
		t.Fatalf("links = %v, want the image definition destination", links)
	}
	want := uri.File(filepath.Join(s.root, "static", "images", "pic.png")).String()
	if linkTargetString(links[0]) != want {
		t.Fatalf("target = %q, want %q", linkTargetString(links[0]), want)
	}
}
