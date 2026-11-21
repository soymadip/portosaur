package main

import (
	"sort"
	"strings"

	"go.lsp.dev/protocol"
)

// Shortcode completion: in MDX prose, after a `:` the server
// offers icon shortcodes (`:prefix:name:`, rendered by
// remarkIcons) and emoji shortcodes (`:smile:`, rendered by
// remark-emoji). Picking an icon pack inserts `:prefix:` with
// the cursor ready for the icon name; picking an emoji inserts
// the whole `:name:`. Emoji are offered only when the site
// renders them (`site.content.render_emoji_shortcodes`, default
// true); icons are always offered.

// shortcodeContext describes the shortcode the cursor sits
// inside: the partial name after the opening `:` and the range
// from that `:` to the cursor, so the pick replaces the whole
// typed fragment including the colon.
type shortcodeContext struct {
	found        bool
	partial      string // the name being typed after `:`
	partialRange protocol.Range
}

func isShortcodeChar(c byte) bool {
	return c == '_' || c == '-' || c == '+' ||
		(c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

// scanShortcode finds the shortcode the cursor sits inside, when
// there is one: a `:` that starts a shortcode (at the start of
// the line, or after whitespace or one of `([{"'`) followed by
// an optional partial name, with no closing `:` yet. The guard
// on the preceding character keeps `http:` and `12:30` from
// triggering, and the second `:` of `:prefix:name:` from
// offering emoji while the icon name is typed. Shortcodes in
// fenced code, the frontmatter, an inline code span, or a quoted
// prop value are not shortcodes.
func scanShortcode(text string, pos protocol.Position) shortcodeContext {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return shortcodeContext{}
		}
		contentStart = block.endLine + 1
	}
	lineNo := int(pos.Line)
	if lineNo < contentStart || lineNo >= len(lines) {
		return shortcodeContext{}
	}
	if fenceLines(lines, contentStart)[lineNo] {
		return shortcodeContext{}
	}
	line := lines[lineNo]
	cursor := utf16ToByte(line, pos.Character)
	if tag := scanTag(text, pos); tag.found && tag.kind == tagValue && tag.quoted {
		return shortcodeContext{}
	}
	// The partial runs back from the cursor to the opening `:`.
	start := cursor
	for start > 0 && isShortcodeChar(line[start-1]) {
		start--
	}
	if start == 0 || line[start-1] != ':' {
		return shortcodeContext{}
	}
	colon := start - 1
	if colon > 0 {
		before := line[colon-1]
		if before != ' ' && before != '\t' && strings.IndexByte("([{\"'", before) < 0 {
			return shortcodeContext{}
		}
	}
	if inCodeSpan(codeSpanRanges(line), colon) {
		return shortcodeContext{}
	}
	// A `:` ahead closes the shortcode already: the cursor sits
	// inside a complete one, with nothing to complete.
	end := cursor
	for end < len(line) && isShortcodeChar(line[end]) {
		end++
	}
	if end < len(line) && line[end] == ':' {
		return shortcodeContext{}
	}
	lineStart := 0
	for i := 0; i < lineNo; i++ {
		lineStart += len(lines[i]) + 1
	}
	return shortcodeContext{
		found:        true,
		partial:      line[start:cursor],
		partialRange: rangeFromOffsets(lines, lineStart+colon, lineStart+cursor),
	}
}

// shortcodeCompletion offers icon packs and emoji shortcodes at
// the cursor. The second return value reports whether the
// cursor is in a shortcode at all: when it is not, the caller
// falls through to component completion.
func (s *Server) shortcodeCompletion(params *protocol.CompletionParams, text string, root string) (*protocol.CompletionList, bool) {
	context := scanShortcode(text, params.Position)
	if !context.found {
		return nil, false
	}
	var items []protocol.CompletionItem
	for prefix, pack := range iconPackNames {
		if !strings.HasPrefix(prefix, context.partial) {
			continue
		}
		label := ":" + prefix + ":"
		items = append(items, protocol.CompletionItem{
			Label:    label,
			Kind:     protocol.CompletionItemKindText,
			Detail:   protocol.NewOptional(pack),
			TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: label},
		})
	}
	cfg := loadProjectConfig(root)
	if configBool(cfg, []string{"site", "content", "render_emoji_shortcodes"}, true) {
		for _, emoji := range emojiShortcodes {
			if !strings.HasPrefix(emoji.name, context.partial) {
				continue
			}
			label := ":" + emoji.name + ":"
			items = append(items, protocol.CompletionItem{
				Label:    label,
				Kind:     protocol.CompletionItemKindText,
				Detail:   protocol.NewOptional(emoji.glyph),
				TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: label},
			})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}, true
}
