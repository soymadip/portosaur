// Command porto-lsp is the Portosaur language server. It speaks LSP
// over stdio and serves completions, hover and diagnostics for
// MDX frontmatter and components. porto.yml is left to the YAML
// extension, which reads the $schema line at the top of the file.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"go.lsp.dev/jsonrpc2"
	"go.lsp.dev/protocol"
)

// version is the server version, set by GoReleaser at release time.
var version = "dev"

// stdioConn adapts os.Stdin/os.Stdout to the io.ReadWriteCloser the
// LSP stream wants. Logs must never go to stdout: stdout is the
// LSP channel.
type stdioConn struct{}

func (stdioConn) Read(p []byte) (int, error)  { return os.Stdin.Read(p) }
func (stdioConn) Write(p []byte) (int, error) { return os.Stdout.Write(p) }
func (stdioConn) Close() error                { return nil }

func main() {
	var (
		showVersion bool
		stdio       bool
		logPath     string
	)
	flag.BoolVar(&showVersion, "version", false, "print the version and exit")
	flag.BoolVar(&stdio, "stdio", false, "speak LSP over stdio (the only transport)")
	flag.StringVar(&logPath, "log", "", "write logs to this file instead of stderr")
	flag.Parse()

	if showVersion {
		fmt.Println(version)
		return
	}
	_ = stdio // stdio is the only transport; the flag exists for the editors

	if logPath != "" {
		f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			fmt.Fprintf(os.Stderr, "porto-lsp: cannot open log file: %v\n", err)
			os.Exit(1)
		}
		defer f.Close()
		log.SetOutput(f)
	}

	server := newServer()
	stream := jsonrpc2.NewStream(stdioConn{})
	ctx := context.Background()
	// NewServer starts the connection's read loop itself; calling
	// conn.Go again would start a second reader on the same
	// stream and corrupt the framing.
	ctx, conn, client := protocol.NewServer(ctx, server, stream)
	server.setClient(client)
	<-conn.Done()
	if err := conn.Err(); err != nil {
		log.Printf("porto-lsp: connection ended: %v", err)
	}
}
