package main

import (
	"fmt"
	"sort"
	"strings"

	"go.lsp.dev/protocol"
)

// `{vars.}` completion: inside an MDX `{...}` expression, after
// `{` the server offers `vars`, and after each `.` the keys of
// the `vars:` section from the project's porto.yml, nested per
// `.`. The config is read fresh on each request: one small file,
// always correct, no cache staleness.

// varsContext describes the `{...}` expression the cursor sits
// inside.
type varsContext struct {
	found        bool
	offeringVars bool     // offering the `vars` name itself (after `{` or a prefix of it)
	path         []string // completed segments after `vars` (e.g. ["project"])
	partial      string   // the segment being typed
	partialRange protocol.Range
}

func isVarsSegmentChar(c byte) bool {
	return c == '_' || c == '-' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

// scanVarsExpr finds the `{...}` expression the cursor sits
// inside, when it is a `vars` expression (or a prefix of one).
// Expressions in fenced code, the frontmatter, an inline code
// span, or a quoted prop value are not expressions.
func scanVarsExpr(text string, pos protocol.Position) varsContext {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return varsContext{}
		}
		contentStart = block.endLine + 1
	}
	lineNo := int(pos.Line)
	if lineNo < contentStart || lineNo >= len(lines) {
		return varsContext{}
	}
	if fenceLines(lines, contentStart)[lineNo] {
		return varsContext{}
	}
	line := lines[lineNo]
	cursor := utf16ToByte(line, pos.Character)
	if tag := scanTag(text, pos); tag.found && tag.kind == tagValue && tag.quoted {
		return varsContext{}
	}
	open := strings.LastIndex(line[:cursor], "{")
	if open < 0 {
		return varsContext{}
	}
	if strings.Contains(line[open+1:cursor], "}") {
		return varsContext{}
	}
	if inCodeSpan(codeSpanRanges(line), open) {
		return varsContext{}
	}
	exprStart := open + 1
	for exprStart < cursor && (line[exprStart] == ' ' || line[exprStart] == '\t') {
		exprStart++
	}
	rest := line[exprStart:cursor]
	lineStart := 0
	for i := 0; i < lineNo; i++ {
		lineStart += len(lines[i]) + 1
	}
	if rest == "" {
		return varsContext{
			found:        true,
			offeringVars: true,
			partialRange: rangeFromOffsets(lines, lineStart+cursor, lineStart+cursor),
		}
	}
	segments := strings.Split(rest, ".")
	for _, segment := range segments {
		for i := 0; i < len(segment); i++ {
			if !isVarsSegmentChar(segment[i]) {
				return varsContext{}
			}
		}
	}
	first := segments[0]
	if len(segments) == 1 {
		if first == "vars" {
			// A bare `vars` is complete: nothing to offer
			// until the dot.
			return varsContext{}
		}
		if strings.HasPrefix("vars", first) {
			return varsContext{
				found:        true,
				offeringVars: true,
				partial:      first,
				partialRange: rangeFromOffsets(lines, lineStart+exprStart, lineStart+cursor),
			}
		}
		return varsContext{}
	}
	if first != "vars" {
		return varsContext{}
	}
	path := segments[1 : len(segments)-1]
	for _, segment := range path {
		if segment == "" {
			return varsContext{}
		}
	}
	partial := segments[len(segments)-1]
	return varsContext{
		found:        true,
		path:         path,
		partial:      partial,
		partialRange: rangeFromOffsets(lines, lineStart+cursor-len(partial), lineStart+cursor),
	}
}

// varsCompletion offers `vars` or the keys of the `vars:`
// section at the cursor. The second return value reports
// whether the cursor is in a vars expression at all: when it is
// not, the caller falls through to component completion.
func (s *Server) varsCompletion(params *protocol.CompletionParams, text string, root string) (*protocol.CompletionList, bool) {
	context := scanVarsExpr(text, params.Position)
	if !context.found {
		return nil, false
	}
	if context.offeringVars {
		item := protocol.CompletionItem{
			Label:    "vars",
			Kind:     protocol.CompletionItemKindVariable,
			Detail:   protocol.NewOptional("values from the vars: section of porto.yml"),
			TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: "vars"},
		}
		return &protocol.CompletionList{IsIncomplete: false, Items: []protocol.CompletionItem{item}}, true
	}
	cfg := loadProjectConfig(root)
	node, _ := cfg["vars"].(map[string]any)
	for _, segment := range context.path {
		next, ok := node[segment].(map[string]any)
		if !ok {
			return &protocol.CompletionList{}, true
		}
		node = next
	}
	if node == nil {
		return &protocol.CompletionList{}, true
	}
	var items []protocol.CompletionItem
	for name, value := range node {
		if !strings.HasPrefix(name, context.partial) {
			continue
		}
		item := protocol.CompletionItem{
			Label:    name,
			Kind:     protocol.CompletionItemKindVariable,
			Detail:   protocol.NewOptional(varsDetail(value)),
			TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: name},
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}, true
}

// varsDetail previews a vars value: the value itself for a
// scalar, "object" for a nested map.
func varsDetail(value any) string {
	if _, ok := value.(map[string]any); ok {
		return "object"
	}
	preview := fmt.Sprintf("%v", value)
	if len(preview) > 40 {
		preview = preview[:37] + "..."
	}
	return preview
}
