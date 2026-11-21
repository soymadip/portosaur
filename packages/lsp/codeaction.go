package main

import (
	"context"
	"strings"
	"time"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// Code actions: quick fixes for the diagnostics in the requested
// range. The fixes are recomputed from the document at request
// time — the same validation the diagnostics use, run fresh —
// never from stored diagnostics. An enum mismatch offers one
// action per valid value, an unknown frontmatter key offers its
// removal (only when the value is a single-line scalar, so the
// whole line can go safely), and a missing required prop offers
// its insertion.

// CodeAction answers textDocument/codeAction.
func (s *Server) CodeAction(_ context.Context, params *protocol.CodeActionParams) ([]protocol.CommandOrCodeAction, error) {
	if !wantsQuickFix(params.Context.Only) {
		return nil, nil
	}
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
	var actions []protocol.CommandOrCodeAction
	lines := strings.Split(text, "\n")
	if block, ok := extractFrontmatter(text); ok && block.closed {
		for _, issue := range s.frontmatterIssues(block, root) {
			if !rangesOverlap(issue.diag.Range, params.Range) {
				continue
			}
			for _, value := range issue.enum {
				actions = append(actions, quickFixAction(
					"Change to '"+value+"'",
					issue.diag,
					params.TextDocument.URI,
					protocol.TextEdit{Range: issue.diag.Range, NewText: yamlQuote(value)},
				))
			}
			if issue.unknownKey != "" && issue.unknownScalar {
				actions = append(actions, quickFixAction(
					"Remove unknown key",
					issue.diag,
					params.TextDocument.URI,
					protocol.TextEdit{Range: lineRange(lines, int(issue.diag.Range.Start.Line)), NewText: ""},
				))
			}
		}
	}
	for _, issue := range s.componentIssues(text, root) {
		if !rangesOverlap(issue.diag.Range, params.Range) {
			continue
		}
		for _, value := range issue.enum {
			actions = append(actions, quickFixAction(
				"Change to '"+value+"'",
				issue.diag,
				params.TextDocument.URI,
				protocol.TextEdit{Range: issue.diag.Range, NewText: value},
			))
		}
		if issue.missingProp != "" {
			actions = append(actions, quickFixAction(
				"Add missing prop '"+issue.missingProp+"'",
				issue.diag,
				params.TextDocument.URI,
				protocol.TextEdit{
					Range:   protocol.Range{Start: issue.insert, End: issue.insert},
					NewText: " " + issue.missingProp + `=""`,
				},
			))
		}
	}
	return actions, nil
}

// wantsQuickFix reports whether the client's requested kinds
// include quick fixes. An empty list means all kinds.
func wantsQuickFix(only []protocol.CodeActionKind) bool {
	if len(only) == 0 {
		return true
	}
	for _, kind := range only {
		if kind == protocol.CodeActionKindQuickFix || kind == protocol.CodeActionKindEmpty {
			return true
		}
	}
	return false
}

// quickFixAction builds one quick-fix action performing a single
// edit in the document.
func quickFixAction(title string, diag protocol.Diagnostic, documentURI uri.URI, edit protocol.TextEdit) *protocol.CodeAction {
	kind := protocol.CodeActionKindQuickFix
	return &protocol.CodeAction{
		Title:       title,
		Kind:        &kind,
		Diagnostics: []protocol.Diagnostic{diag},
		Edit: &protocol.WorkspaceEdit{
			Changes: map[uri.URI][]protocol.TextEdit{documentURI: {edit}},
		},
	}
}

// rangesOverlap reports whether two ranges intersect. An empty
// range is a point: it overlaps when it sits inside the other
// range, inclusive of the ends.
func rangesOverlap(a, b protocol.Range) bool {
	return comparePosition(a.Start, b.End) <= 0 && comparePosition(b.Start, a.End) <= 0
}

func comparePosition(a, b protocol.Position) int {
	if a.Line != b.Line {
		if a.Line < b.Line {
			return -1
		}
		return 1
	}
	if a.Character != b.Character {
		if a.Character < b.Character {
			return -1
		}
		return 1
	}
	return 0
}

// lineRange is the range of a whole line including its newline
// (or to the end of the document for the last line).
func lineRange(lines []string, lineNo int) protocol.Range {
	start := protocol.Position{Line: uint32(lineNo)}
	if lineNo+1 < len(lines) {
		return protocol.Range{Start: start, End: protocol.Position{Line: uint32(lineNo + 1)}}
	}
	return protocol.Range{
		Start: start,
		End:   protocol.Position{Line: uint32(lineNo), Character: byteToUTF16(lines[lineNo], len(lines[lineNo]))},
	}
}
