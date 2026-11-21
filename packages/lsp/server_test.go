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
	return fixtureProjectWithConfig(t, "")
}

// fixtureProjectWithConfig builds a temp project with the given
// porto.yml content and the two installed CLI schemas the
// server reads.
func fixtureProjectWithConfig(t *testing.T, config string) string {
	t.Helper()
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(config), 0o644); err != nil {
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

// onTypeFormatting asks the server what to insert after the
// trigger character ch was typed at the cursor. The document
// already holds the typed character when the request is made.
func (s *testServer) onTypeFormatting(t *testing.T, documentURI uri.URI, line, character uint32, ch string) []protocol.TextEdit {
	t.Helper()
	result, err := s.server.OnTypeFormatting(context.Background(), &protocol.DocumentOnTypeFormattingParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
		Position:     protocol.Position{Line: line, Character: character},
		Ch:           ch,
		Options:      protocol.FormattingOptions{TabSize: 2, InsertSpaces: true},
	})
	if err != nil {
		t.Fatalf("onTypeFormatting: %v", err)
	}
	return result
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
	wantTriggers := []string{":", "<", "=", ".", "(", "/"}
	triggers := result.Capabilities.CompletionProvider.TriggerCharacters
	if len(triggers) != len(wantTriggers) {
		t.Fatalf("trigger characters = %v, want %v", triggers, wantTriggers)
	}
	for i, want := range wantTriggers {
		if triggers[i] != want {
			t.Fatalf("trigger characters = %v, want %v", triggers, wantTriggers)
		}
	}
	if result.Capabilities.HoverProvider == nil {
		t.Fatal("no hover provider advertised")
	}
	if result.Capabilities.InlayHintProvider == nil {
		t.Fatal("no inlay hint provider advertised")
	}
	if result.Capabilities.DefinitionProvider == nil {
		t.Fatal("no definition provider advertised")
	}
	if result.Capabilities.DocumentLinkProvider == nil {
		t.Fatal("no document link provider advertised")
	}
	if resolve := result.Capabilities.DocumentLinkProvider.ResolveProvider; resolve == nil || *resolve {
		t.Fatal("document link resolve provider advertised, want none (links are computed fully up front)")
	}
	if result.Capabilities.CodeActionProvider == nil {
		t.Fatal("no code action provider advertised")
	}
	if result.Capabilities.DocumentSymbolProvider == nil {
		t.Fatal("no document symbol provider advertised")
	}
	if trigger := result.Capabilities.DocumentOnTypeFormattingProvider.FirstTriggerCharacter; trigger != "\n" {
		t.Fatalf("on type formatting trigger = %q, want newline", trigger)
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

// itemCommand returns the command of the completion item with
// the given label.
func itemCommand(items []protocol.CompletionItem, label string) (protocol.Command, bool) {
	for _, item := range items {
		if item.Label == label {
			return item.Command, true
		}
	}
	return protocol.Command{}, false
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

// detailText returns the detail of the completion item with the
// given label.
func detailText(items []protocol.CompletionItem, label string) (string, bool) {
	for _, item := range items {
		if item.Label != label {
			continue
		}
		return item.Detail.Get()
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
	if len(items) != 18+len(htmlTags) {
		t.Fatalf("component completions = %d, want %d (18 built-ins plus the HTML tags)", len(items), 18+len(htmlTags))
	}
	for _, want := range []string{"Btn", "Details", "Hint", "Tabs", "TabItem"} {
		if !hasLabel(items, want) {
			t.Fatalf("component completions %v missing %q", labels(items), want)
		}
	}
	for _, want := range []string{"div", "span", "section"} {
		if !hasLabel(items, want) {
			t.Fatalf("component completions %v missing HTML tag %q", labels(items), want)
		}
	}
	if detail, ok := detailText(items, "div"); !ok || detail != "HTML tag" {
		t.Fatalf("div detail = %q, want %q", detail, "HTML tag")
	}
}

func TestComponentCompletionNamesIncludeImports(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "import Foo from './Foo'\nimport { Bar, Baz } from './parts'\nimport Qux, { Quux } from './mix'\n\n<")
	items := s.complete(t, documentURI, 4, 1)
	if len(items) != 18+len(htmlTags)+5 {
		t.Fatalf("component completions = %d, want %d (18 built-ins, the HTML tags, and 5 imports)", len(items), 18+len(htmlTags)+5)
	}
	for _, want := range []string{"Foo", "Bar", "Baz", "Qux", "Quux"} {
		if !hasLabel(items, want) {
			t.Fatalf("component completions %v missing imported %q", labels(items), want)
		}
	}
	if detail, ok := detailText(items, "Foo"); !ok || detail != "from './Foo'" {
		t.Fatalf("Foo detail = %q, want %q", detail, "from './Foo'")
	}
	if detail, ok := detailText(items, "Bar"); !ok || detail != "from './parts'" {
		t.Fatalf("Bar detail = %q, want %q", detail, "from './parts'")
	}
	if text, ok := editText(items, "Foo"); !ok || text != "<Foo>$0</Foo>" {
		t.Fatalf("Foo edit = %q, want %q (imports pair, their shape is unknown)", text, "<Foo>$0</Foo>")
	}
}

func TestComponentCompletionImportedShadowsBuiltin(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "import Btn from './CustomBtn'\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	if len(items) != 18+len(htmlTags) {
		t.Fatalf("component completions = %d, want %d (the imported Btn replaces the built-in)", len(items), 18+len(htmlTags))
	}
	count := 0
	for _, item := range items {
		if item.Label == "Btn" {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("Btn appears %d times, want once", count)
	}
	if detail, ok := detailText(items, "Btn"); !ok || detail != "from './CustomBtn'" {
		t.Fatalf("Btn detail = %q, want %q (the import wins)", detail, "from './CustomBtn'")
	}
}

func TestComponentCompletionSkipsTypeAndNamespaceImports(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "import type { Widget } from './types'\nimport * as Lib from './lib'\nimport type Gadget from './types'\n\n<")
	items := s.complete(t, documentURI, 4, 1)
	if len(items) != 18+len(htmlTags) {
		t.Fatalf("component completions = %d, want %d (type and namespace imports offer nothing)", len(items), 18+len(htmlTags))
	}
	for _, want := range []string{"Widget", "Lib", "Gadget"} {
		if hasLabel(items, want) {
			t.Fatalf("component completions %v include %q, want it skipped", labels(items), want)
		}
	}
}

func TestComponentCompletionHTMLFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<di")
	items := s.complete(t, documentURI, 2, 3)
	if len(items) != 2 || !hasLabel(items, "dialog") || !hasLabel(items, "div") {
		t.Fatalf("completions = %v, want only dialog and div", labels(items))
	}
	if text, ok := editText(items, "div"); !ok || text != "<div>$0</div>" {
		t.Fatalf("div edit = %q, want %q (the whole tag)", text, "<div>$0</div>")
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

// TestComponentCompletionInsertsFullTag checks the snippet each
// tag inserts on pick: containers pair with the cursor inside,
// leaf components close themselves, void HTML tags take no
// closing tag. Every tag item is a snippet, and the edit range
// covers the `<` the user typed.
func TestComponentCompletionInsertsFullTag(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	want := map[string]string{
		"Hint":        "<Hint>$0</Hint>",
		"Details":     "<Details>$0</Details>",
		"Tabs":        "<Tabs>$0</Tabs>",
		"Icon":        "<Icon />",
		"Diagram":     "<Diagram />",
		"DynamicIcon": "<DynamicIcon />",
		"TopicList":   "<TopicList />",
		"IconSearch":  "<IconSearch />",
		"Pv":          "<Pv>$0</Pv>",
		"div":         "<div>$0</div>",
		"br":          "<br>",
		"hr":          "<hr>",
		"img":         "<img>",
	}
	for label, text := range want {
		if got, ok := editText(items, label); !ok || got != text {
			t.Fatalf("%s edit = %q, want %q", label, got, text)
		}
	}
	for _, item := range items {
		if item.InsertTextFormat != protocol.InsertTextFormatSnippet {
			t.Fatalf("%s insert format = %v, want Snippet", item.Label, item.InsertTextFormat)
		}
	}
	if rng := editRange(items, "Hint"); rng.Start != (protocol.Position{Line: 2, Character: 0}) || rng.End != (protocol.Position{Line: 2, Character: 1}) {
		t.Fatalf("Hint edit range = %v, want (2,0)-(2,1) covering the `<`", rng)
	}
}

// TestComponentCompletionInsertRangeCoversPartial checks the
// edit range swallows the `<` and the partial name, so picking
// Hint after `<Hi` leaves exactly one tag.
func TestComponentCompletionInsertRangeCoversPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Hi")
	items := s.complete(t, documentURI, 2, 3)
	if len(items) != 1 || items[0].Label != "Hint" {
		t.Fatalf("completions = %v, want only Hint", labels(items))
	}
	if rng := editRange(items, "Hint"); rng.Start != (protocol.Position{Line: 2, Character: 0}) || rng.End != (protocol.Position{Line: 2, Character: 3}) {
		t.Fatalf("Hint edit range = %v, want (2,0)-(2,3) covering `<Hi`", rng)
	}
	if text, ok := editText(items, "Hint"); !ok || text != "<Hint>$0</Hint>" {
		t.Fatalf("Hint edit = %q, want %q", text, "<Hint>$0</Hint>")
	}
}

// TestComponentCompletionImportedInsertsFullTag checks an
// imported component pairs on pick (its shape is unknown) and
// keeps its source detail.
func TestComponentCompletionImportedInsertsFullTag(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "import Foo from './Foo'\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	if text, ok := editText(items, "Foo"); !ok || text != "<Foo>$0</Foo>" {
		t.Fatalf("Foo edit = %q, want %q", text, "<Foo>$0</Foo>")
	}
	if detail, ok := detailText(items, "Foo"); !ok || detail != "from './Foo'" {
		t.Fatalf("Foo detail = %q, want %q", detail, "from './Foo'")
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

func TestComponentCompletionValuePropTriggersSuggest(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn ")
	items := s.complete(t, documentURI, 2, 5)
	if cmd, ok := itemCommand(items, "variant"); !ok || cmd.Command != "editor.action.triggerSuggest" {
		t.Fatalf("variant command = %q, want %q", cmd.Command, "editor.action.triggerSuggest")
	}
	if cmd, ok := itemCommand(items, "outline"); !ok || cmd.Command != "" {
		t.Fatalf("outline command = %q, want none (a boolean prop takes no value)", cmd.Command)
	}
}

func TestComponentCompletionValuePopupAfterAccept(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn ")
	items := s.complete(t, documentURI, 2, 5)
	text, ok := editText(items, "variant")
	if !ok || text != "variant=" {
		t.Fatalf("variant edit = %q, want %q", text, "variant=")
	}
	// The editor inserts `variant=` and runs triggerSuggest:
	// completing right after the `=` must offer the values.
	acceptedURI := s.open(t, filepath.Join(s.root, "accepted.mdx"), "# Hello\n\n<Btn "+text)
	values := s.complete(t, acceptedURI, 2, 13)
	for _, want := range []string{"primary", "secondary", "ghost"} {
		if !hasLabel(values, want) {
			t.Fatalf("variant completions %v missing %q", labels(values), want)
		}
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

func TestFrontmatterIconCompletionOffersPrefixes(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nicon: \n---\n")
	items := s.complete(t, documentURI, 1, 6)
	if len(items) != len(iconPackNames) {
		t.Fatalf("icon completions = %d, want %d (every pack prefix)", len(items), len(iconPackNames))
	}
	for _, want := range []string{"si:", "lu:", "fa:", "lucide:"} {
		if !hasLabel(items, want) {
			t.Fatalf("icon completions %v missing %q", labels(items), want)
		}
	}
	if text, ok := editText(items, "si:"); !ok || text != "si:" {
		t.Fatalf("si: edit = %q, want %q", text, "si:")
	}
	if detail, ok := detailText(items, "si:"); !ok || detail != "Simple Icons" {
		t.Fatalf("si: detail = %q, want %q", detail, "Simple Icons")
	}
}

func TestFrontmatterIconCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nicon: si\n---\n")
	items := s.complete(t, documentURI, 1, 8)
	if len(items) != 2 || !hasLabel(items, "si:") || !hasLabel(items, "simple-icons:") {
		t.Fatalf("completions = %v, want only si: and simple-icons:", labels(items))
	}
}

func TestFrontmatterIconCompletionAfterColonIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nicon: si:g\n---\n")
	items := s.complete(t, documentURI, 1, 10)
	if len(items) != 0 {
		t.Fatalf("completions after the colon = %v, want none (icon names stay free text)", labels(items))
	}
}

func TestFrontmatterIconCompletionQuotedValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nicon: \"si\n---\n")
	items := s.complete(t, documentURI, 1, 9)
	if len(items) != 2 || !hasLabel(items, "si:") || !hasLabel(items, "simple-icons:") {
		t.Fatalf("completions = %v, want only si: and simple-icons:", labels(items))
	}
	for _, item := range items {
		if item.Label != "si:" {
			continue
		}
		edit, ok := item.TextEdit.(*protocol.TextEdit)
		if !ok {
			t.Fatalf("si: TextEdit is %T, want *protocol.TextEdit", item.TextEdit)
		}
		if edit.NewText != "si:" {
			t.Fatalf("si: edit = %q, want %q", edit.NewText, "si:")
		}
		if edit.Range.Start.Character != 7 {
			t.Fatalf("si: edit starts at character %d, want 7 (after the opening quote)", edit.Range.Start.Character)
		}
	}
}

func TestComponentIconCompletionOffersPrefixes(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon id=\"")
	items := s.complete(t, documentURI, 2, 10)
	if len(items) != len(iconPackNames) {
		t.Fatalf("icon completions = %d, want %d (every pack prefix)", len(items), len(iconPackNames))
	}
	if !hasLabel(items, "si:") {
		t.Fatalf("icon completions %v missing si:", labels(items))
	}
	if text, ok := editText(items, "si:"); !ok || text != "si:" {
		t.Fatalf("si: edit = %q, want %q (bare, the quotes are there)", text, "si:")
	}
	if detail, ok := detailText(items, "si:"); !ok || detail != "Simple Icons" {
		t.Fatalf("si: detail = %q, want %q", detail, "Simple Icons")
	}
}

func TestComponentIconCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon id=\"lu")
	items := s.complete(t, documentURI, 2, 12)
	if len(items) != 2 || !hasLabel(items, "lu:") || !hasLabel(items, "lucide:") {
		t.Fatalf("completions = %v, want only lu: and lucide:", labels(items))
	}
}

func TestComponentIconCompletionAfterColonIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon id=\"si:star")
	items := s.complete(t, documentURI, 2, 17)
	if len(items) != 0 {
		t.Fatalf("completions after the colon = %v, want none (icon names stay free text)", labels(items))
	}
}

func TestComponentIconCompletionBtnIconProp(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn icon=\"")
	items := s.complete(t, documentURI, 2, 11)
	if !hasLabel(items, "si:") {
		t.Fatalf("Btn icon completions %v missing si:", labels(items))
	}
}

func TestComponentIconCompletionNonIconPropIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn href=\"")
	items := s.complete(t, documentURI, 2, 11)
	if len(items) != 0 {
		t.Fatalf("href completions = %v, want none (href is not an icon prop)", labels(items))
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
