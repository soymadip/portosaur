package main

import (
	"context"
	"testing"

	"go.lsp.dev/jsonrpc2"
	"go.lsp.dev/protocol"
)

// testClient answers the server's calls back to the editor. The
// spike server makes none, so the defaults are enough.
type testClient struct {
	protocol.UnimplementedClient
}

// TestCompletion wires the server to a client over an in-memory
// channel and checks the one hardcoded completion comes back.
func TestCompletion(t *testing.T) {
	ctx := context.Background()
	left, right := jsonrpc2.NewChannelStreamPair(0)

	_, serverConn, _ := protocol.NewServer(ctx, &Server{}, left)
	serverConn.Go(ctx, protocol.ServerHandler(&Server{}, jsonrpc2.MethodNotFoundHandler))

	_, clientConn, server := protocol.NewClient(ctx, &testClient{}, right)
	clientConn.Go(ctx, protocol.ClientHandler(&testClient{}, jsonrpc2.MethodNotFoundHandler))

	result, err := server.Initialize(ctx, &protocol.InitializeParams{})
	if err != nil {
		t.Fatalf("initialize: %v", err)
	}
	if result.Capabilities.CompletionProvider == nil {
		t.Fatal("initialize: no completion provider advertised")
	}

	completed, err := server.Completion(ctx, &protocol.CompletionParams{
		TextDocumentPositionParams: protocol.TextDocumentPositionParams{
			TextDocument: protocol.TextDocumentIdentifier{
				URI: "file:///site/porto.yml",
			},
			Position: protocol.Position{Line: 0, Character: 0},
		},
	})
	if err != nil {
		t.Fatalf("completion: %v", err)
	}
	list, ok := completed.(*protocol.CompletionList)
	if !ok {
		t.Fatalf("completion: got %T, want *protocol.CompletionList", completed)
	}
	if len(list.Items) != 1 || list.Items[0].Label != "site" {
		t.Fatalf("completion: got %+v, want one item labelled site", list.Items)
	}
}
