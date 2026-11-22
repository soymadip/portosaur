package main

import (
	"context"
	"runtime"
)

// serverStats is the answer to the portosaur/serverStats
// request: the server's own memory use, for the VS Code
// server menu. RAM only, by design.
type serverStats struct {
	MemoryBytes uint64 `json:"memoryBytes"`
}

// Request answers custom (non-standard LSP) requests. The
// protocol handler routes any method it does not know to this
// method, so portosaur/serverStats needs no connection-level
// interception. Anything else falls through to the embedded
// UnimplementedServer, which answers method-not-found.
//
// Callers must send a params object, even an empty one: the
// handler decodes the params before routing, and a request
// with no params field fails that decode.
func (s *Server) Request(ctx context.Context, method string, params any) (any, error) {
	if method != "portosaur/serverStats" {
		return s.UnimplementedServer.Request(ctx, method, params)
	}
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	// Sys is the total memory the runtime has obtained from the
	// OS — the closest number to what a task manager shows.
	return serverStats{MemoryBytes: mem.Sys}, nil
}
