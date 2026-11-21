package main

import (
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"go.lsp.dev/protocol"
)

func TestScanShortcode(t *testing.T) {
	cases := []struct {
		name      string
		text      string
		line      uint32
		char      uint32
		found     bool
		partial   string
		startChar uint32 // when found: the opening `:`
	}{
		{"bare colon", ":", 0, 1, true, "", 0},
		{"colon after space", "Hello :", 0, 7, true, "", 6},
		{"partial name", "Hello :sm", 0, 9, true, "sm", 6},
		{"url scheme", "http:", 0, 5, false, "", 0},
		{"time", "12:30", 0, 5, false, "", 0},
		{"colon after word", "x:smile", 0, 7, false, "", 0},
		{"after paren", "(:smile", 0, 7, true, "smile", 1},
		{"after bracket", "[:smile", 0, 7, true, "smile", 1},
		{"after brace", "a {:smile", 0, 9, true, "smile", 3},
		{"after double quote", "a \":sm", 0, 6, true, "sm", 3},
		{"after single quote", "a ':smile", 0, 9, true, "smile", 3},
		{"indented", "  :smile", 0, 8, true, "smile", 2},
		{"code span", "`x :smile`", 0, 9, false, "", 0},
		{"fenced code", "```\n:smile\n```", 1, 6, false, "", 0},
		{"frontmatter", "---\n:smile\n---\n", 1, 6, false, "", 0},
		{"unclosed frontmatter", "---\n:smile\n", 1, 6, false, "", 0},
		{"cursor inside closed shortcode", ":smile:", 0, 5, false, "", 0},
		{"cursor before closing colon", ":smile:", 0, 6, false, "", 0},
		{"after icon prefix colon", ":si:git", 0, 8, false, "", 0},
		{"double colon", "::smile", 0, 7, false, "", 0},
		{"quoted prop value", "<Btn title=\":sm\">", 0, 15, false, "", 0},
		{"plus one", ":+1", 0, 3, true, "+1", 0},
		{"trailing hyphen", ":smile-", 0, 7, true, "smile-", 0},
		{"second shortcode", ":smile :wave", 0, 12, true, "wave", 7},
		{"second shortcode after closed one", ":smile: :wave", 0, 13, true, "wave", 8},
		{"partial with text after", ":smi le", 0, 4, true, "smi", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			context := scanShortcode(c.text, protocol.Position{Line: c.line, Character: c.char})
			if context.found != c.found {
				t.Fatalf("found = %v, want %v", context.found, c.found)
			}
			if !c.found {
				return
			}
			if context.partial != c.partial {
				t.Fatalf("partial = %q, want %q", context.partial, c.partial)
			}
			rng := context.partialRange
			if rng.Start.Line != c.line || rng.Start.Character != c.startChar {
				t.Fatalf("range start = %d:%d, want %d:%d (the opening colon)", rng.Start.Line, rng.Start.Character, c.line, c.startChar)
			}
			if rng.End.Line != c.line || rng.End.Character != c.char {
				t.Fatalf("range end = %d:%d, want %d:%d (the cursor)", rng.End.Line, rng.End.Character, c.line, c.char)
			}
		})
	}
}

// The generated emoji table is sorted by name, covers the
// shortcodes the build renders, and carries a glyph per name.
func TestEmojiShortcodesSorted(t *testing.T) {
	if len(emojiShortcodes) < 1000 {
		t.Fatalf("emojiShortcodes = %d entries, want over 1000", len(emojiShortcodes))
	}
	if !sort.SliceIsSorted(emojiShortcodes, func(i, j int) bool { return emojiShortcodes[i].name < emojiShortcodes[j].name }) {
		t.Fatal("emojiShortcodes is not sorted by name")
	}
	byName := map[string]string{}
	for _, emoji := range emojiShortcodes {
		if emoji.glyph == "" {
			t.Fatalf("emoji %q has no glyph", emoji.name)
		}
		byName[emoji.name] = emoji.glyph
	}
	if byName["smile"] != "😄" {
		t.Fatalf("smile = %q, want 😄", byName["smile"])
	}
	if byName["+1"] != "👍" || byName["-1"] != "👎" {
		t.Fatalf("+1/-1 = %q/%q, want 👍/👎", byName["+1"], byName["-1"])
	}
}

// Every usable icon prefix has a pack name for its detail.
func TestIconPackNamesCoverPrefixes(t *testing.T) {
	if len(iconPackNames) != len(validIconPrefixes) {
		t.Fatalf("iconPackNames = %d prefixes, validIconPrefixes = %d", len(iconPackNames), len(validIconPrefixes))
	}
	for prefix := range validIconPrefixes {
		if iconPackNames[prefix] == "" {
			t.Fatalf("prefix %q has no pack name", prefix)
		}
	}
}

func TestShortcodeCompletionOffersIconsAndEmoji(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Hello :\n")
	items := s.complete(t, documentURI, 0, 7)
	want := len(emojiShortcodes) + len(iconPackNames)
	if len(items) != want {
		t.Fatalf("shortcode completions = %d, want %d (every emoji plus every icon pack)", len(items), want)
	}
	for _, label := range []string{":si:", ":lu:", ":fa:", ":fas:", ":simple-icons:", ":smile:", ":rocket:", ":+1:"} {
		if !hasLabel(items, label) {
			t.Fatalf("shortcode completions missing %q", label)
		}
	}
	if detail := completionDetail(items, ":si:"); detail != "Simple Icons" {
		t.Fatalf("detail for :si: = %q, want the pack name", detail)
	}
	if detail := completionDetail(items, ":smile:"); detail != "😄" {
		t.Fatalf("detail for :smile: = %q, want the glyph", detail)
	}
	for _, item := range items {
		if item.Kind != protocol.CompletionItemKindText {
			t.Fatalf("kind for %q = %v, want Text", item.Label, item.Kind)
		}
	}
}

func TestShortcodeCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Hello :sm\n")
	items := s.complete(t, documentURI, 0, 9)
	for _, label := range []string{":smile:", ":smiley:"} {
		if !hasLabel(items, label) {
			t.Fatalf("shortcode completions %v missing %q", labels(items), label)
		}
	}
	for _, item := range items {
		if !strings.HasPrefix(item.Label, ":sm") {
			t.Fatalf("completion %q does not match the typed :sm", item.Label)
		}
	}
	if hasLabel(items, ":rocket:") || hasLabel(items, ":si:") {
		t.Fatalf("shortcode completions %v include items outside the :sm filter", labels(items))
	}
}

func TestShortcodeCompletionIconPackInsertsPrefix(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Hello :s\n")
	items := s.complete(t, documentURI, 0, 8)
	if text, ok := editText(items, ":si:"); !ok || text != ":si:" {
		t.Fatalf(":si: edit = %q, want %q", text, ":si:")
	}
	edit := editRange(items, ":si:")
	if edit.Start.Character != 6 || edit.End.Character != 8 {
		t.Fatalf(":si: edit range = %d-%d, want 6-8 (the colon and the partial)", edit.Start.Character, edit.End.Character)
	}
}

func TestShortcodeCompletionEmojiInsertsWhole(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Hello :sm\n")
	items := s.complete(t, documentURI, 0, 9)
	if text, ok := editText(items, ":smile:"); !ok || text != ":smile:" {
		t.Fatalf(":smile: edit = %q, want %q", text, ":smile:")
	}
}

func TestShortcodeCompletionEmojiDisabled(t *testing.T) {
	root := fixtureProjectWithConfig(t, "site:\n  content:\n    render_emoji_shortcodes: false\n")
	s := startTestServer(t, root)
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Hello :\n")
	items := s.complete(t, documentURI, 0, 7)
	if len(items) != len(iconPackNames) {
		t.Fatalf("shortcode completions = %d, want %d (icons only, emoji off)", len(items), len(iconPackNames))
	}
	if !hasLabel(items, ":si:") {
		t.Fatalf("shortcode completions %v missing :si:", labels(items))
	}
	if hasLabel(items, ":smile:") {
		t.Fatalf("shortcode completions %v include :smile: with emoji off", labels(items))
	}
}

func TestShortcodeCompletionNoTriggerAfterURL(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "See http:\n")
	items := s.complete(t, documentURI, 0, 9)
	if len(items) != 0 {
		t.Fatalf("completions after http: = %v, want none", labels(items))
	}
}

func TestShortcodeCompletionNoTriggerInCodeSpan(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "Use `x :smile` here\n")
	items := s.complete(t, documentURI, 0, 13)
	if len(items) != 0 {
		t.Fatalf("completions in a code span = %v, want none", labels(items))
	}
}

// completionDetail returns the detail of the item with the
// given label, or "" when it has none.
func completionDetail(items []protocol.CompletionItem, label string) string {
	for _, item := range items {
		if item.Label != label {
			continue
		}
		detail, _ := item.Detail.Get()
		return detail
	}
	return ""
}

// editRange returns the text edit range of the item with the
// given label.
func editRange(items []protocol.CompletionItem, label string) protocol.Range {
	for _, item := range items {
		if item.Label != label {
			continue
		}
		if edit, ok := item.TextEdit.(*protocol.TextEdit); ok {
			return edit.Range
		}
	}
	return protocol.Range{}
}
