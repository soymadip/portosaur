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
	angled       bool           // a bracketed markdown destination `](<...>)`
	jsx          bool           // a Link/Btn `to`/`href` prop value
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
		jsx:          true,
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
			angled := false
			if valueStart < valueEnd && line[valueStart] == '<' {
				if close := strings.IndexByte(line[valueStart:], '>'); close >= 0 && valueStart+close < valueEnd {
					valueStart++
					valueEnd = valueStart + close - 1
					angled = true
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
				angled:       angled,
			}
		}
		search = destStart
	}
}

// linkDest is one markdown link destination in the document:
// the value and the byte offsets of the destination text.
type linkDest struct {
	value string
	start int
	end   int
}

// scanMarkdownLinks finds every markdown link destination
// `](...)` in the MDX body, in document order. Destinations in
// fenced code blocks, the frontmatter, or an inline code span
// are ignored, and so are image links (`![alt](...)` — images
// are the broken-image check's job, not the link check's).
// Single-line links only, and reference-style links
// (`[text][ref]`) are not covered in v1.
func scanMarkdownLinks(text string) []linkDest {
	return scanLinkDests(text, false)
}

// scanMarkdownImages finds every markdown image destination
// `![alt](...)` in the MDX body, in document order, with the
// same skips as scanMarkdownLinks. A trailing title
// (`![alt](src "title")`) is stripped from the destination:
// the title is not part of the file path.
func scanMarkdownImages(text string) []linkDest {
	return scanLinkDests(text, true)
}

// scanLinkDests finds every markdown link destination `](...)`
// in the MDX body, in document order. Destinations in fenced
// code blocks, the frontmatter, or an inline code span are
// ignored. With images false it returns plain links; with
// images true it returns image links only, with a trailing
// title stripped (see scanMarkdownImages).
func scanLinkDests(text string, images bool) []linkDest {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		contentStart = block.endLine + 1
	}
	fences := fenceLines(lines, contentStart)
	var dests []linkDest
	lineStart := 0
	for i := 0; i < contentStart; i++ {
		lineStart += len(lines[i]) + 1
	}
	for lineNo := contentStart; lineNo < len(lines); lineNo++ {
		line := lines[lineNo]
		if !fences[lineNo] {
			spans := codeSpanRanges(line)
			search := 0
			for {
				open := strings.Index(line[search:], "](")
				if open < 0 {
					break
				}
				bracket := search + open
				destStart := bracket + 2
				destEnd := strings.IndexByte(line[destStart:], ')')
				if destEnd < 0 {
					destEnd = len(line) - destStart
				}
				destEnd += destStart
				if !inCodeSpan(spans, destStart) && isImageLink(line, bracket) == images {
					valueStart, valueEnd := destStart, destEnd
					angled := false
					if valueStart < valueEnd && line[valueStart] == '<' {
						if close := strings.IndexByte(line[valueStart:], '>'); close >= 0 && valueStart+close < valueEnd {
							valueStart++
							valueEnd = valueStart + close - 1
							angled = true
						}
					}
					if images && !angled {
						// A title after the src (`![alt](src "title")`)
						// is not part of the path. Angle-bracketed
						// srcs may hold literal spaces, so they are
						// left alone.
						if space := strings.IndexAny(line[valueStart:valueEnd], " \t"); space >= 0 {
							valueEnd = valueStart + space
						}
					}
					dests = append(dests, linkDest{
						value: line[valueStart:valueEnd],
						start: lineStart + valueStart,
						end:   lineStart + valueEnd,
					})
				}
				search = destStart
			}
		}
		lineStart += len(line) + 1
	}
	return dests
}

// isImageLink reports whether the `](` whose `]` sits at
// bracket on the line belongs to an image `![alt](...)`: the
// nearest `[` before it is preceded by `!`.
func isImageLink(line string, bracket int) bool {
	open := strings.LastIndex(line[:bracket], "[")
	return open > 0 && line[open-1] == '!'
}
