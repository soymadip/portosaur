package main

import (
	"fmt"
	"regexp"
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

// braceRef is one `{kind.name}` occurrence in the MDX body:
// the captured name and the byte offsets of the whole `{...}`
// form, so the range can cover the occurrence.
type braceRef struct {
	name  string
	start int
	end   int
}

// scanBraceRefs finds every reference matching braceRe in the
// MDX body. Text, inline code, fenced code blocks, link and
// image URLs, and MDX expressions are all plain `{...}` in the
// source, so one raw-text scan covers every position the build
// substitutes. Frontmatter is skipped (the definitions live
// there), and so is the `{{...}}` escape form, which renders
// literally. An unclosed frontmatter block cannot be told apart
// from the prose below it, so nothing is scanned.
func scanBraceRefs(text string, braceRe, escapeRe *regexp.Regexp) []braceRef {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		for i := 0; i <= block.endLine; i++ {
			contentStart += len(lines[i]) + 1
		}
	}
	if contentStart > len(text) {
		return nil
	}
	body := text[contentStart:]
	escapes := escapeRe.FindAllStringIndex(body, -1)
	var refs []braceRef
	for _, match := range braceRe.FindAllStringSubmatchIndex(body, -1) {
		start, end := match[0], match[1]
		escaped := false
		for _, esc := range escapes {
			if start < esc[1] && end > esc[0] {
				escaped = true
				break
			}
		}
		if escaped {
			continue
		}
		refs = append(refs, braceRef{
			name:  body[match[2]:match[3]],
			start: contentStart + start,
			end:   contentStart + end,
		})
	}
	return refs
}

// varsRef is one `{vars.path}` occurrence in the MDX body: the
// dot path after `vars.` and the byte offsets of the whole
// `{...}` form, so the range can cover the occurrence.
type varsRef struct {
	path  string
	start int
	end   int
}

// The build's patterns from remarkVars.ts: a reference, and the
// double-brace escape form that renders literally.
var varsBraceRe = regexp.MustCompile(`\{vars\.([a-zA-Z_][a-zA-Z0-9_.]*)\}`)
var varsEscapeRe = regexp.MustCompile(`\{\{vars\.([a-zA-Z_][a-zA-Z0-9_.]*)\}\}`)

// scanVarsRefs finds every `{vars.path}` reference in the MDX
// body.
func scanVarsRefs(text string) []varsRef {
	var refs []varsRef
	for _, ref := range scanBraceRefs(text, varsBraceRe, varsEscapeRe) {
		refs = append(refs, varsRef{path: ref.name, start: ref.start, end: ref.end})
	}
	return refs
}

// envRef is one `{env.VAR}` occurrence in the MDX body: the var
// name after `env.` and the byte offsets of the whole `{...}`
// form, so the range can cover the occurrence.
type envRef struct {
	name  string
	start int
	end   int
}

// The build's patterns from remarkVars.ts: a reference, and the
// double-brace escape form that renders literally. Env names
// have no dots.
var envBraceRe = regexp.MustCompile(`\{env\.([a-zA-Z_][a-zA-Z0-9_]*)\}`)
var envEscapeRe = regexp.MustCompile(`\{\{env\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}`)

// scanEnvRefs finds every `{env.VAR}` reference in the MDX body.
func scanEnvRefs(text string) []envRef {
	var refs []envRef
	for _, ref := range scanBraceRefs(text, envBraceRe, envEscapeRe) {
		refs = append(refs, envRef{name: ref.name, start: ref.start, end: ref.end})
	}
	return refs
}

// resolveVarsValue reports the value a dot path resolves to,
// when the build can substitute it: the full path must exist in
// the vars map and end in a string or a number, mirroring
// resolveVarPath in remarkVars.ts. A path ending in a nested
// map, a boolean, a list, or a null is unresolved, just as the
// build treats it.
func resolveVarsValue(vars map[string]any, path string) (any, bool) {
	var current any = vars
	for _, key := range strings.Split(path, ".") {
		node, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = node[key]
		if !ok {
			return nil, false
		}
	}
	switch current.(type) {
	case string, int, int64, uint64, float64, float32:
		return current, true
	default:
		return nil, false
	}
}

// resolveVarsPath reports whether a dot path resolves to a value
// the build can substitute.
func resolveVarsPath(vars map[string]any, path string) bool {
	_, ok := resolveVarsValue(vars, path)
	return ok
}
