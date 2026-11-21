package main

import (
	"path/filepath"
	"testing"

	"go.lsp.dev/protocol"
)

// typeEnter opens a document in the state after Enter was
// pressed — the newline already in the text — and asks the
// server what it would insert at the cursor.
func typeEnter(t *testing.T, text string, line, character uint32) []protocol.TextEdit {
	t.Helper()
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), text)
	return s.onTypeFormatting(t, documentURI, line, character, "\n")
}

// wantEdit fails unless the edits are exactly one edit with
// the given range and text.
func wantEdit(t *testing.T, edits []protocol.TextEdit, startLine, startChar, endLine, endChar uint32, text string) {
	t.Helper()
	if len(edits) != 1 {
		t.Fatalf("edits = %v, want exactly one edit", edits)
	}
	want := protocol.Range{
		Start: protocol.Position{Line: startLine, Character: startChar},
		End:   protocol.Position{Line: endLine, Character: endChar},
	}
	if edits[0].Range != want {
		t.Fatalf("edit range = %v, want %v", edits[0].Range, want)
	}
	if edits[0].NewText != text {
		t.Fatalf("edit text = %q, want %q", edits[0].NewText, text)
	}
}

// wantNoEdits fails unless the server answers nothing.
func wantNoEdits(t *testing.T, edits []protocol.TextEdit) {
	t.Helper()
	if len(edits) != 0 {
		t.Fatalf("edits = %v, want none", edits)
	}
}

func TestListOnTypeContinues(t *testing.T) {
	cases := []struct {
		name string
		text string
		line uint32
		char uint32
		want string
	}{
		{"numbered", "1. llll\n", 1, 0, "2. "},
		{"numbered increments", "3. x\n", 1, 0, "4. "},
		{"bullet dash", "- item\n", 1, 0, "- "},
		{"bullet star", "* item\n", 1, 0, "* "},
		{"bullet plus", "+ item\n", 1, 0, "+ "},
		{"task unchecked", "- [ ] todo\n", 1, 0, "- [ ] "},
		{"task checked restarts unchecked", "- [x] done\n", 1, 0, "- [ ] "},
		{"task capital X", "- [X] done\n", 1, 0, "- [ ] "},
		{"indented bullet", "  - item\n", 1, 0, "  - "},
		{"indented numbered", "    2. x\n", 1, 0, "    3. "},
		{"after closed fence", "```\ncode\n```\n- item\n", 4, 0, "- "},
		{"after closed frontmatter", "---\ntitle: x\n---\n- item\n", 4, 0, "- "},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			edits := typeEnter(t, tc.text, tc.line, tc.char)
			wantEdit(t, edits, tc.line, 0, tc.line, 0, tc.want)
		})
	}
}

// TestListOnTypeAutoIndent checks the edit when the editor
// already indented the new line: the indent is replaced by
// itself plus the marker, so the result is the same either way.
func TestListOnTypeAutoIndent(t *testing.T) {
	edits := typeEnter(t, "  - item\n  ", 1, 2)
	wantEdit(t, edits, 1, 0, 1, 2, "  - ")
}

func TestListOnTypeEmptyItemExits(t *testing.T) {
	cases := []struct {
		name string
		text string
		end  uint32 // end character of the marker on line 0
	}{
		{"numbered", "2. \n", 3},
		{"bullet", "- \n", 2},
		{"task", "- [ ] \n", 6},
		{"task without trailing space", "- [ ]\n", 5},
		{"indented bullet", "  - \n", 4},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			edits := typeEnter(t, tc.text, 1, 0)
			wantEdit(t, edits, 0, 0, 0, tc.end, "")
		})
	}
}

func TestListOnTypeSkipped(t *testing.T) {
	cases := []struct {
		name string
		text string
		line uint32
		char uint32
	}{
		{"plain line", "plain text\n", 1, 0},
		{"first line", "", 0, 0},
		{"inside fenced code", "```\n- item\n", 2, 0},
		{"inside unclosed frontmatter", "---\n- item\n", 2, 0},
		{"inside closed frontmatter", "---\n- item\n---\n", 2, 0},
		{"marker already inserted", "- item\n- ", 1, 2},
		{"numbered marker already inserted", "1. a\n2. ", 1, 3},
		{"enter mid-line", "1. llll\nrest", 1, 0},
		{"bare number", "2024.\n", 1, 0},
		{"dash alone", "-\n", 1, 0},
		{"no space after marker", "-foo\n", 1, 0},
		{"blockquote list", "> - item\n", 1, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			wantNoEdits(t, typeEnter(t, tc.text, tc.line, tc.char))
		})
	}
}

// TestListOnTypeNonMDX checks the handler stays quiet outside
// MDX files.
func TestListOnTypeNonMDX(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.openNoWait(t, filepath.Join(s.root, "other.yaml"), "- item\n")
	wantNoEdits(t, s.onTypeFormatting(t, documentURI, 1, 0, "\n"))
}

// TestListOnTypeOtherCharacter checks the handler only answers
// the newline trigger.
func TestListOnTypeOtherCharacter(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "- item\n")
	wantNoEdits(t, s.onTypeFormatting(t, documentURI, 1, 0, "x"))
}

func TestParseListItem(t *testing.T) {
	cases := []struct {
		line    string
		ok      bool
		kind    listKind
		marker  string
		content string
		empty   bool
	}{
		{"1. llll", true, listNumbered, "1.", "llll", false},
		{"007. x", true, listNumbered, "007.", "x", false},
		{"- item", true, listBullet, "-", "item", false},
		{"* item", true, listBullet, "*", "item", false},
		{"+ item", true, listBullet, "+", "item", false},
		{"- [ ] todo", true, listTask, "- [ ]", "todo", false},
		{"- [x] done", true, listTask, "- [x]", "done", false},
		{"- [X] done", true, listTask, "- [X]", "done", false},
		{"- [ ]", true, listTask, "- [ ]", "", true},
		{"2. ", true, listNumbered, "2.", "", true},
		{"- ", true, listBullet, "-", "", true},
		{"  - item", true, listBullet, "-", "item", false},
		{"\t1. x", true, listNumbered, "1.", "x", false},
		{"plain", false, 0, "", "", false},
		{"", false, 0, "", "", false},
		{"1.", false, 0, "", "", false},
		{"-", false, 0, "", "", false},
		{"1.x", false, 0, "", "", false},
		{"-foo", false, 0, "", "", false},
		{"- [y] x", true, listBullet, "-", "[y] x", false},
		{"- [ ]x", true, listBullet, "-", "[ ]x", false},
		{"> - item", false, 0, "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.line, func(t *testing.T) {
			item, ok := parseListItem(tc.line)
			if ok != tc.ok {
				t.Fatalf("parseListItem(%q) ok = %v, want %v", tc.line, ok, tc.ok)
			}
			if !ok {
				return
			}
			if item.kind != tc.kind || item.marker != tc.marker || item.content != tc.content || item.empty != tc.empty {
				t.Fatalf("parseListItem(%q) = kind %v marker %q content %q empty %v, want kind %v marker %q content %q empty %v",
					tc.line, item.kind, item.marker, item.content, item.empty, tc.kind, tc.marker, tc.content, tc.empty)
			}
		})
	}
}
