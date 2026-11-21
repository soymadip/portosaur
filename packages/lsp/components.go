package main

import (
	"strings"

	"go.lsp.dev/protocol"
)

// The JSX tag scanner. It finds the tag the cursor sits inside
// and works out what the cursor is doing: typing a tag name, a
// prop name, or a prop value. v1 covers tag names, plain prop
// names and plain values — it does not parse JSX expressions
// (`{...}`), and a quote inside an expression can confuse the
// quote tracking. Tags inside fenced code blocks and inside the
// frontmatter are ignored; a `<` in an inline code span is not
// (a backticked `<Btn>` on the cursor's line can still look like
// a tag).

type tagCursorKind int

const (
	tagNone  tagCursorKind = iota // not inside a tag, or nothing to offer
	tagName                       // on the tag name (or just after `<`)
	tagProp                       // on a prop name, or between props
	tagValue                      // after `=` or inside a prop value
)

type tagTokenKind int

const (
	tokenOther     tagTokenKind = iota
	tokenName                   // the tag name
	tokenPropName               // a prop's name
	tokenPropValue              // a prop's value
)

type tagToken struct {
	kind tagTokenKind
	prop string // tokenPropName/tokenPropValue: the prop name
	rng  protocol.Range
}

type tagContext struct {
	found         bool
	closing       bool // a `</Name>` tag: no completion or hover in v1
	name          string
	nameRange     protocol.Range
	token         tagToken // the token the cursor sits on (for hover)
	kind          tagCursorKind
	prop          string // tagValue only: the prop being valued
	partial       string
	partialRange  protocol.Range
	quoted        bool // tagValue inside quotes
	existingProps map[string]bool
	props         []scannedProp // every prop in the tag, in order
	end           int           // byte offset of the closing `>` (or end of text)
}

// positionToOffset converts an LSP position to a byte offset in
// the document, clamping to the document's bounds.
func positionToOffset(lines []string, pos protocol.Position) int {
	lineNo := int(pos.Line)
	if lineNo < 0 {
		lineNo = 0
	}
	if lineNo >= len(lines) {
		total := 0
		for _, line := range lines {
			total += len(line) + 1
		}
		return total - 1
	}
	offset := 0
	for i := 0; i < lineNo; i++ {
		offset += len(lines[i]) + 1
	}
	return offset + utf16ToByte(lines[lineNo], pos.Character)
}

// offsetToPosition converts a byte offset in the document to an
// LSP position, clamping to the document's bounds.
func offsetToPosition(lines []string, offset int) protocol.Position {
	if offset < 0 {
		offset = 0
	}
	lineNo := 0
	lineStart := 0
	for i, line := range lines {
		next := lineStart + len(line) + 1
		if offset < next || i == len(lines)-1 {
			lineNo = i
			break
		}
		lineStart = next
	}
	return protocol.Position{Line: uint32(lineNo), Character: byteToUTF16(lines[lineNo], offset-lineStart)}
}

func rangeFromOffsets(lines []string, start, end int) protocol.Range {
	return protocol.Range{Start: offsetToPosition(lines, start), End: offsetToPosition(lines, end)}
}

// fenceLines marks the lines inside fenced code blocks (``` or
// ~~~), delimiter lines included. Scanning starts at startLine;
// lines before it are never fences.
func fenceLines(lines []string, startLine int) map[int]bool {
	inFence := false
	marked := map[int]bool{}
	for i := startLine; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
			marked[i] = true
			inFence = !inFence
			continue
		}
		if inFence {
			marked[i] = true
		}
	}
	return marked
}

// scanTag finds the JSX tag the cursor sits inside, if any. It
// scans forward from the start of the document's content (past
// the frontmatter) to the cursor, tracking whether the scan is
// inside a tag and inside quotes.
func scanTag(text string, pos protocol.Position) tagContext {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			// An unclosed block runs to the end of the file:
			// there is no MDX content below it.
			return tagContext{}
		}
		contentStart = block.endLine + 1
	}
	if int(pos.Line) < contentStart {
		return tagContext{}
	}
	fences := fenceLines(lines, contentStart)
	if fences[int(pos.Line)] {
		return tagContext{}
	}
	cursor := positionToOffset(lines, pos)
	contentOffset := 0
	for i := 0; i < contentStart; i++ {
		contentOffset += len(lines[i]) + 1
	}

	inTag := false
	tagStart := 0
	var inQuote byte
	line := contentStart
	for i := contentOffset; i < cursor && i < len(text); i++ {
		c := text[i]
		if c == '\n' {
			line++
			continue
		}
		if fences[line] {
			// A fence line breaks any open tag.
			inTag = false
			inQuote = 0
			continue
		}
		if !inTag {
			if c == '<' {
				if i+1 < len(text) {
					next := text[i+1]
					if isTagNameStart(next) || (next == '/' && i+2 < len(text) && isTagNameStart(text[i+2])) {
						inTag = true
						tagStart = i
					}
				} else {
					// `<` is the last character before
					// the cursor: the user just typed it
					// and the name follows.
					inTag = true
					tagStart = i
				}
			}
			continue
		}
		if inQuote != 0 {
			if c == inQuote {
				inQuote = 0
			}
			continue
		}
		switch c {
		case '"', '\'':
			inQuote = c
		case '>':
			inTag = false
		}
	}
	if !inTag {
		return tagContext{}
	}
	return parseTag(text, lines, tagStart, cursor, inQuote)
}

func isTagNameStart(c byte) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isTagNameChar(c byte) bool {
	return isTagNameStart(c) || (c >= '0' && c <= '9') || c == '.' || c == '-'
}

func isPropNameStart(c byte) bool {
	return isTagNameStart(c)
}

func isPropNameChar(c byte) bool {
	return isPropNameStart(c) || (c >= '0' && c <= '9') || c == '-'
}

// A prop in the tag being scanned, with the byte offsets of its
// name and value tokens.
type scannedProp struct {
	name       string
	nameStart  int
	nameEnd    int
	hasValue   bool
	valueStart int // inside the quotes when quoted
	valueEnd   int
	quoted     bool
	expr       bool // an expression value ({...}): not a plain string
}

// parseTag parses the tag starting at tagStart: its name and
// props, and where the cursor falls among them. The tag's end is
// the next `>` outside quotes after the cursor, or the end of
// the document when the tag is still open. inQuote is the quote
// the cursor already sits inside (a value opened before the
// cursor), so a `>` inside that value is not the tag's end.
func parseTag(text string, lines []string, tagStart, cursor int, inQuote byte) tagContext {
	tagEnd := len(text)
	for i := cursor; i < len(text); i++ {
		c := text[i]
		if inQuote != 0 {
			if c == inQuote {
				inQuote = 0
			}
			continue
		}
		switch c {
		case '"', '\'':
			inQuote = c
		case '>':
			tagEnd = i
			i = len(text)
		}
	}

	ctx := tagContext{found: true, existingProps: map[string]bool{}, end: tagEnd}
	i := tagStart + 1
	if i < tagEnd && text[i] == '/' {
		ctx.closing = true
		ctx.found = false
		return ctx
	}
	nameStart := i
	for i < tagEnd && isTagNameChar(text[i]) {
		i++
	}
	ctx.name = text[nameStart:i]
	ctx.nameRange = rangeFromOffsets(lines, nameStart, i)

	var props []scannedProp
	for i < tagEnd {
		for i < tagEnd && (text[i] == ' ' || text[i] == '\t' || text[i] == '\n' || text[i] == '\r') {
			i++
		}
		if i >= tagEnd || text[i] == '/' {
			break
		}
		if !isPropNameStart(text[i]) {
			// Something the scanner does not understand (an
			// expression, a spread): skip the character.
			i++
			continue
		}
		prop := scannedProp{nameStart: i}
		for i < tagEnd && isPropNameChar(text[i]) {
			i++
		}
		prop.name = text[prop.nameStart:i]
		prop.nameEnd = i
		for i < tagEnd && (text[i] == ' ' || text[i] == '\t') {
			i++
		}
		if i < tagEnd && text[i] == '=' {
			i++
			for i < tagEnd && (text[i] == ' ' || text[i] == '\t') {
				i++
			}
			// A value is expected from here, even when
			// nothing is typed yet (the cursor sits right
			// after `=`).
			prop.hasValue = true
			prop.valueStart = i
			prop.valueEnd = i
			if i < tagEnd {
				switch text[i] {
				case '"', '\'':
					prop.quoted = true
					prop.valueStart = i + 1
					quote := text[i]
					i++
					for i < tagEnd && text[i] != quote {
						i++
					}
					prop.valueEnd = i
					if i < tagEnd {
						i++
					}
				case '{':
					// An expression value: skip the braces.
					prop.expr = true
					depth := 0
					for i < tagEnd {
						if text[i] == '{' {
							depth++
						} else if text[i] == '}' {
							depth--
							if depth == 0 {
								i++
								break
							}
						}
						i++
					}
					prop.valueEnd = i
				default:
					for i < tagEnd && text[i] != ' ' && text[i] != '\t' && text[i] != '\n' && text[i] != '\r' && text[i] != '>' && text[i] != '/' {
						i++
					}
					prop.valueEnd = i
				}
			}
		}
		props = append(props, prop)
	}
	ctx.props = props
	for _, prop := range props {
		ctx.existingProps[prop.name] = true
	}

	// Where the cursor falls: the name, a prop name, a prop
	// value, or the whitespace between props.
	if cursor >= nameStart && cursor <= nameStart+len(ctx.name) {
		// On the name, or just past it with the tag still
		// open: completing the name. Past the name with a
		// space after it means the name is done.
		after := byte(0)
		if nameStart+len(ctx.name) < tagEnd {
			after = text[nameStart+len(ctx.name)]
		}
		if cursor < nameStart+len(ctx.name) || after == 0 || after == '>' || after == '/' {
			ctx.kind = tagName
			ctx.partial = text[nameStart:cursor]
			ctx.partialRange = rangeFromOffsets(lines, nameStart, nameStart+len(ctx.name))
			ctx.token = tagToken{kind: tokenName, rng: ctx.nameRange}
			return ctx
		}
	}
	for _, prop := range props {
		// The cursor must be strictly inside a prop name to
		// be "on" it: at the name's first character the
		// cursor sits between the previous prop and this
		// one, and completing there inserts a fresh prop
		// instead of replacing this one.
		if cursor > prop.nameStart && cursor <= prop.nameEnd {
			// On a prop name (or just past it, before any
			// `=` or space): completing the name.
			if cursor == prop.nameEnd && prop.nameEnd < tagEnd {
				after := text[prop.nameEnd]
				if after == '=' {
					// Right before `=`: the name is
					// done and the value follows —
					// nothing to offer here.
					ctx.kind = tagNone
					ctx.token = tagToken{kind: tokenPropName, prop: prop.name, rng: rangeFromOffsets(lines, prop.nameStart, prop.nameEnd)}
					return ctx
				}
				if after == ' ' || after == '\t' || after == '\n' || after == '\r' {
					continue
				}
			}
			delete(ctx.existingProps, prop.name)
			ctx.kind = tagProp
			ctx.partial = text[prop.nameStart:cursor]
			ctx.partialRange = rangeFromOffsets(lines, prop.nameStart, prop.nameEnd)
			ctx.token = tagToken{kind: tokenPropName, prop: prop.name, rng: ctx.partialRange}
			return ctx
		}
		if prop.hasValue && cursor >= prop.valueStart && cursor <= prop.valueEnd {
			// Inside a value (or just past `=` with no value
			// yet): completing the value.
			ctx.kind = tagValue
			ctx.prop = prop.name
			ctx.quoted = prop.quoted
			ctx.partial = text[prop.valueStart:cursor]
			ctx.partialRange = rangeFromOffsets(lines, prop.valueStart, prop.valueEnd)
			ctx.token = tagToken{kind: tokenPropValue, prop: prop.name, rng: ctx.partialRange}
			return ctx
		}
		if prop.hasValue && prop.quoted && cursor == prop.valueStart-1 {
			// On the opening quote: completing the value
			// from scratch.
			ctx.kind = tagValue
			ctx.prop = prop.name
			ctx.quoted = true
			ctx.partial = ""
			ctx.partialRange = rangeFromOffsets(lines, prop.valueStart, prop.valueEnd)
			ctx.token = tagToken{kind: tokenPropValue, prop: prop.name, rng: ctx.partialRange}
			return ctx
		}
		if !prop.hasValue && cursor == prop.nameEnd {
			// A bare prop with the cursor right after its
			// name: the name is done, nothing to offer here.
			ctx.kind = tagNone
			ctx.token = tagToken{kind: tokenPropName, prop: prop.name, rng: rangeFromOffsets(lines, prop.nameStart, prop.nameEnd)}
			return ctx
		}
	}
	// Between props (or just after `<Name `): completing a prop
	// name from scratch.
	ctx.kind = tagProp
	ctx.partial = ""
	ctx.partialRange = protocol.Range{Start: offsetToPosition(lines, cursor), End: offsetToPosition(lines, cursor)}
	return ctx
}

// scanAllTags finds every opening JSX tag in the document's
// content (past the frontmatter, outside fenced code blocks and
// inline code spans), in document order. Diagnostics walk the
// result; closing tags are skipped. A `<` with no `>` after it
// is not a tag: accepting it would swallow the rest of the
// document into one tag. A `<Name` in prose with a `>` later on
// the line still reads as a tag — the same heuristic the
// cursor scanner uses, and harmless in practice (a known
// component with no bad props draws no diagnostic).
func scanAllTags(text string) []tagContext {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		contentStart = block.endLine + 1
	}
	fences := fenceLines(lines, contentStart)
	spans := make([][][2]int, len(lines))
	for i := contentStart; i < len(lines); i++ {
		spans[i] = codeSpanRanges(lines[i])
	}
	contentOffset := 0
	for i := 0; i < contentStart; i++ {
		contentOffset += len(lines[i]) + 1
	}

	var tags []tagContext
	line := contentStart
	lineStart := contentOffset
	for i := contentOffset; i < len(text); {
		c := text[i]
		if c == '\n' {
			line++
			lineStart = i + 1
			i++
			continue
		}
		if !fences[line] && c == '<' && i+1 < len(text) && isTagNameStart(text[i+1]) && !inCodeSpan(spans[line], i-lineStart) {
			ctx := parseTag(text, lines, i, i+1, 0)
			if ctx.found && ctx.end < len(text) {
				tags = append(tags, ctx)
				next := ctx.end + 1
				for i < next && i < len(text) {
					if text[i] == '\n' {
						line++
						lineStart = i + 1
					}
					i++
				}
				continue
			}
		}
		i++
	}
	return tags
}

// codeSpanRanges returns the byte ranges of the inline code
// spans on one line: a run of n backticks opens a span, the
// next run of exactly n backticks closes it. Single-line spans
// only — a span that never closes on its line is ignored.
func codeSpanRanges(line string) [][2]int {
	var spans [][2]int
	i := 0
	for i < len(line) {
		if line[i] != '`' {
			i++
			continue
		}
		start := i
		for i < len(line) && line[i] == '`' {
			i++
		}
		n := i - start
		closed := false
		for j := i; j < len(line); {
			if line[j] != '`' {
				j++
				continue
			}
			k := j
			for k < len(line) && line[k] == '`' {
				k++
			}
			if k-j == n {
				spans = append(spans, [2]int{start, k})
				i = k
				closed = true
				break
			}
			j = k
		}
		if !closed {
			break
		}
	}
	return spans
}

func inCodeSpan(spans [][2]int, col int) bool {
	for _, span := range spans {
		if col >= span[0] && col < span[1] {
			return true
		}
	}
	return false
}
