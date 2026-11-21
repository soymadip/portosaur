package main

import (
	"context"
	"strings"
	"time"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// DocumentLink returns every clickable link in the document:
// markdown links and images, and Link/Btn `to`/`href` values.
// An internal link targets its file, an external link targets
// its own URL, and a link that points nowhere gets no document
// link — there is nothing to open. The range covers the
// destination text, like the diagnostic and go-to-definition
// ranges.
func (s *Server) DocumentLink(_ context.Context, params *protocol.DocumentLinkParams) ([]protocol.DocumentLink, error) {
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
	currentFile := uriPath(params.TextDocument.URI)
	lines := strings.Split(text, "\n")
	var links []protocol.DocumentLink
	for _, dest := range scanMarkdownLinks(text) {
		if target, ok := s.linkTargetURI(root, currentFile, dest.value); ok {
			links = append(links, protocol.DocumentLink{
				Range:  rangeFromOffsets(lines, dest.start, dest.end),
				Target: target,
			})
		}
	}
	for _, dest := range scanMarkdownImages(text) {
		if target, ok := s.imageTargetURI(root, currentFile, dest.value); ok {
			links = append(links, protocol.DocumentLink{
				Range:  rangeFromOffsets(lines, dest.start, dest.end),
				Target: target,
			})
		}
	}
	for _, tag := range scanAllTags(text) {
		if tag.name != "Link" && tag.name != "Btn" {
			continue
		}
		for _, prop := range tag.props {
			if !linkProps[prop.name] || !prop.hasValue || prop.expr {
				continue
			}
			value := text[prop.valueStart:prop.valueEnd]
			if target, ok := s.linkTargetURI(root, currentFile, value); ok {
				links = append(links, protocol.DocumentLink{
					Range:  rangeFromOffsets(lines, prop.valueStart, prop.valueEnd),
					Target: target,
				})
			}
		}
	}
	return links, nil
}

// linkTargetURI turns a link destination into the URI a
// document link opens: an external URL targets itself, a clean
// URL or relative path targets its file through resolveLink. A
// destination that points nowhere, a bare `#hash`, or one
// holding a `{vars.}` or `{env.}` expression gets no target.
// The `#hash` is dropped before resolving: the target is the
// file, not the heading.
func (s *Server) linkTargetURI(root, currentFile, value string) (*uri.URI, bool) {
	if strings.Contains(value, "{vars.") || strings.Contains(value, "{env.") {
		return nil, false
	}
	if target, ok := externalTarget(value); ok {
		return target, true
	}
	path, _, _ := strings.Cut(value, "#")
	if path == "" {
		// A bare `#hash` points at this document: already open,
		// nothing to click to.
		return nil, false
	}
	target, ok := s.resolveLink(root, currentFile, path)
	if !ok {
		return nil, false
	}
	targetURI := uri.File(target.file)
	return &targetURI, true
}

// imageTargetURI turns an image src into the URI a document
// link opens: an external URL targets itself, a relative src
// targets its file, an absolute src targets its file under the
// project's `static/` directory. A src that points nowhere, or
// one holding a `{vars.}` or `{env.}` expression, gets no
// target.
func (s *Server) imageTargetURI(root, currentFile, value string) (*uri.URI, bool) {
	if strings.Contains(value, "{vars.") || strings.Contains(value, "{env.") {
		return nil, false
	}
	if target, ok := externalTarget(value); ok {
		return target, true
	}
	file, ok := resolveImage(root, currentFile, value)
	if !ok {
		return nil, false
	}
	targetURI := uri.File(file)
	return &targetURI, true
}

// externalTarget returns the URL itself as the target for an
// external http(s) destination.
func externalTarget(value string) (*uri.URI, bool) {
	if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
		return nil, false
	}
	target, err := uri.Parse(value)
	if err != nil {
		return nil, false
	}
	return &target, true
}
