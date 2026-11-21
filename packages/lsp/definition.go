package main

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// Go-to-definition for links: a markdown link destination or a
// Link/Btn `to`/`href` value jumps to the target page file. A
// `#hash` jumps to the matching heading line when one exists,
// and to the file top otherwise.

// Definition answers textDocument/definition for link
// destinations. A document outside a project, or a cursor that
// is not on a link, gets no definition.
func (s *Server) Definition(_ context.Context, params *protocol.DefinitionParams) (protocol.DefinitionResult, error) {
	text, ok := s.documents.waitFor(params.TextDocument.URI, 100*time.Millisecond)
	if !ok {
		return nil, nil
	}
	if !isMDXFile(params.TextDocument.URI) {
		return nil, nil
	}
	root, ok := s.projectFor(params.TextDocument.URI)
	if !ok {
		return nil, nil
	}
	link := linkAtCursor(text, params.Position)
	if !link.found || link.value == "" {
		return nil, nil
	}
	target, ok := s.resolveLink(root, uriPath(params.TextDocument.URI), link.value)
	if !ok {
		return nil, nil
	}
	at := protocol.Position{Line: uint32(target.line)}
	location := protocol.Location{
		URI:   uri.File(target.file),
		Range: protocol.Range{Start: at, End: at},
	}
	return protocol.LocationSlice{location}, nil
}

// linkTarget is a resolved link destination: the file and the
// 0-based line to land on.
type linkTarget struct {
	file string
	line int
}

// resolveLink turns a link destination into a file (and heading
// line). Clean URLs resolve through the page index, relative
// file paths against the current file's directory, and a bare
// `#hash` against the current file. Anything else (an external
// URL, a bare word) has no target here.
func (s *Server) resolveLink(root, currentFile, value string) (linkTarget, bool) {
	path, hash, hasHash := strings.Cut(value, "#")
	var file string
	switch {
	case path == "":
		file = currentFile
	case strings.HasPrefix(path, "."):
		decoded, err := url.PathUnescape(path)
		if err != nil {
			decoded = path
		}
		file = filepath.Join(filepath.Dir(currentFile), decoded)
		if !isContentFile(file) {
			return linkTarget{}, false
		}
		if _, err := os.Stat(file); err != nil {
			return linkTarget{}, false
		}
	case strings.HasPrefix(path, "/"):
		var ok bool
		file, ok = s.pages.forRoot(root).lookup(path)
		if !ok {
			return linkTarget{}, false
		}
	default:
		return linkTarget{}, false
	}
	line := 0
	if hasHash && hash != "" {
		for _, heading := range extractHeadings(s.targetText(file)) {
			if heading.id == hash {
				line = heading.line
				break
			}
		}
	}
	return linkTarget{file: file, line: line}, true
}

// linkBroken reports whether a link destination points
// nowhere: a clean URL no page serves, or a relative file path
// with no file behind it. It mirrors resolveLink's branches:
// the `#hash` is stripped and never validated, external URLs,
// protocol-relative URLs, and bare words are not checked, and
// a destination holding a `{vars.}` or `{env.}` expression
// resolves at build time, so it cannot be checked statically.
// The site root `/` always exists. Unlike resolveLink, a
// relative path only needs to exist on disk — a link to an
// asset like `./file.pdf` is fine, it just has no definition to
// jump to.
func (s *Server) linkBroken(root, currentFile, value string) bool {
	if strings.Contains(value, "{vars.") || strings.Contains(value, "{env.") {
		return false
	}
	path, _, _ := strings.Cut(value, "#")
	switch {
	case path == "":
		return false
	case strings.HasPrefix(path, "//"):
		return false
	case strings.HasPrefix(path, "."):
		decoded, err := url.PathUnescape(path)
		if err != nil {
			decoded = path
		}
		_, err = os.Stat(filepath.Join(filepath.Dir(currentFile), decoded))
		return err != nil
	case strings.HasPrefix(path, "/"):
		if path == "/" {
			return false
		}
		_, ok := s.pages.forRoot(root).lookup(path)
		return !ok
	default:
		return false
	}
}

// targetText reads a link target's text, preferring the open
// document when the file is open in the editor (so unsaved edits
// count for the heading lookup).
func (s *Server) targetText(file string) string {
	if text, ok := s.documents.get(uri.File(file)); ok {
		return text
	}
	raw, err := os.ReadFile(file)
	if err != nil {
		return ""
	}
	return string(raw)
}
