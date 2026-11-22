package main

import (
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// Headings: the ATX headings of a document, with the ids the
// site renders for them. Shared by go-to-definition (the `#hash`
// of a link), heading completion, and the document outline.

// heading is one ATX heading: its level, plain text, rendered
// id, 0-based document line, and the byte offsets of its text
// within the line (for the outline's selection range).
type heading struct {
	level    int
	text     string
	id       string
	line     int
	textFrom int
	textTo   int
}

var atxHeadingRe = regexp.MustCompile(`^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$`)

// headingCustomIDRe matches Fumadocs' custom heading id: a
// trailing `[#id]` at the end of the heading text. The id is
// used verbatim, never slugged.
var headingCustomIDRe = regexp.MustCompile(`\s*\[#(.+?)\]\s*$`)

// extractHeadings returns the document's ATX headings, outside
// the frontmatter and fenced code blocks. Ids follow the site's
// slugger, with `-1`, `-2` suffixes for repeats. A trailing
// `[#id]` sets the id verbatim instead, like Fumadocs: repeats
// of a custom id keep the same id, but the id is still recorded,
// so a later plain heading slugging to it gets the `-1` suffix.
func extractHeadings(text string) []heading {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		contentStart = block.endLine + 1
	}
	fences := fenceLines(lines, contentStart)
	seen := map[string]int{}
	var out []heading
	for i := contentStart; i < len(lines); i++ {
		if fences[i] {
			continue
		}
		match := atxHeadingRe.FindStringSubmatchIndex(lines[i])
		if match == nil {
			continue
		}
		raw := lines[i][match[4]:match[5]]
		textTo := match[5]
		customID := ""
		if m := headingCustomIDRe.FindStringSubmatchIndex(raw); m != nil {
			customID = raw[m[2]:m[3]]
			raw = raw[:m[0]]
			textTo = match[4] + m[0]
		}
		plain := plainHeadingText(raw)
		var id string
		if customID != "" {
			id = customID
		} else {
			id = githubSlug(plain)
			if id == "" {
				continue
			}
		}
		if n, ok := seen[id]; ok {
			seen[id] = n + 1
			if customID == "" {
				id = id + "-" + strconv.Itoa(n+1)
			}
		} else {
			seen[id] = 0
		}
		out = append(out, heading{
			level:    len(lines[i][match[2]:match[3]]),
			text:     plain,
			id:       id,
			line:     i,
			textFrom: match[4],
			textTo:   textTo,
		})
	}
	return out
}

var (
	headingLinkRe = regexp.MustCompile(`\[([^\]]*)\]\([^)]*\)`)
	headingTagRe  = regexp.MustCompile(`<[^>]*>`)
)

// plainHeadingText strips inline markdown from a heading: code
// spans, emphasis markers, links (keeping the text), images and
// HTML tags. Code-span content is literal, so it is kept whole
// instead of having its markers stripped.
func plainHeadingText(text string) string {
	text = headingLinkRe.ReplaceAllString(text, "$1")
	text = headingTagRe.ReplaceAllString(text, "")
	var b strings.Builder
	rest := text
	for {
		i := strings.Index(rest, "`")
		if i < 0 {
			b.WriteString(stripEmphasis(rest))
			break
		}
		b.WriteString(stripEmphasis(rest[:i]))
		j := strings.Index(rest[i+1:], "`")
		if j < 0 {
			b.WriteString(stripEmphasis(rest[i+1:]))
			break
		}
		b.WriteString(rest[i+1 : i+1+j])
		rest = rest[i+1+j+1:]
	}
	return strings.TrimSpace(b.String())
}

// stripEmphasis removes `*` and `**` emphasis markers and
// underscore emphasis markers. An underscore run between two
// word characters is part of the word (like `topic_list`), not
// emphasis, so it is kept.
func stripEmphasis(text string) string {
	text = strings.ReplaceAll(text, "**", "")
	text = strings.ReplaceAll(text, "*", "")
	return stripEmphasisUnderscores(text)
}

// stripEmphasisUnderscores removes `_` runs that are not
// between two word characters.
func stripEmphasisUnderscores(text string) string {
	runes := []rune(text)
	var b strings.Builder
	for i := 0; i < len(runes); i++ {
		if runes[i] != '_' {
			b.WriteRune(runes[i])
			continue
		}
		j := i
		for j < len(runes) && runes[j] == '_' {
			j++
		}
		prevWord := i > 0 && isWordRune(runes[i-1])
		nextWord := j < len(runes) && isWordRune(runes[j])
		if prevWord && nextWord {
			b.WriteString(string(runes[i:j]))
		}
		i = j - 1
	}
	return b.String()
}

// isWordRune reports whether r is a word character: a letter,
// a digit, or an underscore.
func isWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_'
}

// githubSlug turns heading text into its id: lowercase, strip
// punctuation, spaces to hyphens, repeats collapsed. Mirrors
// github-slugger, which the site's heading ids come from.
func githubSlug(text string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(text) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if r == ' ' || r == '\t' {
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
			continue
		}
	}
	return strings.Trim(b.String(), "-")
}
