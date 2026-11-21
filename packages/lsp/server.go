package main

import (
	"context"
	"os"
	"sync/atomic"

	"go.lsp.dev/protocol"
)

// Server is the Portosaur language server. It embeds
// protocol.UnimplementedServer so methods it does not implement yet
// answer with a method-not-found error instead of breaking the
// connection.
type Server struct {
	protocol.UnimplementedServer

	shutdownReceived atomic.Bool
}

// Initialize advertises what the server can do.
func (s *Server) Initialize(_ context.Context, _ *protocol.InitializeParams) (*protocol.InitializeResult, error) {
	return &protocol.InitializeResult{
		Capabilities: protocol.ServerCapabilities{
			CompletionProvider: &protocol.CompletionOptions{},
		},
		ServerInfo: protocol.ServerInfo{
			Name:    "porto-lsp",
			Version: protocol.NewOptional(version),
		},
	}, nil
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

// Completion answers with one hardcoded item for now. Phase 2
// replaces this with schema-driven completions.
func (s *Server) Completion(_ context.Context, _ *protocol.CompletionParams) (protocol.CompletionResult, error) {
	return &protocol.CompletionList{
		Items: []protocol.CompletionItem{
			{
				Label:  "site",
				Kind:   protocol.CompletionItemKindProperty,
				Detail: protocol.NewOptional("Portosaur site settings"),
			},
		},
	}, nil
}
