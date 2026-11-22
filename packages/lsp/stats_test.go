package main

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"go.lsp.dev/jsonrpc2"
)

func TestServerStatsReturnsMemory(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	// The params object must be present, even empty: the
	// protocol handler decodes params before routing, and a
	// request with no params field fails that decode.
	result, err := s.server.Request(context.Background(), "portosaur/serverStats", map[string]any{})
	if err != nil {
		t.Fatalf("serverStats: %v", err)
	}
	// The result comes back as untyped JSON: round-trip it into
	// the stats shape to read the number.
	raw, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("marshalling the stats result: %v", err)
	}
	var stats serverStats
	if err := json.Unmarshal(raw, &stats); err != nil {
		t.Fatalf("decoding the stats result %s: %v", raw, err)
	}
	if stats.MemoryBytes == 0 {
		t.Fatal("memoryBytes = 0, want the server's memory use")
	}
}

// An unknown custom method still answers method-not-found, the
// same as before the stats request existed.
func TestServerStatsUnknownMethodIsNotFound(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	_, err := s.server.Request(context.Background(), "portosaur/nope", map[string]any{})
	if !errors.Is(err, jsonrpc2.ErrMethodNotFound) {
		t.Fatalf("unknown custom method error = %v, want method-not-found", err)
	}
}
