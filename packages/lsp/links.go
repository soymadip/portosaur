package main

import (
	"strings"

	"go.lsp.dev/protocol"
)

// Links: the markdown link destination or Link/Btn `to`/`href`
// value the cursor sits inside. Go-to-definition jumps through
// it; link completion offers values for it. Single-line markdown
// links only, and reference-style links (`[text][ref]`) are not
// covered in v1.

// linkContext describes the link destination at the cursor.
type linkContext struct {
	found        bool
	value        string         // the full destination
	valueRange   protocol.Range // the destination's range in the document
	partial      string         // the destination text before the cursor
	partialRange protocol.Range // value start to the cursor
}

// linkProps are the JSX props that hold link destinations.
var linkProps = map[string]bool{"to": true, "href": true}

// linkAtCursor finds the link destination the cursor sits
// inside: a markdown link destination `](...)` or the `to`/`href`
// string value of a `Link` or `Btn` tag.
func linkAtCursor(text string, pos protocol.Position) linkContext {
	if ctx := jsxLinkAtCursor(text, pos); ctx.found {
		return ctx
	}
	return markdownLinkAtCursor(text, pos)
}

// jsxLinkAtCursor finds a Link/Btn to/href value at the cursor.
// Expression values (`to={...}`) are not link destinations.
func jsxLinkAtCursor(text string, pos protocol.Position) linkContext {
	ctx := scanTag(text, pos)
	if !ctx.found || ctx.kind != tagValue {
		return linkContext{}
	}
	if ctx.name != "Link" && ctx.name != "Btn" {
		return linkContext{}
	}
	if !linkProps[ctx.prop] {
		return linkContext{}
	}
	for _, prop := range ctx.props {
		if prop.name == ctx.prop && prop.expr {
			return linkContext{}
		}
	}
	lines := strings.Split(text, "\n")
	start := positionToOffset(lines, ctx.partialRange.Start)
	end := positionToOffset(lines, ctx.partialRange.End)
	return linkContext{
		found:        true,
		value:        text[start:end],
		valueRange:   ctx.partialRange,
		partial:      ctx.partial,
		partialRange: protocol.Range{Start: ctx.partialRange.Start, End: pos},
	}
}

// markdownLinkAtCursor finds a markdown link destination at the
// cursor on its line. Destinations inside fenced code, the
// frontmatter, or an inline code span are ignored.
func markdownLinkAtCursor(text string, pos protocol.Position) linkContext {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return linkContext{}
		}
		contentStart = block.endLine + 1
	}
	lineNo := int(pos.Line)
	if lineNo < contentStart || lineNo >= len(lines) {
		return linkContext{}
	}
	if fenceLines(lines, contentStart)[lineNo] {
		return linkContext{}
	}
	line := lines[lineNo]
	cursor := utf16ToByte(line, pos.Character)
	spans := codeSpanRanges(line)
	search := 0
	for {
		open := strings.Index(line[search:], "](")
		if open < 0 {
			return linkContext{}
		}
		destStart := search + open + 2
		destEnd := strings.IndexByte(line[destStart:], ')')
		if destEnd < 0 {
			destEnd = len(line) - destStart
		}
		destEnd += destStart
		if cursor >= destStart && cursor <= destEnd && !inCodeSpan(spans, destStart) {
			valueStart, valueEnd := destStart, destEnd
			if valueStart < valueEnd && line[valueStart] == '<' {
				if close := strings.IndexByte(line[valueStart:], '>'); close >= 0 && valueStart+close < valueEnd {
					valueStart++
					valueEnd = valueStart + close - 1
				}
			}
			lineStart := 0
			for i := 0; i < lineNo; i++ {
				lineStart += len(lines[i]) + 1
			}
			partial := ""
			if cursor > valueStart {
				partial = line[valueStart:cursor]
			}
			partialEnd := cursor
			if partialEnd < valueStart {
				partialEnd = valueStart
			}
			return linkContext{
				found:        true,
				value:        line[valueStart:valueEnd],
				valueRange:   rangeFromOffsets(lines, lineStart+valueStart, lineStart+valueEnd),
				partial:      partial,
				partialRange: rangeFromOffsets(lines, lineStart+valueStart, lineStart+partialEnd),
			}
		}
		search = destStart
	}
}
