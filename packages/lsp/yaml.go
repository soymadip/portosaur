package main

import (
	"io"
	"regexp"
	"strings"

	"go.lsp.dev/protocol"
	"gopkg.in/yaml.v3"
)

// YAML handling for the editor features. Completion and hover work
// off the lines: YAML's structure is its indentation, so the path
// to the cursor comes from the key lines above it. That keeps
// working on half-typed documents the parser would reject. The
// node tree is only used to point diagnostics at the right lines.

type cursorKind int

const (
	cursorNone  cursorKind = iota // inside a list item, or nothing to complete
	cursorKey                     // completing a key name
	cursorValue                   // completing a value
)

type cursorContext struct {
	kind         cursorKind
	path         []string // schema path to the enclosing mapping
	key          string   // cursorValue only: the key being valued
	partial      string   // text typed so far (key prefix or value prefix)
	partialRange protocol.Range
	existingKeys map[string]bool
	// orphanPath is the schema path to a value-less key directly
	// above a blank or partial-key cursor line, when the key has
	// no children yet: the cursor is about to type its first
	// child. Set only when the key sits at or above the cursor's
	// indent — an indented line already finds the key through
	// the enclosing path. The completion side uses it only when
	// it resolves to an object with properties.
	orphanPath []string
	// orphanKeys are the keys already present in the orphan
	// key's mapping: children typed below the cursor line.
	orphanKeys map[string]bool
	// orphanIndent is the indent the orphan key's children take:
	// the key's indent plus two spaces.
	orphanIndent int
	// lineIndent is the cursor line's own indent in spaces: the
	// leading whitespace of a partial-key line, or the cursor
	// column of a blank line (where the editor's auto-indent
	// puts it). Key context only.
	lineIndent int
}

// A `key:` line, plain or quoted, with its indent and the rest of
// the line after the colon.
var keyLineRe = regexp.MustCompile(`^([ \t]*)(?:([\w.-]+)|"([^"]+)"|'([^']+)')[ \t]*:(.*)$`)

// A partial key name: letters, digits, and underscores, with no
// colon yet.
var partialKeyRe = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

func keyOf(match []string) string {
	for _, group := range match[2:5] {
		if group != "" {
			return group
		}
	}
	return ""
}

// utf16ToByte converts an LSP character offset (UTF-16 code units)
// into a byte offset in the line.
func utf16ToByte(line string, utf16col uint32) int {
	units := uint32(0)
	for i, r := range line {
		if units >= utf16col {
			return i
		}
		if r > 0xFFFF {
			units += 2
		} else {
			units++
		}
	}
	return len(line)
}

// runeToUTF16 converts a 0-based rune offset in the line into an
// LSP character offset. yaml.v3 columns are rune offsets.
func runeToUTF16(line string, runeCol int) uint32 {
	units := uint32(0)
	n := 0
	for _, r := range line {
		if n >= runeCol {
			break
		}
		if r > 0xFFFF {
			units += 2
		} else {
			units++
		}
		n++
	}
	return units
}

// utf16Len counts the UTF-16 code units in a string.
func utf16Len(s string) uint32 {
	units := uint32(0)
	for _, r := range s {
		if r > 0xFFFF {
			units += 2
		} else {
			units++
		}
	}
	return units
}

// byteToUTF16 converts a byte offset in the line into an LSP
// character offset.
func byteToUTF16(line string, byteCol int) uint32 {
	units := uint32(0)
	for i, r := range line {
		if i >= byteCol {
			break
		}
		if r > 0xFFFF {
			units += 2
		} else {
			units++
		}
	}
	return units
}

// analyzeCursor works out what the cursor is doing: completing a
// key, completing a value, or nothing.
func analyzeCursor(text string, pos protocol.Position) cursorContext {
	lines := strings.Split(text, "\n")
	lineNo := int(pos.Line)
	if lineNo < 0 {
		lineNo = 0
	}
	if lineNo >= len(lines) {
		lineNo = len(lines) - 1
	}
	if lineNo < 0 {
		return cursorContext{kind: cursorKey, path: nil, existingKeys: map[string]bool{}}
	}
	line := lines[lineNo]
	byteCol := utf16ToByte(line, pos.Character)
	if byteCol > len(line) {
		byteCol = len(line)
	}
	before := line[:byteCol]

	// List items: no completion in v1.
	trimmed := strings.TrimLeft(before, " \t")
	if strings.HasPrefix(trimmed, "- ") || trimmed == "-" {
		return cursorContext{kind: cursorNone}
	}

	// Comments: nothing to complete.
	if strings.HasPrefix(trimmed, "#") {
		return cursorContext{kind: cursorNone}
	}

	// A `key:` line with the cursor after the colon: value context.
	if match := keyLineRe.FindStringSubmatch(before); match != nil {
		key := keyOf(match)
		indent := len(match[1])
		// The colon after the key, not the first colon in the line
		// (a quoted key can hold one).
		keyEnd := indent + len(key)
		if match[3] != "" || match[4] != "" {
			keyEnd += 2
		}
		colonAt := strings.Index(before[keyEnd:], ":") + keyEnd
		valueStart := colonAt + 1
		for valueStart < len(before) && before[valueStart] == ' ' {
			valueStart++
		}
		path, _ := enclosingPath(lines, lineNo, indent)
		return cursorContext{
			kind:    cursorValue,
			path:    path,
			key:     key,
			partial: before[valueStart:],
			partialRange: protocol.Range{
				Start: protocol.Position{Line: pos.Line, Character: byteToUTF16(line, valueStart)},
				End:   pos,
			},
		}
	}

	// Otherwise the cursor is on a partial key (or a blank line):
	// key context. A blank line takes its indent from the cursor
	// column — the editor's auto-indent puts it where the key goes.
	indent := len(before) - len(strings.TrimLeft(before, " \t"))
	if strings.TrimSpace(before) == "" {
		indent = byteCol
	}
	partial := strings.TrimLeft(before, " \t")

	// A colon right after the cursor means the key is already
	// complete — completing it again would double the colon.
	if byteCol < len(line) && line[byteCol] == ':' {
		return cursorContext{kind: cursorNone}
	}

	path, parentLine := enclosingPath(lines, lineNo, indent)
	context := cursorContext{
		kind:    cursorKey,
		path:    path,
		partial: partial,
		partialRange: protocol.Range{
			Start: protocol.Position{Line: pos.Line, Character: byteToUTF16(line, indent)},
			End:   pos,
		},
		existingKeys: siblingKeys(lines, parentLine, indent),
		lineIndent:   indent,
	}
	// A blank line, or a line holding only a partial key (no
	// colon yet), right under a value-less key with no children
	// yet is about to hold that key's first child, even when the
	// editor left the line unindented: record the key's path so
	// the completion side can offer its keys. A line with a
	// colon already typed is a complete key, not a partial one.
	lineText := strings.TrimSpace(line)
	if lineText == "" || partialKeyRe.MatchString(lineText) {
		context.orphanPath, context.orphanKeys, context.orphanIndent = orphanKeyPath(lines, lineNo, indent)
	}
	return context
}

// enclosingPath collects the parent keys above a line: each `key:`
// line above with less indentation than the current level is an
// ancestor. It also returns the deepest parent's line, or -1 for
// the root mapping.
func enclosingPath(lines []string, lineNo int, indent int) ([]string, int) {
	var path []string
	parentLine := -1
	current := indent
	for i := lineNo - 1; i >= 0; i-- {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		match := keyLineRe.FindStringSubmatch(lines[i])
		if match == nil {
			continue
		}
		keyIndent := len(match[1])
		if keyIndent < current {
			path = append([]string{keyOf(match)}, path...)
			parentLine = i
			current = keyIndent
			if current == 0 {
				break
			}
		}
	}
	return path, parentLine
}

// orphanKeyPath finds the value-less mapping key directly above
// a blank or partial-key cursor line: the nearest non-blank,
// non-comment line above, when it is a `key:` line with nothing
// after the colon and an indent at or above the cursor's. The key
// has no children yet — nothing sits between it and the cursor —
// so the cursor is about to type its first child. It returns the
// full path to the key (ancestors included), the keys already
// present in its mapping, and the indent its children take, or
// nil when there is no such key.
func orphanKeyPath(lines []string, lineNo int, indent int) ([]string, map[string]bool, int) {
	for i := lineNo - 1; i >= 0; i-- {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		match := keyLineRe.FindStringSubmatch(lines[i])
		if match == nil {
			return nil, nil, 0
		}
		// A value after the colon means the key is complete; a
		// trailing comment leaves it value-less.
		rest := strings.TrimSpace(match[5])
		if rest != "" && !strings.HasPrefix(rest, "#") {
			return nil, nil, 0
		}
		keyIndent := len(match[1])
		if keyIndent < indent {
			return nil, nil, 0
		}
		ancestors, _ := enclosingPath(lines, i, keyIndent)
		return append(ancestors, keyOf(match)), siblingKeys(lines, i, keyIndent+2), keyIndent + 2
	}
	return nil, nil, 0
}

// siblingKeys collects the keys already present in a mapping: the
// `key:` lines at the mapping's indent between the parent's line
// and the next dedent.
func siblingKeys(lines []string, parentLine int, mappingIndent int) map[string]bool {
	keys := map[string]bool{}
	for i := parentLine + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		match := keyLineRe.FindStringSubmatch(lines[i])
		if match == nil {
			continue
		}
		indent := len(match[1])
		if indent < mappingIndent {
			break
		}
		if indent == mappingIndent {
			keys[keyOf(match)] = true
		}
	}
	return keys
}

// parseYAML parses the text into a node tree. An empty document
// parses to a nil root with no error.
func parseYAML(text string) (*yaml.Node, error) {
	var root yaml.Node
	decoder := yaml.NewDecoder(strings.NewReader(text))
	if err := decoder.Decode(&root); err != nil {
		if err == io.EOF {
			return nil, nil
		}
		return nil, err
	}
	return &root, nil
}

// yamlLookup finds the key and value nodes for a path of mapping
// keys. The root path returns the document's mapping as the value.
func yamlLookup(root *yaml.Node, path []string) (key, value *yaml.Node) {
	if root == nil {
		return nil, nil
	}
	node := root
	if node.Kind == yaml.DocumentNode && len(node.Content) > 0 {
		node = node.Content[0]
	}
	value = node
	for _, segment := range path {
		if node.Kind != yaml.MappingNode {
			return nil, nil
		}
		found := false
		for i := 0; i+1 < len(node.Content); i += 2 {
			if node.Content[i].Value == segment {
				key, value = node.Content[i], node.Content[i+1]
				node = value
				found = true
				break
			}
		}
		if !found {
			return nil, nil
		}
	}
	return key, value
}

// nodeRange turns a YAML node into an LSP range. Scalars span
// their text; mappings and sequences span their first line.
func nodeRange(node *yaml.Node, lines []string) protocol.Range {
	if node == nil || node.Line < 1 || node.Line > len(lines) {
		return protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: 0, Character: 1},
		}
	}
	line := lines[node.Line-1]
	startChar := runeToUTF16(line, node.Column-1)
	start := protocol.Position{Line: uint32(node.Line - 1), Character: startChar}
	if node.Kind == yaml.ScalarNode {
		endChar := startChar + utf16Len(node.Value)
		if node.Style == yaml.DoubleQuotedStyle || node.Style == yaml.SingleQuotedStyle {
			// The column points at the opening quote, so
			// the value's span is two short: the opening
			// quote before the value and the closing quote
			// after it.
			endChar += 2
		}
		return protocol.Range{Start: start, End: protocol.Position{Line: start.Line, Character: endChar}}
	}
	return protocol.Range{Start: start, End: protocol.Position{Line: start.Line, Character: byteToUTF16(line, len(line))}}
}

var yamlErrorLineRe = regexp.MustCompile(`^yaml: line (\d+): (.*)$`)

// yamlParseDiagnostics turns a yaml.v3 parse error into LSP
// diagnostics, one per error line the parser reports.
func yamlParseDiagnostics(err error, lines []string) []protocol.Diagnostic {
	var diags []protocol.Diagnostic
	typeError, ok := err.(*yaml.TypeError)
	if !ok {
		return []protocol.Diagnostic{{
			Range: protocol.Range{
				Start: protocol.Position{Line: 0, Character: 0},
				End:   protocol.Position{Line: 0, Character: 1},
			},
			Severity: protocol.DiagnosticSeverityError,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(err.Error()),
		}}
	}
	for _, msg := range typeError.Errors {
		lineNo := uint32(0)
		text := msg
		if match := yamlErrorLineRe.FindStringSubmatch(msg); match != nil {
			var n int
			for _, c := range match[1] {
				n = n*10 + int(c-'0')
			}
			if n > 0 {
				lineNo = uint32(n - 1)
			}
			text = match[2]
		}
		endChar := uint32(1)
		if int(lineNo) < len(lines) {
			endChar = byteToUTF16(lines[lineNo], len(lines[lineNo]))
		}
		diags = append(diags, protocol.Diagnostic{
			Range: protocol.Range{
				Start: protocol.Position{Line: lineNo, Character: 0},
				End:   protocol.Position{Line: lineNo, Character: endChar},
			},
			Severity: protocol.DiagnosticSeverityError,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(text),
		})
	}
	return diags
}
