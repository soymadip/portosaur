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

// fixtureProject builds a temp project with porto.yml and an
// installed CLI schema.
func fixtureProject(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	installSchema(t, root, realConfigSchema(t))
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

// openNoWait sends didOpen without waiting: for documents the
// server never diagnoses (non-config files).
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
	if result.Capabilities.TextDocumentSync != protocol.TextDocumentSyncKindFull {
		t.Fatalf("sync = %v, want full", result.Capabilities.TextDocumentSync)
	}
}

func TestCompletionRootKeys(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "")
	items := s.complete(t, documentURI, 0, 0)
	for _, want := range []string{"site", "theme", "tasks", "vars", "home_page", "docs_home"} {
		if !hasLabel(items, want) {
			t.Fatalf("root completions %v missing %q", labels(items), want)
		}
	}
}

func TestCompletionNestedKeys(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "site:\n  ")
	items := s.complete(t, documentURI, 1, 2)
	for _, want := range []string{"title", "content", "url"} {
		if !hasLabel(items, want) {
			t.Fatalf("site completions %v missing %q", labels(items), want)
		}
	}
	if hasLabel(items, "theme") {
		t.Fatalf("site completions %v include the root key theme", labels(items))
	}
}

func TestCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "site:\n  ti")
	items := s.complete(t, documentURI, 1, 4)
	if len(items) != 1 || items[0].Label != "title" {
		t.Fatalf("completions = %v, want only title", labels(items))
	}
}

func TestCompletionExcludesExistingKeys(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "site:\n  title: x\n  ")
	items := s.complete(t, documentURI, 2, 2)
	if hasLabel(items, "title") {
		t.Fatalf("completions %v include the existing key title", labels(items))
	}
	if !hasLabel(items, "content") {
		t.Fatalf("completions %v missing content", labels(items))
	}
}

func TestCompletionKeyInsertsColon(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "")
	items := s.complete(t, documentURI, 0, 0)
	for _, item := range items {
		if item.Label != "site" {
			continue
		}
		edit, ok := item.TextEdit.(*protocol.TextEdit)
		if !ok {
			t.Fatalf("site TextEdit is %T, want *protocol.TextEdit", item.TextEdit)
		}
		if edit.NewText != "site:" {
			t.Fatalf("site edit = %q, want %q (an object key takes no trailing space)", edit.NewText, "site:")
		}
		return
	}
	t.Fatal("site not in root completions")
}

func TestCompletionBooleanValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	text := "site:\n  content:\n    toc:\n      enable: "
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), text)
	items := s.complete(t, documentURI, 3, 14)
	if !hasLabel(items, "true") || !hasLabel(items, "false") {
		t.Fatalf("boolean completions = %v, want true and false", labels(items))
	}
}

// A porto.yml is always in a project — its own directory is the
// project root by definition — so "outside a project" cannot
// happen for it. What can happen is a project with no installed
// CLI: then the website schema serves completion, but leniently,
// with no schema diagnostics.
func TestCompletionLenientMode(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	raw := realConfigSchema(t)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(raw)
	}))
	defer website.Close()

	s := startTestServer(t, root)
	s.local.resolver.website = website.URL
	documentURI := s.open(t, filepath.Join(root, "porto.yml"), "")
	items := s.complete(t, documentURI, 0, 0)
	if !hasLabel(items, "site") {
		t.Fatalf("lenient completions = %v, want site", labels(items))
	}
}

func TestDiagnosticsLenientModeIsEmpty(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	raw := realConfigSchema(t)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(raw)
	}))
	defer website.Close()

	s := startTestServer(t, root)
	s.local.resolver.website = website.URL
	// An invalid doc in lenient mode: no schema diagnostics.
	documentURI := s.openNoWait(t, filepath.Join(root, "porto.yml"), "site:\n  bogus: true\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 0 {
		t.Fatalf("lenient diagnostics = %+v, want none", diags)
	}
}

func TestCompletionNonConfigFileIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "other.yaml"), "")
	items := s.complete(t, documentURI, 0, 0)
	if len(items) != 0 {
		t.Fatalf("completions for other.yaml = %v, want none", labels(items))
	}
}

func TestHoverShowsDescription(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "site:\n  title: Hello\n")
	hover, err := s.server.Hover(context.Background(), &protocol.HoverParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
			Position:     protocol.Position{Line: 1, Character: 4},
		},
	})
	if err != nil {
		t.Fatalf("hover: %v", err)
	}
	if hover == nil {
		t.Fatal("no hover for the title key")
	}
	content, ok := hover.Contents.(*protocol.MarkupContent)
	if !ok {
		t.Fatalf("hover contents are %T, want *protocol.MarkupContent", hover.Contents)
	}
	if !strings.Contains(content.Value, "Global site title.") {
		t.Fatalf("hover = %q, want the title description", content.Value)
	}
	if !strings.Contains(content.Value, "string") {
		t.Fatalf("hover = %q, want the type", content.Value)
	}
}

func TestHoverUnknownKeyIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "porto.yml"), "site:\n  bogus: true\n")
	hover, err := s.server.Hover(context.Background(), &protocol.HoverParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
			Position:     protocol.Position{Line: 1, Character: 4},
		},
	})
	if err != nil {
		t.Fatalf("hover: %v", err)
	}
	if hover != nil {
		t.Fatalf("hover for an unknown key = %+v, want nil", hover)
	}
}

func TestDiagnosticsValidDocument(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "porto.yml"), "site:\n  title: Hello\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %+v, want none", diags)
	}
}

func TestDiagnosticsUnknownKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "porto.yml"), "site:\n  bogus: true\n")
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

func TestDiagnosticsWrongType(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "porto.yml"), "site:\n  title: 42\n")
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

func TestDiagnosticsSyntaxError(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "porto.yml"), "site:\n  title: [unclosed\n")
	diags := s.waitDiagnostics(t, documentURI)
	if len(diags) == 0 {
		t.Fatal("no diagnostics for broken YAML")
	}
}

func TestDiagnosticsClearedOnClose(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "porto.yml"), "site:\n  bogus: true\n")
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
