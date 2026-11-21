package main

import (
	"sort"
	"strings"

	"go.lsp.dev/protocol"
)

// Code fence completion: on an opening fence line in the MDX
// body, the server offers language names right after the fence
// and, after the language, the meta params the build's parser
// reads (`title`, `tab`, `noCopy`, `noWrap`, `lineNumbers`).
// Value params (`title`, `tab`) insert as a snippet with the
// cursor inside the quotes; bare flags insert the plain name.
// Nothing is offered on a closing fence line, inside a code
// block, or on a plain line.

// fenceLanguages is the curated language list offered after a
// fence. The build's highlighter (Shiki, loaded lazily by
// Fumadocs) knows its full bundled set of over 200 languages,
// which is too long for a completion list, so this holds the
// common ones plus the three fences Portosaur handles itself:
// `mermaid` (diagrams), `package-install` and `npm` (install
// tabs, via remarkInstall).
var fenceLanguages = []string{
	"astro",
	"bash",
	"c",
	"cpp",
	"csharp",
	"css",
	"dart",
	"diff",
	"dockerfile",
	"go",
	"graphql",
	"html",
	"java",
	"javascript",
	"js",
	"json",
	"jsonc",
	"jsx",
	"kotlin",
	"lua",
	"markdown",
	"md",
	"mermaid",
	"npm",
	"package-install",
	"php",
	"powershell",
	"py",
	"python",
	"ruby",
	"rust",
	"scala",
	"scss",
	"sh",
	"shell",
	"sql",
	"swift",
	"text",
	"toml",
	"ts",
	"tsx",
	"txt",
	"typescript",
	"vue",
	"xml",
	"yaml",
	"yml",
	"zig",
	"zsh",
}

// fenceLanguageDetails names what the special fences do, so
// they stand out in the list. Plain languages get no detail.
var fenceLanguageDetails = map[string]string{
	"mermaid":         "Diagram",
	"npm":             "Install tabs",
	"package-install": "Install tabs",
}

// fenceMetaParam describes one meta param from
// parseCodeBlockMeta (packages/core/src/mdx.ts): whether it
// takes a quoted value (snippet insert) or stands alone as a
// flag (plain insert), and a one-line description.
type fenceMetaParam struct {
	takesValue bool
	doc        string
}

// fenceMetaParams is the exact set parseCodeBlockMeta reads,
// via Fumadocs' parseCodeBlockAttributes. `title` and `tab`
// take quoted string values; `noCopy` and `noWrap` are bare
// flags; `lineNumbers` is a bare flag that may also take a
// number (`lineNumbers=5` starts numbering at 5).
var fenceMetaParams = map[string]fenceMetaParam{
	"title":       {takesValue: true, doc: "Shows a file path or title in the code block header."},
	"tab":         {takesValue: true, doc: "Groups this fence into a tab with this label."},
	"noCopy":      {doc: "Hides the copy button on this block."},
	"noWrap":      {doc: "Hides the wrap button on this block."},
	"lineNumbers": {doc: "Shows line numbers. Write `lineNumbers=5` to start at line 5."},
}

type fenceKind int

const (
	fenceLanguage fenceKind = iota
	fenceMeta
)

// fenceContext describes the fence the cursor sits on: which
// sub-context (language or meta), the partial text being typed,
// the range the pick replaces, and (for meta) the params
// already on the line. The range runs to the end of the word
// under the cursor, so completing mid-word replaces the whole
// word instead of leaving its tail behind.
type fenceContext struct {
	found        bool
	kind         fenceKind
	partial      string // the text being typed, before the cursor
	partialRange protocol.Range
	existing     map[string]bool // meta params already on the line
}

func isFenceLangChar(c byte) bool {
	return c == '_' || c == '+' || c == '#' || c == '.' || c == '-' ||
		(c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

func isFenceParamChar(c byte) bool {
	return c == '_' || c == '-' ||
		(c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

// fenceMarker parses a fence delimiter line: up to 3 spaces of
// indent, then a run of 3 or more backticks or tildes. It
// returns the marker character, its length, and the byte offset
// just past the marker.
func fenceMarker(line string) (char byte, length int, after int, ok bool) {
	indent := 0
	for indent < len(line) && line[indent] == ' ' && indent < 3 {
		indent++
	}
	// A fourth space means an indented code block, not a fence.
	if indent < len(line) && line[indent] == ' ' {
		return 0, 0, 0, false
	}
	if indent >= len(line) {
		return 0, 0, 0, false
	}
	char = line[indent]
	if char != '`' && char != '~' {
		return 0, 0, 0, false
	}
	end := indent
	for end < len(line) && line[end] == char {
		end++
	}
	length = end - indent
	if length < 3 {
		return 0, 0, 0, false
	}
	return char, length, end, true
}

// inFenceBefore reports whether lines[lineNo] sits inside a
// fenced code block: it walks the lines from `from` up to (not
// including) lineNo tracking fence state. A closer needs the
// opener's character, at least the opener's length, and nothing
// but whitespace after it.
func inFenceBefore(lines []string, from, lineNo int) bool {
	inFence := false
	var fenceChar byte
	fenceLen := 0
	for i := from; i < lineNo; i++ {
		char, length, after, ok := fenceMarker(lines[i])
		if !ok {
			continue
		}
		if !inFence {
			inFence, fenceChar, fenceLen = true, char, length
			continue
		}
		if char == fenceChar && length >= fenceLen && strings.TrimSpace(lines[i][after:]) == "" {
			inFence = false
		}
	}
	return inFence
}

// scanFence finds the opening fence line the cursor sits on,
// when there is one. It walks the lines above the cursor
// tracking fence state, so a line inside a block (or a closing
// fence line) never counts: a closer needs the opener's
// character, at least the opener's length, and nothing but
// whitespace after it.
func scanFence(text string, pos protocol.Position) fenceContext {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return fenceContext{}
		}
		contentStart = block.endLine + 1
	}
	lineNo := int(pos.Line)
	if lineNo < contentStart || lineNo >= len(lines) {
		return fenceContext{}
	}
	if inFenceBefore(lines, contentStart, lineNo) {
		return fenceContext{}
	}
	line := lines[lineNo]
	_, _, markerEnd, ok := fenceMarker(line)
	if !ok {
		return fenceContext{}
	}
	cursor := utf16ToByte(line, pos.Character)
	if cursor < markerEnd {
		return fenceContext{}
	}
	// The language token: the first word after the marker.
	tokenStart := markerEnd
	for tokenStart < len(line) && line[tokenStart] == ' ' {
		tokenStart++
	}
	tokenEnd := tokenStart
	for tokenEnd < len(line) && isFenceLangChar(line[tokenEnd]) {
		tokenEnd++
	}
	lineStart := 0
	for i := 0; i < lineNo; i++ {
		lineStart += len(lines[i]) + 1
	}
	if cursor <= tokenEnd {
		// The cursor is on (or before) the language token.
		partial := ""
		if cursor > tokenStart {
			partial = line[tokenStart:cursor]
		}
		wordEnd := cursor
		if wordEnd < tokenStart {
			wordEnd = tokenStart
		}
		for wordEnd < len(line) && isFenceLangChar(line[wordEnd]) {
			wordEnd++
		}
		return fenceContext{
			found:        true,
			kind:         fenceLanguage,
			partial:      partial,
			partialRange: rangeFromOffsets(lines, lineStart+tokenStart, lineStart+wordEnd),
		}
	}
	return scanFenceMeta(lines, lineNo, lineStart, tokenEnd, cursor)
}

// scanFenceMeta finds the meta param the cursor sits on, past
// the language token. The cursor must be on a param name (or
// on the whitespace where one goes): inside a quoted value, or
// right after `=` or a closing quote, there is nothing to
// complete.
func scanFenceMeta(lines []string, lineNo, lineStart, tokenEnd, cursor int) fenceContext {
	line := lines[lineNo]
	// A quote left open before the cursor means the cursor sits
	// inside a value.
	inSingle, inDouble := false, false
	for i := tokenEnd; i < cursor; i++ {
		switch line[i] {
		case '\'':
			if !inDouble {
				inSingle = !inSingle
			}
		case '"':
			if !inSingle {
				inDouble = !inDouble
			}
		}
	}
	if inSingle || inDouble {
		return fenceContext{}
	}
	wordStart := cursor
	for wordStart > tokenEnd && isFenceParamChar(line[wordStart-1]) {
		wordStart--
	}
	// The word must start after whitespace (or at the start of
	// the meta area): a `=` or a closing quote right before it
	// means the cursor is on a value, not a name.
	if wordStart > tokenEnd && line[wordStart-1] != ' ' && line[wordStart-1] != '\t' {
		return fenceContext{}
	}
	wordEnd := cursor
	for wordEnd < len(line) && isFenceParamChar(line[wordEnd]) {
		wordEnd++
	}
	return fenceContext{
		found:        true,
		kind:         fenceMeta,
		partial:      line[wordStart:cursor],
		partialRange: rangeFromOffsets(lines, lineStart+wordStart, lineStart+wordEnd),
		existing:     fenceExistingParams(line[tokenEnd:wordStart]),
	}
}

// fenceExistingParams reads the param names already on the
// line, mirroring Fumadocs' attribute syntax: a name, or a
// name with a quoted string or a bare number after `=`.
func fenceExistingParams(segment string) map[string]bool {
	existing := map[string]bool{}
	i := 0
	for i < len(segment) {
		for i < len(segment) && (segment[i] == ' ' || segment[i] == '\t') {
			i++
		}
		start := i
		for i < len(segment) && isFenceParamChar(segment[i]) {
			i++
		}
		if i == start {
			// Not a name: skip the character (a stray quote or
			// `=` from an unfinished value) and move on.
			i++
			continue
		}
		existing[segment[start:i]] = true
		if i < len(segment) && segment[i] == '=' {
			i++
			if i < len(segment) && (segment[i] == '"' || segment[i] == '\'') {
				quote := segment[i]
				i++
				for i < len(segment) && segment[i] != quote {
					i++
				}
				if i < len(segment) {
					i++
				}
			} else {
				for i < len(segment) && segment[i] >= '0' && segment[i] <= '9' {
					i++
				}
			}
		}
	}
	return existing
}

// fenceCompletion offers language names or meta params on a
// fence line. The second return value reports whether the
// cursor is on an opening fence line at all: when it is not,
// the caller falls through to component completion.
func (s *Server) fenceCompletion(params *protocol.CompletionParams, text string) (*protocol.CompletionList, bool) {
	context := scanFence(text, params.Position)
	if !context.found {
		return nil, false
	}
	var items []protocol.CompletionItem
	switch context.kind {
	case fenceLanguage:
		for _, lang := range fenceLanguages {
			if !strings.HasPrefix(lang, context.partial) {
				continue
			}
			item := protocol.CompletionItem{
				Label:    lang,
				Kind:     protocol.CompletionItemKindValue,
				TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: lang},
			}
			if detail := fenceLanguageDetails[lang]; detail != "" {
				item.Detail = protocol.NewOptional(detail)
			}
			items = append(items, item)
		}
	case fenceMeta:
		for name, param := range fenceMetaParams {
			if context.existing[name] {
				continue
			}
			if !strings.HasPrefix(name, context.partial) {
				continue
			}
			item := protocol.CompletionItem{
				Label:         name,
				Kind:          protocol.CompletionItemKindProperty,
				Documentation: &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: param.doc},
				TextEdit:      &protocol.TextEdit{Range: context.partialRange, NewText: name},
			}
			if param.takesValue {
				// A plain `$0` tabstop only: Zed chokes on
				// choice placeholders (`${1|a,b|}`).
				item.InsertTextFormat = protocol.InsertTextFormatSnippet
				item.TextEdit = &protocol.TextEdit{Range: context.partialRange, NewText: name + `="$0"`}
			}
			items = append(items, item)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}, true
}
