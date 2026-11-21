package main

import (
	"context"
	"strconv"
	"strings"
	"time"

	"go.lsp.dev/protocol"
)

// OnTypeFormatting answers the editor's request after a trigger
// character is typed. The only trigger is the newline, and the
// handler dispatches by context: the list branch continues
// lists in the MDX body, and a later item adds a frontmatter
// branch that indents after a `key:` line. Each branch returns
// its edits, or nothing when its context does not apply.
func (s *Server) OnTypeFormatting(_ context.Context, params *protocol.DocumentOnTypeFormattingParams) ([]protocol.TextEdit, error) {
	text, ok := s.documents.waitFor(params.TextDocument.URI, 100*time.Millisecond)
	if !ok {
		return nil, nil
	}
	if !isMDXFile(params.TextDocument.URI) || params.Ch != "\n" {
		return nil, nil
	}
	if edits, ok := listOnTypeFormatting(text, params.Position); ok {
		return edits, nil
	}
	return nil, nil
}

type listKind int

const (
	listNumbered listKind = iota
	listBullet
	listTask
)

// listItem is one parsed list item line: its indentation, its
// marker, where the marker and its following spaces end, and
// the text after it.
type listItem struct {
	indent    string
	marker    string
	markerEnd int // byte offset just past the marker and its following spaces
	content   string
	kind      listKind
	number    int
	empty     bool
}

// isTaskMarker reports whether the line starts with a task
// checkbox: `- [ ]`, `- [x]`, or `- [X]`, followed by a space,
// a tab, or the end of the line.
func isTaskMarker(rest string) bool {
	if len(rest) < 5 {
		return false
	}
	switch rest[:5] {
	case "- [ ]", "- [x]", "- [X]":
	default:
		return false
	}
	return len(rest) == 5 || rest[5] == ' ' || rest[5] == '\t'
}

// parseListItem reads a list item line: optional indentation,
// then a numbered (`1. `), bullet (`- `, `* `, `+ `), or task
// (`- [ ] `, `- [x] `) marker. A numbered or bullet marker
// needs a space after it, since a bare `1.` or `-` at the end
// of a line is more likely a number or a stray dash than an
// empty item. A task marker needs no space after it: `- [ ]`
// on its own can only be a task item.
func parseListItem(line string) (listItem, bool) {
	i := 0
	for i < len(line) && (line[i] == ' ' || line[i] == '\t') {
		i++
	}
	item := listItem{indent: line[:i]}
	rest := line[i:]
	switch {
	case isTaskMarker(rest):
		item.kind = listTask
		item.marker = rest[:5]
		item.markerEnd = i + 5
	case len(rest) > 0 && rest[0] >= '0' && rest[0] <= '9':
		j := 0
		for j < len(rest) && rest[j] >= '0' && rest[j] <= '9' {
			j++
		}
		if j >= len(rest) || rest[j] != '.' || j+1 >= len(rest) || rest[j+1] != ' ' {
			return listItem{}, false
		}
		number, err := strconv.Atoi(rest[:j])
		if err != nil {
			return listItem{}, false
		}
		item.kind = listNumbered
		item.marker = rest[:j+1]
		item.number = number
		item.markerEnd = i + j + 1
	case len(rest) > 1 && (rest[0] == '-' || rest[0] == '*' || rest[0] == '+') && rest[1] == ' ':
		item.kind = listBullet
		item.marker = rest[:1]
		item.markerEnd = i + 1
	default:
		return listItem{}, false
	}
	end := item.markerEnd
	for end < len(line) && (line[end] == ' ' || line[end] == '\t') {
		end++
	}
	item.markerEnd = end
	item.content = line[end:]
	item.empty = strings.TrimSpace(item.content) == ""
	return item, true
}

// nextMarker is the marker the new line gets: the next number
// for numbered lists, the same marker for bullets, and always
// an unchecked box for tasks.
func (item listItem) nextMarker() string {
	switch item.kind {
	case listNumbered:
		return strconv.Itoa(item.number+1) + ". "
	case listTask:
		return "- [ ] "
	default:
		return item.marker + " "
	}
}

// listOnTypeFormatting continues a list when Enter is pressed
// at the end of a list item in the MDX body. Numbered items
// increment, bullets repeat, tasks restart unchecked, and
// Enter on an empty item exits the list by deleting its
// marker. It reports false when the context does not apply:
// the previous line is not a list item, it sits inside a
// fenced code block or frontmatter, Enter was pressed
// mid-line, or the editor already inserted a marker on the
// new line (answering then would double it up).
func listOnTypeFormatting(text string, pos protocol.Position) ([]protocol.TextEdit, bool) {
	lines := strings.Split(text, "\n")
	lineNo := int(pos.Line)
	if lineNo == 0 || lineNo >= len(lines) {
		return nil, false
	}
	prev := lineNo - 1
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if prev <= block.endLine {
			return nil, false
		}
		contentStart = block.endLine + 1
	}
	if inFenceBefore(lines, contentStart, prev) {
		return nil, false
	}
	item, ok := parseListItem(lines[prev])
	if !ok {
		return nil, false
	}
	newLine := lines[lineNo]
	cursor := utf16ToByte(newLine, pos.Character)
	if strings.TrimSpace(newLine[cursor:]) != "" {
		return nil, false
	}
	if _, isList := parseListItem(newLine); isList {
		return nil, false
	}
	if item.empty {
		// Enter on an empty item exits the list: the marker
		// (and the indentation) comes off the item line,
		// leaving it blank.
		return []protocol.TextEdit{{
			Range: protocol.Range{
				Start: protocol.Position{Line: uint32(prev), Character: 0},
				End:   protocol.Position{Line: uint32(prev), Character: byteToUTF16(lines[prev], item.markerEnd)},
			},
			NewText: "",
		}}, true
	}
	// Otherwise the new line gets the item's indentation plus
	// the next marker. The range runs from the start of the
	// line through the whitespace the editor auto-inserted
	// around the cursor, so the result is the indent plus the
	// marker whether the editor auto-indented or not.
	end := cursor
	for end < len(newLine) && (newLine[end] == ' ' || newLine[end] == '\t') {
		end++
	}
	return []protocol.TextEdit{{
		Range: protocol.Range{
			Start: protocol.Position{Line: pos.Line, Character: 0},
			End:   protocol.Position{Line: pos.Line, Character: byteToUTF16(newLine, end)},
		},
		NewText: item.indent + item.nextMarker(),
	}}, true
}
