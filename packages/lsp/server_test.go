package main

import (
	"context"
	"encoding/json"
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

// willRenameFiles sends a workspace/willRenameFiles request and
// returns the edit, or nil when the server returns nothing.
func (s *testServer) willRenameFiles(t *testing.T, files ...protocol.FileRename) *protocol.WorkspaceEdit {
	t.Helper()
	edit, err := s.server.WillRenameFiles(context.Background(), &protocol.RenameFilesParams{Files: files})
	if err != nil {
		t.Fatalf("willRenameFiles: %v", err)
	}
	return edit
}

// didRenameFiles sends a workspace/didRenameFiles
// notification. It calls the handler on the local server
// directly: a notification has no acknowledgment to wait on,
// and handlers run unordered, so going through the wire could
// race the completion that follows it.
func (s *testServer) didRenameFiles(t *testing.T, files ...protocol.FileRename) {
	t.Helper()
	if err := s.local.DidRenameFiles(context.Background(), &protocol.RenameFilesParams{Files: files}); err != nil {
		t.Fatalf("didRenameFiles: %v", err)
	}
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
	wantTriggers := []string{":", "<", "=", ".", "(", "/", "'", "\""}
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
	ops := result.Capabilities.Workspace
	if ops == nil || ops.FileOperations == nil {
		t.Fatal("no file operations advertised")
	}
	filters := ops.FileOperations.WillRename.Filters
	if len(filters) != 2 {
		t.Fatalf("willRename filters = %d, want 2 (content files and folders)", len(filters))
	}
	if filters[0].Pattern.Glob != "**/*.{md,mdx}" || filters[0].Pattern.Matches != protocol.FileOperationPatternKindFile {
		t.Fatalf("willRename file filter = %+v, want **/*.{md,mdx} matching files", filters[0].Pattern)
	}
	if filters[1].Pattern.Glob != "**/*" || filters[1].Pattern.Matches != protocol.FileOperationPatternKindFolder {
		t.Fatalf("willRename folder filter = %+v, want **/* matching folders", filters[1].Pattern)
	}
	didFilters := ops.FileOperations.DidRename.Filters
	if len(didFilters) != 2 {
		t.Fatalf("didRename filters = %d, want 2 (content files and folders, same as willRename)", len(didFilters))
	}
	if didFilters[0].Pattern.Glob != "**/*.{md,mdx}" || didFilters[0].Pattern.Matches != protocol.FileOperationPatternKindFile {
		t.Fatalf("didRename file filter = %+v, want **/*.{md,mdx} matching files", didFilters[0].Pattern)
	}
	if didFilters[1].Pattern.Glob != "**/*" || didFilters[1].Pattern.Matches != protocol.FileOperationPatternKindFolder {
		t.Fatalf("didRename folder filter = %+v, want **/* matching folders", didFilters[1].Pattern)
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

// itemFormat returns the insert text format of the completion
// item with the given label.
func itemFormat(items []protocol.CompletionItem, label string) (protocol.InsertTextFormat, bool) {
	for _, item := range items {
		if item.Label == label {
			return item.InsertTextFormat, true
		}
	}
	return 0, false
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

// docText returns the documentation text of the completion item
// with the given label.
func docText(items []protocol.CompletionItem, label string) (string, bool) {
	for _, item := range items {
		if item.Label != label {
			continue
		}
		doc, ok := item.Documentation.(*protocol.MarkupContent)
		if !ok {
			return "", false
		}
		return doc.Value, true
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

// Picking an object key with children drops the cursor onto
// the next line, indented for the first child, and pops the
// child list up on its own: the snippet is `toc:` plus a
// newline plus the child indent, with a triggerSuggest
// command. The position it lands on is the one
// TestFrontmatterCompletionIndentedLineUnderNewKey covers —
// the children are already offered there.
func TestFrontmatterCompletionObjectKeyInsertsSnippet(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nt\n---\n")
	items := s.complete(t, documentURI, 1, 1)
	edit, ok := editText(items, "toc")
	if !ok || edit != "toc:\n  $0" {
		t.Fatalf("toc edit = %q, want %q", edit, "toc:\n  $0")
	}
	format, ok := itemFormat(items, "toc")
	if !ok || format != protocol.InsertTextFormatSnippet {
		t.Fatalf("toc format = %v, want Snippet", format)
	}
	if cmd, ok := itemCommand(items, "toc"); !ok || cmd.Command != "editor.action.triggerSuggest" {
		t.Fatalf("toc command = %q, want %q", cmd.Command, "editor.action.triggerSuggest")
	}
	if rng := editRange(items, "toc"); rng.Start != (protocol.Position{Line: 1, Character: 0}) || rng.End != (protocol.Position{Line: 1, Character: 1}) {
		t.Fatalf("toc edit range = %v, want (1,0)-(1,1) covering the partial", rng)
	}
}

// A scalar key keeps the plain `key: ` insert, with no snippet
// and no triggerSuggest command.
func TestFrontmatterCompletionScalarKeyKeepsPlainInsert(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nti\n---\n")
	items := s.complete(t, documentURI, 1, 2)
	edit, ok := editText(items, "title")
	if !ok || edit != "title: " {
		t.Fatalf("title edit = %q, want %q", edit, "title: ")
	}
	if format, ok := itemFormat(items, "title"); !ok || format == protocol.InsertTextFormatSnippet {
		t.Fatalf("title format = %v, want not Snippet", format)
	}
	if cmd, ok := itemCommand(items, "title"); !ok || cmd.Command != "" {
		t.Fatalf("title command = %q, want none (a scalar key takes its value on the same line)", cmd.Command)
	}
}

// An object key with no listed children keeps the plain `key:`
// insert: there are no children to drop onto.
func TestFrontmatterCompletionObjectKeyWithoutPropertiesKeepsPlainInsert(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\n_op\n---\n")
	items := s.complete(t, documentURI, 1, 3)
	edit, ok := editText(items, "_openapi")
	if !ok || edit != "_openapi:" {
		t.Fatalf("_openapi edit = %q, want %q", edit, "_openapi:")
	}
	if format, ok := itemFormat(items, "_openapi"); !ok || format == protocol.InsertTextFormatSnippet {
		t.Fatalf("_openapi format = %v, want not Snippet", format)
	}
	if cmd, ok := itemCommand(items, "_openapi"); !ok || cmd.Command != "" {
		t.Fatalf("_openapi command = %q, want none (no children to suggest)", cmd.Command)
	}
}

// A blank line at column 0 right under a `toc:` with no children
// yet completes the toc keys, not the top-level keys — the user
// just typed `toc:` and is about to fill it in. The insert
// carries the child's indent, since the line itself was left
// unindented.
func TestFrontmatterCompletionUnindentedLineUnderNewKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\n\n---\n")
	items := s.complete(t, documentURI, 2, 0)
	if len(items) != 3 {
		t.Fatalf("completions = %v, want exactly the 3 toc children", labels(items))
	}
	for _, want := range []string{"enable", "max_level", "min_level"} {
		if !hasLabel(items, want) {
			t.Fatalf("completions %v missing %q", labels(items), want)
		}
	}
	for _, top := range []string{"title", "desc", "toc"} {
		if hasLabel(items, top) {
			t.Fatalf("completions %v include top-level key %q", labels(items), top)
		}
	}
	edit, ok := editText(items, "enable")
	if !ok || edit != "  enable: " {
		t.Fatalf("enable edit = %q, want %q (indented child)", edit, "  enable: ")
	}
	item := items[0]
	for _, it := range items {
		if it.Label == "enable" {
			item = it
		}
	}
	textEdit, ok := item.TextEdit.(*protocol.TextEdit)
	if !ok {
		t.Fatalf("enable TextEdit is %T, want *protocol.TextEdit", item.TextEdit)
	}
	if textEdit.Range.Start.Character != 0 {
		t.Fatalf("enable edit starts at char %d, want 0", textEdit.Range.Start.Character)
	}
}

// The same blank line below a `toc:` that already has children
// is a sibling line: top-level keys, not toc children.
func TestFrontmatterCompletionUnindentedLineUnderKeyWithChildren(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\n  enable: true\n\n---\n")
	items := s.complete(t, documentURI, 3, 0)
	for _, want := range []string{"title", "desc"} {
		if !hasLabel(items, want) {
			t.Fatalf("completions %v missing top-level key %q", labels(items), want)
		}
	}
	for _, child := range []string{"enable", "max_level", "min_level"} {
		if hasLabel(items, child) {
			t.Fatalf("completions %v include toc child %q", labels(items), child)
		}
	}
}

// A value-less scalar key has no children to offer: the blank
// line under `title:` falls back to the top-level keys.
func TestFrontmatterCompletionUnindentedLineUnderScalarKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle:\n\n---\n")
	items := s.complete(t, documentURI, 2, 0)
	for _, want := range []string{"desc", "toc"} {
		if !hasLabel(items, want) {
			t.Fatalf("completions %v missing top-level key %q", labels(items), want)
		}
	}
}

// A blank INDENTED line under `toc:` still completes the toc
// children, with no added indent — the line already has it.
func TestFrontmatterCompletionIndentedLineUnderNewKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\n  \n---\n")
	items := s.complete(t, documentURI, 2, 2)
	if len(items) != 3 {
		t.Fatalf("completions = %v, want exactly the 3 toc children", labels(items))
	}
	for _, want := range []string{"enable", "max_level", "min_level"} {
		if !hasLabel(items, want) {
			t.Fatalf("completions %v missing %q", labels(items), want)
		}
	}
	edit, ok := editText(items, "enable")
	if !ok || edit != "enable: " {
		t.Fatalf("enable edit = %q, want %q (no added indent)", edit, "enable: ")
	}
}

// Children typed below the blank line are still excluded from
// the orphan key's completions.
func TestFrontmatterCompletionUnindentedLineExcludesChildrenBelow(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\n\n  enable: true\n---\n")
	items := s.complete(t, documentURI, 2, 0)
	if hasLabel(items, "enable") {
		t.Fatalf("completions %v include the existing child enable", labels(items))
	}
	for _, want := range []string{"max_level", "min_level"} {
		if !hasLabel(items, want) {
			t.Fatalf("completions %v missing %q", labels(items), want)
		}
	}
}

// A PARTIAL key on a column-0 line under a fresh `toc:` completes
// the toc children too, filtered by what was typed: `en` offers
// `enable` alone, and the insert replaces the partial with the
// indented child.
func TestFrontmatterCompletionPartialKeyUnderNewKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\nen\n---\n")
	items := s.complete(t, documentURI, 2, 2)
	if len(items) != 1 || items[0].Label != "enable" {
		t.Fatalf("completions = %v, want only enable", labels(items))
	}
	edit, ok := editText(items, "enable")
	if !ok || edit != "  enable: " {
		t.Fatalf("enable edit = %q, want %q (indented child)", edit, "  enable: ")
	}
	textEdit, ok := items[0].TextEdit.(*protocol.TextEdit)
	if !ok {
		t.Fatalf("enable TextEdit is %T, want *protocol.TextEdit", items[0].TextEdit)
	}
	if textEdit.Range.Start.Character != 0 || textEdit.Range.End.Character != 2 {
		t.Fatalf("enable edit range = %v, want chars 0-2 covering the partial", textEdit.Range)
	}
}

// When the orphan resolves but no child key matches the partial,
// the list is empty — there is no fallback to top-level keys,
// which would insert a top-level key as a child of the object.
func TestFrontmatterCompletionPartialKeyWithNoMatchOffersNothing(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\nzz\n---\n")
	items := s.complete(t, documentURI, 2, 2)
	if len(items) != 0 {
		t.Fatalf("completions = %v, want none", labels(items))
	}
}

// A partial key below a `toc:` that already has children is a
// sibling line: top-level keys, not toc children.
func TestFrontmatterCompletionPartialKeyUnderKeyWithChildren(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntoc:\n  enable: true\nde\n---\n")
	items := s.complete(t, documentURI, 3, 2)
	if !hasLabel(items, "desc") {
		t.Fatalf("completions %v missing top-level key desc", labels(items))
	}
	for _, child := range []string{"enable", "max_level", "min_level"} {
		if hasLabel(items, child) {
			t.Fatalf("completions %v include toc child %q", labels(items), child)
		}
	}
}

// A partial key under a value-less scalar key falls back to the
// top-level keys, same as the blank-line case.
func TestFrontmatterCompletionPartialKeyUnderScalarKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle:\nde\n---\n")
	items := s.complete(t, documentURI, 2, 2)
	if !hasLabel(items, "desc") {
		t.Fatalf("completions %v missing top-level key desc", labels(items))
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
	if detail, ok := detailText(items, "div"); !ok || detail != "Generic container" {
		t.Fatalf("div detail = %q, want %q", detail, "Generic container")
	}
	if detail, ok := detailText(items, "br"); !ok || detail != "Line break" {
		t.Fatalf("br detail = %q, want %q", detail, "Line break")
	}
	if detail, ok := detailText(items, "button"); !ok || detail != "Clickable button" {
		t.Fatalf("button detail = %q, want %q", detail, "Clickable button")
	}
}

// TestComponentCompletionShowsDescription checks a built-in
// component's row names what it does: the Detail is the first
// sentence of its description, and the documentation leads with
// the full description before the props list.
func TestComponentCompletionShowsDescription(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	if detail, ok := detailText(items, "Btn"); !ok || detail != "Btn — the MDX content button: a link styled as a button." {
		t.Fatalf("Btn detail = %q, want the first sentence of its description", detail)
	}
	doc, ok := docText(items, "Btn")
	if !ok {
		t.Fatal("Btn has no documentation")
	}
	if !strings.HasPrefix(doc, "Btn — the MDX content button: a link styled as a button. A thin wrapper around the shared `Button`") {
		t.Fatalf("Btn doc = %q, want it to start with the full description", doc)
	}
	if !strings.Contains(doc, "Props: ") {
		t.Fatalf("Btn doc = %q, want it to keep the props list", doc)
	}
	// A component with required props shows its description, not
	// the required list, once it has one.
	if detail, ok := detailText(items, "Icon"); !ok || detail != "Icon — renders a single Iconify icon by id (md:book, fa7-solid:font, …) as inline SVG, from the site's generated icon map." {
		t.Fatalf("Icon detail = %q, want the first sentence of its description", detail)
	}
}

// TestComponentCompletionFallsBackWithoutDescription checks a
// component with no description in the schema keeps the old
// behaviour: the Detail names its required props and the
// documentation is the props list alone.
func TestComponentCompletionFallsBackWithoutDescription(t *testing.T) {
	raw := realSchema(t, schemaComponents)
	var schema map[string]any
	if err := json.Unmarshal(raw, &schema); err != nil {
		t.Fatalf("parsing the components schema: %v", err)
	}
	defs, _ := schema["definitions"].(map[string]any)
	icon, _ := defs["Icon"].(map[string]any)
	delete(icon, "description")
	stripped, err := json.Marshal(schema)
	if err != nil {
		t.Fatalf("re-encoding the components schema: %v", err)
	}

	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	installSchema(t, root, schemaFrontmatter, realSchema(t, schemaFrontmatter))
	installSchema(t, root, schemaComponents, stripped)

	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<")
	items := s.complete(t, documentURI, 2, 1)
	if detail, ok := detailText(items, "Icon"); !ok || detail != "required: id" {
		t.Fatalf("Icon detail = %q, want %q", detail, "required: id")
	}
	if doc, ok := docText(items, "Icon"); !ok || doc != "Props: className, color, id*, size" {
		t.Fatalf("Icon doc = %q, want the props list alone", doc)
	}
}

func TestFirstSentence(t *testing.T) {
	cases := []struct{ desc, want string }{
		{"One sentence.", "One sentence."},
		{"First. Second.", "First."},
		{"With `code` here. More.", "With code here."},
		{"No period", "No period"},
		{"", ""},
	}
	for _, c := range cases {
		if got := firstSentence(c.desc); got != c.want {
			t.Fatalf("firstSentence(%q) = %q, want %q", c.desc, got, c.want)
		}
	}
}

// A bare `<` offers tag names anywhere in the file, not only
// at its end: what follows the cursor (a newline, more prose)
// must not disqualify the tag the user just started.
func TestComponentCompletionBareAngleMidFile(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<\n\nMore text\n")
	items := s.complete(t, documentURI, 2, 1)
	if len(items) != 18+len(htmlTags) {
		t.Fatalf("component completions = %d, want %d (18 built-ins plus the HTML tags)", len(items), 18+len(htmlTags))
	}
	for _, want := range []string{"Btn", "Hint", "div", "span"} {
		if !hasLabel(items, want) {
			t.Fatalf("component completions %v missing %q", labels(items), want)
		}
	}
	if text, ok := editText(items, "Hint"); !ok || text != "<Hint>$0</Hint>" {
		t.Fatalf("Hint edit = %q, want %q (the whole tag, swallowing the `<`)", text, "<Hint>$0</Hint>")
	}
}

// A partial name mid-file still filters: only Hint starts with
// a capital H (HTML tag names are lowercase).
func TestComponentCompletionPartialNameMidFile(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<H\n\nMore text\n")
	items := s.complete(t, documentURI, 2, 2)
	if len(items) != 1 || items[0].Label != "Hint" {
		t.Fatalf("completions = %v, want only Hint", labels(items))
	}
}

func TestComponentCompletionBareAngleInFenceIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n```\n<\n```\n\nMore\n")
	items := s.complete(t, documentURI, 3, 1)
	if len(items) != 0 {
		t.Fatalf("completions inside a fence = %v, want none", labels(items))
	}
}

func TestComponentCompletionBareAngleInFrontmatterIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: Test\n<\n---\n\nBody\n")
	items := s.complete(t, documentURI, 2, 1)
	if len(items) != 0 {
		t.Fatalf("completions in frontmatter = %v, want none (no tag names there)", labels(items))
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
// leaf components close themselves, void HTML tags self-close.
// Every tag item is a snippet, and the edit range covers the
// `<` the user typed.
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
		"br":          "<br/>",
		"hr":          "<hr/>",
		"img":         "<img/>",
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

// The cursor right after the opening quote, with no value typed
// yet, offers every enum value: the quote is a trigger
// character, so the list pops up as soon as it is typed.
func TestComponentCompletionEnumValueAfterSingleQuote(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=''>")
	items := s.complete(t, documentURI, 2, 14)
	want := []string{"primary", "secondary", "success", "warning", "danger", "info", "ghost"}
	if len(items) != len(want) {
		t.Fatalf("completions = %v, want the %d variant values", labels(items), len(want))
	}
	for _, value := range want {
		if !hasLabel(items, value) {
			t.Fatalf("completions = %v, missing %q", labels(items), value)
		}
	}
	if text, ok := editText(items, "primary"); !ok || text != "primary" {
		t.Fatalf("primary edit = %q, want %q (bare, the quotes are there)", text, "primary")
	}
}

func TestComponentCompletionEnumValueAfterDoubleQuote(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"\">")
	items := s.complete(t, documentURI, 2, 14)
	want := []string{"primary", "secondary", "success", "warning", "danger", "info", "ghost"}
	if len(items) != len(want) {
		t.Fatalf("completions = %v, want the %d variant values", labels(items), len(want))
	}
	for _, value := range want {
		if !hasLabel(items, value) {
			t.Fatalf("completions = %v, missing %q", labels(items), value)
		}
	}
}

// A quote in plain prose asks for nothing: every quote is a
// trigger now, so the empty path has to stay quiet.
func TestComponentCompletionQuoteInProseIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\nIt's a test")
	items := s.complete(t, documentURI, 2, 3)
	if len(items) != 0 {
		t.Fatalf("completions after an apostrophe = %v, want none", labels(items))
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
