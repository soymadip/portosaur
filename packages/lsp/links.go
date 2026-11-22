package main

import (
	"strings"

	"go.lsp.dev/protocol"
)

// Links: the markdown link destination or the link prop value
// of a `Link` or `Btn` tag (Link takes only `href`, Btn keeps
// its `to`/`href` pair). Go-to-definition jumps through it; link
// completion offers values for it. Single-line markdown links
// only. Reference-style links (`[text][ref]`, `[text][]`,
// `[text]`) are covered too: their `[ref]:` definition
// destinations behave like inline destinations, and use sites
// jump to the definition.

// linkContext describes the link destination at the cursor.
type linkContext struct {
	found        bool
	value        string         // the full destination
	valueRange   protocol.Range // the destination's range in the document
	partial      string         // the destination text before the cursor
	partialRange protocol.Range // value start to the cursor
	angled       bool           // a bracketed markdown destination `](<...>)`
	jsx          bool           // a Link `href` or Btn `to`/`href` prop value
}

// linkProps are the JSX props that hold link destinations, per
// tag. Link takes only `href`. Btn keeps its `to`/`href` pair.
var linkProps = map[string]map[string]bool{
	"Link": {"href": true},
	"Btn":  {"to": true, "href": true},
}

// linkAtCursor finds the link destination the cursor sits
// inside: a markdown link destination `](...)` or the link prop
// string value of a `Link` or `Btn` tag.
func linkAtCursor(text string, pos protocol.Position) linkContext {
	if ctx := jsxLinkAtCursor(text, pos); ctx.found {
		return ctx
	}
	return markdownLinkAtCursor(text, pos)
}

// jsxLinkAtCursor finds a Link/Btn link prop value at the
// cursor. Expression values (`href={...}`) are not link
// destinations.
func jsxLinkAtCursor(text string, pos protocol.Position) linkContext {
	ctx := scanTag(text, pos)
	if !ctx.found || ctx.kind != tagValue {
		return linkContext{}
	}
	if ctx.name != "Link" && ctx.name != "Btn" {
		return linkContext{}
	}
	if !linkProps[ctx.name][ctx.prop] {
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
// cursor on its line: an inline destination `](...)` or a
// reference-definition destination `[ref]: ...`. Destinations
// inside fenced code, the frontmatter, or an inline code span
// are ignored.
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
	lineStart := 0
	for i := 0; i < lineNo; i++ {
		lineStart += len(lines[i]) + 1
	}
	if parsed, ok := parseRefDefinitionLine(line); ok && !inCodeSpan(spans, parsed.destStart) {
		// An angled destination also counts the `<` itself,
		// like an inline angled destination does.
		lo := parsed.destStart
		if parsed.angled {
			lo--
		}
		if cursor >= lo && cursor <= parsed.destEnd {
			partial := ""
			partialEnd := cursor
			if partialEnd < parsed.destStart {
				partialEnd = parsed.destStart
			}
			if cursor > parsed.destStart {
				partial = line[parsed.destStart:cursor]
			}
			return linkContext{
				found:        true,
				value:        parsed.dest,
				valueRange:   rangeFromOffsets(lines, lineStart+parsed.destStart, lineStart+parsed.destEnd),
				partial:      partial,
				partialRange: rangeFromOffsets(lines, lineStart+parsed.destStart, lineStart+partialEnd),
				angled:       parsed.angled,
			}
		}
	}
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
				} else {
					// Unclosed bracket: the user is still typing
					// the destination, so everything after the
					// `<` is it.
					valueStart++
					angled = true
				}
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
// Single-line links only. Reference-definition destinations
// come from scanRefDefinitions instead.
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

// normalizeRefLabel folds a reference label for matching:
// labels match case-insensitively, and runs of whitespace
// collapse to one space.
func normalizeRefLabel(label string) string {
	return strings.ToLower(strings.Join(strings.Fields(label), " "))
}

// refDefinitionLine is one `[label]: destination` line,
// parsed: the label and destination as written, with byte
// offsets inside the line. The destination may be `<angled>`;
// a trailing title after it is ignored.
type refDefinitionLine struct {
	label      string
	labelStart int
	labelEnd   int
	dest       string
	destStart  int // inside the `<` when angled
	destEnd    int
	angled     bool
}

// parseRefDefinitionLine parses a `[label]: destination`
// line. Up to 3 leading spaces are allowed; 4 or more is an
// indented code block, not a definition. The destination may
// sit on the same line only — a destination on the next line
// is not parsed.
func parseRefDefinitionLine(line string) (refDefinitionLine, bool) {
	i := 0
	for i < len(line) && line[i] == ' ' && i < 3 {
		i++
	}
	if i >= len(line) || line[i] != '[' {
		return refDefinitionLine{}, false
	}
	close := strings.IndexByte(line[i+1:], ']')
	if close < 0 {
		return refDefinitionLine{}, false
	}
	labelStart := i + 1
	labelEnd := labelStart + close
	label := line[labelStart:labelEnd]
	if label == "" || strings.ContainsAny(label, "[]") {
		return refDefinitionLine{}, false
	}
	rest := line[labelEnd+1:]
	if !strings.HasPrefix(rest, ":") {
		return refDefinitionLine{}, false
	}
	j := 1
	for j < len(rest) && (rest[j] == ' ' || rest[j] == '\t') {
		j++
	}
	destStart := labelEnd + 1 + j
	if destStart >= len(line) {
		return refDefinitionLine{}, false
	}
	if line[destStart] == '<' {
		end := strings.IndexByte(line[destStart+1:], '>')
		if end < 0 {
			return refDefinitionLine{}, false
		}
		dest := line[destStart+1 : destStart+1+end]
		if dest == "" {
			return refDefinitionLine{}, false
		}
		return refDefinitionLine{
			label: label, labelStart: labelStart, labelEnd: labelEnd,
			dest: dest, destStart: destStart + 1, destEnd: destStart + 1 + end, angled: true,
		}, true
	}
	destEnd := destStart
	for destEnd < len(line) && line[destEnd] != ' ' && line[destEnd] != '\t' {
		destEnd++
	}
	if destEnd == destStart {
		return refDefinitionLine{}, false
	}
	return refDefinitionLine{
		label: label, labelStart: labelStart, labelEnd: labelEnd,
		dest: line[destStart:destEnd], destStart: destStart, destEnd: destEnd,
	}, true
}

// refDefinition is one `[label]: destination` in the
// document: the label as written, the destination, and byte
// offsets of both in the document.
type refDefinition struct {
	label      string
	labelStart int
	labelEnd   int
	dest       string
	destStart  int
	destEnd    int
	line       int
}

// scanRefDefinitions finds every `[label]: destination` in
// the MDX body, in document order, skipping fenced code, the
// frontmatter, and inline code spans. The first definition of
// a label wins; later duplicates are ignored.
func scanRefDefinitions(text string) []refDefinition {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		contentStart = block.endLine + 1
	}
	fences := fenceLines(lines, contentStart)
	seen := map[string]bool{}
	var defs []refDefinition
	lineStart := 0
	for i := 0; i < contentStart; i++ {
		lineStart += len(lines[i]) + 1
	}
	for lineNo := contentStart; lineNo < len(lines); lineNo++ {
		line := lines[lineNo]
		if !fences[lineNo] {
			if parsed, ok := parseRefDefinitionLine(line); ok && !inCodeSpan(codeSpanRanges(line), parsed.labelStart) {
				key := normalizeRefLabel(parsed.label)
				if !seen[key] {
					seen[key] = true
					defs = append(defs, refDefinition{
						label:      parsed.label,
						labelStart: lineStart + parsed.labelStart,
						labelEnd:   lineStart + parsed.labelEnd,
						dest:       parsed.dest,
						destStart:  lineStart + parsed.destStart,
						destEnd:    lineStart + parsed.destEnd,
						line:       lineNo,
					})
				}
			}
		}
		lineStart += len(line) + 1
	}
	return defs
}

// refUse is one reference-style link or image use: a full ref
// `[text][ref]`, a collapsed ref `[text][]` (whose label is
// the link text), or a shortcut ref `[text]` whose label
// matches a definition. labelStart/labelEnd cover the label
// text the cursor lands on: the second bracket for a full
// ref, the link text for a collapsed or shortcut ref. image
// marks a `![alt][ref]` use: its definition's destination is
// an image src, checked against `static/` rather than the page
// index.
type refUse struct {
	label      string
	labelStart int
	labelEnd   int
	image      bool
}

// scanRefUses finds every reference-style link and image use
// in the MDX body, in document order, skipping definition
// lines, fenced code, the frontmatter, and inline code spans.
// A shortcut ref `[text]` counts as a use only when a
// definition for its label exists in the document. Nested
// brackets in the link text are not handled: the first `]`
// closes the text.
func scanRefUses(text string, defs []refDefinition) []refUse {
	defined := map[string]bool{}
	for _, def := range defs {
		defined[normalizeRefLabel(def.label)] = true
	}
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		contentStart = block.endLine + 1
	}
	fences := fenceLines(lines, contentStart)
	var uses []refUse
	lineStart := 0
	for i := 0; i < contentStart; i++ {
		lineStart += len(lines[i]) + 1
	}
	for lineNo := contentStart; lineNo < len(lines); lineNo++ {
		line := lines[lineNo]
		if fences[lineNo] {
			lineStart += len(line) + 1
			continue
		}
		// A definition line is not a use site.
		if _, ok := parseRefDefinitionLine(line); ok {
			lineStart += len(line) + 1
			continue
		}
		spans := codeSpanRanges(line)
		search := 0
		for search < len(line) {
			open := strings.IndexByte(line[search:], '[')
			if open < 0 {
				break
			}
			open += search
			close := strings.IndexByte(line[open+1:], ']')
			if close < 0 {
				break
			}
			textStart := open + 1
			textEnd := textStart + close
			linkText := line[textStart:textEnd]
			image := open > 0 && line[open-1] == '!'
			if linkText == "" || open > 0 && line[open-1] == '\\' || inCodeSpan(spans, open) {
				search = open + 1
				continue
			}
			after := textEnd + 1
			if after < len(line) && line[after] == '[' {
				close2 := strings.IndexByte(line[after+1:], ']')
				if close2 < 0 {
					search = after + 1
					continue
				}
				labelStart := after + 1
				labelEnd := labelStart + close2
				label := line[labelStart:labelEnd]
				if label == "" {
					// Collapsed ref: the label is the link text.
					uses = append(uses, refUse{label: linkText, labelStart: lineStart + textStart, labelEnd: lineStart + textEnd, image: image})
				} else {
					uses = append(uses, refUse{label: label, labelStart: lineStart + labelStart, labelEnd: lineStart + labelEnd, image: image})
				}
				search = labelEnd + 1
				continue
			}
			if after < len(line) && line[after] == '(' {
				// An inline link, not a ref use.
				search = after + 1
				continue
			}
			// A shortcut ref counts only when its label is defined.
			if defined[normalizeRefLabel(linkText)] {
				uses = append(uses, refUse{label: linkText, labelStart: lineStart + textStart, labelEnd: lineStart + textEnd, image: image})
			}
			search = textEnd + 1
		}
		lineStart += len(line) + 1
	}
	return uses
}

// refDefImageOnly reports whether a definition feeds image
// uses only: its destination is an image src, not a link. A
// definition with no uses at all, or with any link use,
// counts as a link definition — the build rewrites every
// definition's destination as a link, and an unused
// definition is usually written for a link.
func refDefImageOnly(def refDefinition, uses []refUse) bool {
	key := normalizeRefLabel(def.label)
	imageOnly := false
	for _, use := range uses {
		if normalizeRefLabel(use.label) != key {
			continue
		}
		if !use.image {
			return false
		}
		imageOnly = true
	}
	return imageOnly
}
