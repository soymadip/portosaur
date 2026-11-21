package main

import (
	"context"
	"log"
	"os"
	"sync/atomic"
	"time"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// Server is the Portosaur language server. It embeds
// protocol.UnimplementedServer so methods it does not implement yet
// answer with a method-not-found error instead of breaking the
// connection.
type Server struct {
	protocol.UnimplementedServer

	client    protocol.Client
	documents *documentStore
	detector  *projectDetector
	resolver  *schemaResolver
	pages     *pageIndexCache

	shutdownReceived atomic.Bool
}

func newServer() *Server {
	s := &Server{documents: newDocumentStore(), detector: newProjectDetector(""), pages: newPageIndexCache()}
	s.resolver = newSchemaResolver(s.fatal)
	return s
}

// setClient wires the client side of the connection in, after the
// server is created. Notifications and fatal messages need it.
func (s *Server) setClient(client protocol.Client) {
	s.client = client
}

// fatal tells the user why the server cannot continue, then exits
// non-zero. It is the end of the road when no schema source works.
func (s *Server) fatal(message string) {
	log.Print(message)
	if s.client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.client.ShowMessage(ctx, &protocol.ShowMessageParams{
			Type:    protocol.MessageTypeError,
			Message: message,
		})
	}
	os.Exit(1)
}

// Initialize advertises what the server can do and records the
// workspace root, which bounds project detection.
func (s *Server) Initialize(_ context.Context, params *protocol.InitializeParams) (*protocol.InitializeResult, error) {
	if params.RootURI != nil {
		s.detector = newProjectDetector(fsPath(*params.RootURI))
	} else if folders, ok := params.WorkspaceFolders.Get(); ok && len(folders) > 0 {
		s.detector = newProjectDetector(fsPath(uri.URI(folders[0].URI)))
	}
	// Document links are computed fully up front, so there is
	// no resolve step.
	resolveProvider := false
	return &protocol.InitializeResult{
		Capabilities: protocol.ServerCapabilities{
			TextDocumentSync: protocol.TextDocumentSyncKindFull,
			CompletionProvider: &protocol.CompletionOptions{
				TriggerCharacters: []string{":", "<", "=", ".", "(", "/"},
			},
			HoverProvider:      protocol.Boolean(true),
			InlayHintProvider:  protocol.Boolean(true),
			DefinitionProvider: protocol.Boolean(true),
			DocumentLinkProvider: &protocol.DocumentLinkOptions{
				ResolveProvider: &resolveProvider,
			},
			CodeActionProvider: &protocol.CodeActionOptions{
				CodeActionKinds: []protocol.CodeActionKind{protocol.CodeActionKindQuickFix},
			},
			DocumentSymbolProvider: protocol.Boolean(true),
			DocumentOnTypeFormattingProvider: protocol.DocumentOnTypeFormattingOptions{
				FirstTriggerCharacter: "\n",
			},
		},
		ServerInfo: protocol.ServerInfo{
			Name:    "porto-lsp",
			Version: protocol.NewOptional(version),
		},
	}, nil
}

// DidOpen stores the document and publishes its diagnostics.
func (s *Server) DidOpen(_ context.Context, params *protocol.DidOpenTextDocumentParams) error {
	s.documents.open(params.TextDocument.URI, params.TextDocument.Text)
	s.invalidatePages(params.TextDocument.URI)
	s.publishDiagnostics(params.TextDocument.URI)
	return nil
}

// invalidatePages drops the cached page index for the project
// a document belongs to, so a link target added, renamed, or
// re-slugged in it resolves fresh. Only content files matter.
func (s *Server) invalidatePages(documentURI uri.URI) {
	if !isContentFile(uriPath(documentURI)) {
		return
	}
	if root, ok := s.projectFor(documentURI); ok {
		s.pages.invalidate(root)
	}
}

// DidChange replaces the document's text (full sync) and
// republishes its diagnostics.
func (s *Server) DidChange(_ context.Context, params *protocol.DidChangeTextDocumentParams) error {
	text := ""
	found := false
	for _, change := range params.ContentChanges {
		if whole, ok := change.(*protocol.TextDocumentContentChangeWholeDocument); ok {
			text = whole.Text
			found = true
		}
	}
	if !found {
		return nil
	}
	s.documents.change(params.TextDocument.URI, text)
	s.invalidatePages(params.TextDocument.URI)
	s.publishDiagnostics(params.TextDocument.URI)
	return nil
}

// DidClose forgets the document and clears its diagnostics.
func (s *Server) DidClose(_ context.Context, params *protocol.DidCloseTextDocumentParams) error {
	s.documents.close(params.TextDocument.URI)
	s.invalidatePages(params.TextDocument.URI)
	s.sendDiagnostics(params.TextDocument.URI, nil)
	return nil
}

// Shutdown records that the editor asked us to shut down. The
// process exits when the exit notification arrives.
func (s *Server) Shutdown(_ context.Context) error {
	s.shutdownReceived.Store(true)
	return nil
}

// Exit ends the process. The LSP spec wants exit code 0 when a
// shutdown came first, 1 when it did not.
func (s *Server) Exit(_ context.Context) error {
	if s.shutdownReceived.Load() {
		os.Exit(0)
	}
	os.Exit(1)
	return nil
}
