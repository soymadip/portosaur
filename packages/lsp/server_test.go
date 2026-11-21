package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.lsp.dev/jsonrpc2"
	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// testClient records the diagnostics the server publishes.
type testClient struct {
	protocol.UnimplementedClient

	diagnostics chan *protocol.PublishDiagnosticsParams
}

func (c *testClient) PublishDiagnostics(_ context.Context, params *protocol.PublishDiagnosticsParams) error {
	c.diagnostics <- params
	return nil
}

// testServer wires one server to one client over an in-memory
// channel, initialized on the fixture project. local is the
// server itself, for tests that reconfigure it (the website URL).
type testServer struct {
	server protocol.Server
	local  *Server
	client *testClient
	root   string
}

func startTestServer(t *testing.T, root string) *testServer {
	t.Helper()
	ctx := context.Background()
	left, right := jsonrpc2.NewChannelStreamPair(0)

	server := newServer()
	_, _, client := protocol.NewServer(ctx, server, left)
	server.setClient(client)

	testClient := &testClient{diagnostics: make(chan *protocol.PublishDiagnosticsParams, 16)}
	_, _, remote := protocol.NewClient(ctx, testClient, right)

	rootURI := uri.File(root)
	if _, err := remote.Initialize(ctx, &protocol.InitializeParams{RootURI: &rootURI}); err != nil {
		t.Fatalf("initialize: %v", err)
	}
	return &testServer{server: remote, local: server, client: testClient, root: root}
}

// fixtureProject builds a temp project with porto.yml (the
// detection marker) and the two installed CLI schemas the
// server reads.
func fixtureProject(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	installSchema(t, root, schemaFrontmatter, realSchema(t, schemaFrontmatter))
	installSchema(t, root, schemaComponents, realSchema(t, schemaComponents))
	return root
}

// open sends didOpen and waits for the diagnostics notification
// it triggers: that notification is the server's acknowledgment
// that the open was fully handled, so a completion or hover after
// it can never race the open.
func (s *testServer) open(t *testing.T, path, text string) uri.URI {
	t.Helper()
	documentURI := s.openNoWait(t, path, text)
	s.waitDiagnostics(t, documentURI)
	return documentURI
}

// openNoWait sends didOpen without waiting for the
// diagnostics notification.
func (s *testServer) openNoWait(t *testing.T, path, text string) uri.URI {
	t.Helper()
	documentURI := uri.File(path)
	err := s.server.DidOpen(context.Background(), &protocol.DidOpenTextDocumentParams{
		TextDocument: protocol.TextDocumentItem{
			URI:        documentURI,
			LanguageID: protocol.LanguageKind("yaml"),
			Version:    1,
			Text:       text,
		},
	})
	if err != nil {
		t.Fatalf("didOpen: %v", err)
	}
	return documentURI
}

func (s *testServer) complete(t *testing.T, documentURI uri.URI, line, character uint32) []protocol.CompletionItem {
	t.Helper()
	result, err := s.server.Completion(context.Background(), &protocol.CompletionParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
			Position:     protocol.Position{Line: line, Character: character},
		},
	})
	if err != nil {
		t.Fatalf("completion: %v", err)
	}
	list, ok := result.(*protocol.CompletionList)
	if !ok {
		t.Fatalf("completion: got %T, want *protocol.CompletionList", result)
	}
	return list.Items
}

func labels(items []protocol.CompletionItem) []string {
	var out []string
	for _, item := range items {
		out = append(out, item.Label)
	}
	return out
}

func hasLabel(items []protocol.CompletionItem, label string) bool {
	for _, item := range items {
		if item.Label == label {
			return true
		}
	}
	return false
}

// waitDiagnostics returns the next diagnostics notification for
// the document, or fails the test on timeout.
func (s *testServer) waitDiagnostics(t *testing.T, documentURI uri.URI) []protocol.Diagnostic {
	t.Helper()
	timeout := time.After(5 * time.Second)
	for {
		select {
		case params := <-s.client.diagnostics:
			if params.URI == documentURI {
				return params.Diagnostics
			}
		case <-timeout:
			t.Fatal("timed out waiting for diagnostics")
		}
	}
}

func TestInitializeAdvertisesFeatures(t *testing.T) {
	server := newServer()
	result, err := server.Initialize(context.Background(), &protocol.InitializeParams{})
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	if result.Capabilities.CompletionProvider == nil {
		t.Fatal("no completion provider advertised")
	}
	if result.Capabilities.HoverProvider == nil {
		t.Fatal("no hover provider advertised")
	}
	if result.Capabilities.DefinitionProvider == nil {
		t.Fatal("no definition provider advertised")
	}
	if result.Capabilities.CodeActionProvider == nil {
		t.Fatal("no code action provider advertised")
	}
	if result.Capabilities.DocumentSymbolProvider == nil {
		t.Fatal("no document symbol provider advertised")
	}
	if result.Capabilities.TextDocumentSync != protocol.TextDocumentSyncKindFull {
		t.Fatalf("sync = %v, want full", result.Capabilities.TextDocumentSync)
	}
}

func TestCompletionNonMDXFileIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "other.yaml"), "")
	items := s.complete(t, documentURI, 0, 0)
	if len(items) != 0 {
		t.Fatalf("completions for other.yaml = %v, want none", labels(items))
	}
}

// porto.yml is served by the YAML extension through the $schema
// line, not by this server: no completions, no hover.
func TestConfigFileIsNotServed(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "porto.yml"), "site:\n  ")
	items := s.complete(t, documentURI, 1, 2)
	if len(items) != 0 {
		t.Fatalf("completions for porto.yml = %v, want none", labels(items))
	}
	if content := s.hover(t, documentURI, 0, 1); content != nil {
		t.Fatalf("hover for porto.yml = %q, want nil", content.Value)
	}
}

// editText returns the inserted text of the completion item with
// the given label.
func editText(items []protocol.CompletionItem, label string) (string, bool) {
	for _, item := range items {
		if item.Label != label {
			continue
		}
		edit, ok := item.TextEdit.(*protocol.TextEdit)
		if !ok {
			return "", false
		}
		return edit.NewText, true
	}
	return "", false
}

func (s *testServer) hover(t *testing.T, documentURI uri.URI, line, character uint32) *protocol.MarkupContent {
	t.Helper()
	hover, err := s.server.Hover(context.Background(), &protocol.HoverParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
			Position:     protocol.Position{Line: line, Character: character},
		},
	})
	if err != nil {
		t.Fatalf("hover: %v", err)
	}
	if hover == nil {
		return nil
	}
	content, ok := hover.Contents.(*protocol.MarkupContent)
	if !ok {
		t.Fatalf("hover contents are %T, want *protocol.MarkupContent", hover.Contents)
	}
	return content
}

func TestFrontmatterCompletionRootKeys(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\n\n---\n")
	items := s.complete(t, documentURI, 1, 0)
	for _, want := range []string{"title", "desc", "draft", "tags", "toc"} {
		if !hasLabel(items, want) {
			t.Fatalf("frontmatter completions %v missing %q", labels(items), want)
		}
	}
}

func TestFrontmatterCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nti\n---\n")
	items := s.complete(t, documentURI, 1, 2)
	if len(items) != 1 || items[0].Label != "title" {
		t.Fatalf("completions = %v, want only title", labels(items))
	}
	edit, ok := items[0].TextEdit.(*protocol.TextEdit)
	if !ok {
		t.Fatalf("title TextEdit is %T, want *protocol.TextEdit", items[0].TextEdit)
	}
	if edit.Range.Start.Line != 1 {
		t.Fatalf("edit line = %d, want 1 (the frontmatter offset)", edit.Range.Start.Line)
	}
}

func TestFrontmatterCompletionExcludesExistingKeys(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: x\n\n---\n")
	items := s.complete(t, documentURI, 2, 0)
	if hasLabel(items, "title") {
		t.Fatalf("completions %v include the existing key title", labels(items))
	}
	if !hasLabel(items, "desc") {
		t.Fatalf("completions %v missing desc", labels(items))
	}
}

func TestFrontmatterCompletionBooleanValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\n  enable: \n---\n")
	items := s.complete(t, documentURI, 2, 10)
	if !hasLabel(items, "true") || !hasLabel(items, "false") {
		t.Fatalf("boolean completions = %v, want true and false", labels(items))
	}
}

func TestFrontmatterCompletionUnclosedFence(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: Hello\n\n")
	items := s.complete(t, documentURI, 2, 0)
	if !hasLabel(items, "desc") {
		t.Fatalf("unclosed frontmatter completions = %v, want desc", labels(items))
	}
	if hasLabel(items, "title") {
		t.Fatalf("unclosed frontmatter completions = %v, include the existing title", labels(items))
	}
}

func TestFrontmatterDiagnosticsUnknownKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "page.mdx"), "---\nbogus: true\n---\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want one", diags)
	}
	if !strings.Contains(string(diags[0].Message.(protocol.String)), "bogus") {
		t.Fatalf("diagnostic = %q, want it to name bogus", diags[0].Message)
	}
	if diags[0].Range.Start.Line != 1 {
		t.Fatalf("diagnostic line = %d, want 1", diags[0].Range.Start.Line)
	}
}

func TestFrontmatterDiagnosticsWrongType(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: 42\n---\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 1 {
		t.Fatalf("diagnostics = %+v, want one", diags)
	}
	if !strings.Contains(string(diags[0].Message.(protocol.String)), "number") {
		t.Fatalf("diagnostic = %q, want it to mention the number", diags[0].Message)
	}
	if diags[0].Range.Start.Line != 1 {
		t.Fatalf("diagnostic line = %d, want 1", diags[0].Range.Start.Line)
	}
}

func TestFrontmatterDiagnosticsSyntaxError(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: [unclosed\n---\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) == 0 {
		t.Fatal("no diagnostics for broken frontmatter YAML")
	}
	if diags[0].Range.Start.Line != 1 {
		t.Fatalf("diagnostic line = %d, want 1", diags[0].Range.Start.Line)
	}
}

func TestFrontmatterDiagnosticsUnclosedFenceIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "page.mdx"), "---\nbogus: true\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 0 {
		t.Fatalf("unclosed frontmatter diagnostics = %+v, want none", diags)
	}
}

func TestFrontmatterDiagnosticsValidDocument(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: Hello\n---\n# Hello\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %+v, want none", diags)
	}
}

// A project with no installed CLI: the website schema serves
// frontmatter completion, but leniently, with no schema
// diagnostics.
func TestFrontmatterCompletionLenientMode(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	raw := realSchema(t, schemaFrontmatter)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(raw)
	}))
	defer website.Close()

	s := startTestServer(t, root)
	s.local.resolver.website = website.URL
	documentURI := s.open(t, filepath.Join(root, "page.mdx"), "---\n\n---\n")
	items := s.complete(t, documentURI, 1, 0)
	if !hasLabel(items, "title") {
		t.Fatalf("lenient completions = %v, want title", labels(items))
	}
}

func TestFrontmatterDiagnosticsLenientModeIsEmpty(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	raw := realSchema(t, schemaFrontmatter)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(raw)
	}))
	defer website.Close()

	s := startTestServer(t, root)
	s.local.resolver.website = website.URL
	// An invalid doc in lenient mode: no schema diagnostics.
	documentURI := s.openNoWait(t, filepath.Join(root, "page.mdx"), "---\nbogus: true\n---\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 0 {
		t.Fatalf("lenient diagnostics = %+v, want none", diags)
	}
}

func TestFrontmatterDiagnosticsClearedOnClose(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "page.mdx"), "---\nbogus: true\n---\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) == 0 {
		t.Fatal("no diagnostics before close")
	}
	err := s.server.DidClose(context.Background(), &protocol.DidCloseTextDocumentParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
	})
	if err != nil {
		t.Fatalf("didClose: %v", err)
	}
	diags = s.waitDiagnostics(t, documentURI)
	if len(diags) != 0 {
		t.Fatalf("diagnostics after close = %+v, want none", diags)
	}
}

func TestComponentCompletionNames(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	if len(items) != 18 {
		t.Fatalf("component completions = %d, want 18", len(items))
	}
	for _, want := range []string{"Btn", "Details", "Hint", "Tabs", "TabItem"} {
		if !hasLabel(items, want) {
			t.Fatalf("component completions %v missing %q", labels(items), want)
		}
	}
}

func TestComponentCompletionNamesFilterByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<B")
	items := s.complete(t, documentURI, 2, 2)
	if len(items) != 1 || items[0].Label != "Btn" {
		t.Fatalf("completions = %v, want only Btn", labels(items))
	}
}

func TestComponentCompletionProps(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn ")
	items := s.complete(t, documentURI, 2, 5)
	for _, want := range []string{"variant", "href", "size", "outline"} {
		if !hasLabel(items, want) {
			t.Fatalf("Btn prop completions %v missing %q", labels(items), want)
		}
	}
	if hasLabel(items, "value") {
		t.Fatalf("Btn prop completions %v include TabItem's value", labels(items))
	}
	if text, ok := editText(items, "variant"); !ok || text != "variant=" {
		t.Fatalf("variant edit = %q, want %q", text, "variant=")
	}
	if text, ok := editText(items, "outline"); !ok || text != "outline" {
		t.Fatalf("outline edit = %q, want %q (a boolean prop completes bare)", text, "outline")
	}
}

func TestComponentCompletionPropsExcludeExisting(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"primary\" ")
	items := s.complete(t, documentURI, 2, 24)
	if hasLabel(items, "variant") {
		t.Fatalf("completions %v include the existing prop variant", labels(items))
	}
	if !hasLabel(items, "size") {
		t.Fatalf("completions %v missing size", labels(items))
	}
}

func TestComponentCompletionEnumValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=")
	items := s.complete(t, documentURI, 2, 13)
	for _, want := range []string{"primary", "secondary", "ghost"} {
		if !hasLabel(items, want) {
			t.Fatalf("variant completions %v missing %q", labels(items), want)
		}
	}
	if text, ok := editText(items, "primary"); !ok || text != `"primary"` {
		t.Fatalf("primary edit = %q, want %q (quoted, no quotes typed yet)", text, `"primary"`)
	}
}

func TestComponentCompletionEnumValueInQuotes(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"pr")
	items := s.complete(t, documentURI, 2, 16)
	if len(items) != 1 || items[0].Label != "primary" {
		t.Fatalf("completions = %v, want only primary", labels(items))
	}
	if text, ok := editText(items, "primary"); !ok || text != "primary" {
		t.Fatalf("primary edit = %q, want %q (bare, the quotes are there)", text, "primary")
	}
}

func TestComponentCompletionBooleanValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn outline=")
	items := s.complete(t, documentURI, 2, 13)
	if !hasLabel(items, "true") || !hasLabel(items, "false") {
		t.Fatalf("boolean completions = %v, want true and false", labels(items))
	}
	if text, ok := editText(items, "true"); !ok || text != "true" {
		t.Fatalf("true edit = %q, want %q (bare, not quoted)", text, "true")
	}
}

func TestComponentCompletionUnknownComponentIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Foo ")
	items := s.complete(t, documentURI, 2, 5)
	if len(items) != 0 {
		t.Fatalf("completions for <Foo = %v, want none", labels(items))
	}
}

func TestComponentHoverName(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"primary\">")
	content := s.hover(t, documentURI, 2, 2)
	if content == nil {
		t.Fatal("no hover for the Btn tag name")
	}
	if !strings.Contains(content.Value, "Props:") || !strings.Contains(content.Value, "variant") {
		t.Fatalf("hover = %q, want the prop list", content.Value)
	}
}

func TestComponentHoverProp(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"primary\">")
	content := s.hover(t, documentURI, 2, 8)
	if content == nil {
		t.Fatal("no hover for the variant prop")
	}
	if !strings.Contains(content.Value, "The button style.") {
		t.Fatalf("hover = %q, want the variant description", content.Value)
	}
	if !strings.Contains(content.Value, "string") {
		t.Fatalf("hover = %q, want the type", content.Value)
	}
}

func TestComponentHoverPropValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"primary\">")
	content := s.hover(t, documentURI, 2, 16)
	if content == nil {
		t.Fatal("no hover for the variant value")
	}
	if !strings.Contains(content.Value, "The button style.") {
		t.Fatalf("hover = %q, want the variant description", content.Value)
	}
}

func TestComponentHoverUnknownComponentIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Foo>")
	content := s.hover(t, documentURI, 2, 2)
	if content != nil {
		t.Fatalf("hover for <Foo> = %q, want nil", content.Value)
	}
}

func TestMDXOutsideProjectIsEmpty(t *testing.T) {
	root := t.TempDir()
	s := startTestServer(t, root)
	documentURI := s.openNoWait(t, filepath.Join(root, "page.mdx"), "# Hello\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	if len(items) != 0 {
		t.Fatalf("completions outside a project = %v, want none", labels(items))
	}
}
