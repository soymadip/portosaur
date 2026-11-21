package main

import (
	"reflect"
	"testing"

	"go.lsp.dev/protocol"
)

func pos(line, character uint32) protocol.Position {
	return protocol.Position{Line: line, Character: character}
}

func TestAnalyzeCursor(t *testing.T) {
	tests := []struct {
		name           string
		text           string
		pos            protocol.Position
		wantKind       cursorKind
		wantPath       []string
		wantKey        string
		wantPartial    string
		wantExisting   []string
		wantOrphanPath []string
	}{
		{
			name:     "empty doc completes a root key",
			text:     "",
			pos:      pos(0, 0),
			wantKind: cursorKey,
		},
		{
			name:        "partial root key",
			text:        "si",
			pos:         pos(0, 2),
			wantKind:    cursorKey,
			wantPartial: "si",
		},
		{
			name:     "blank line under site",
			text:     "site:\n  ",
			pos:      pos(1, 2),
			wantKind: cursorKey,
			wantPath: []string{"site"},
		},
		{
			name:     "blank line nested three deep",
			text:     "site:\n  content:\n    toc:\n      ",
			pos:      pos(3, 6),
			wantKind: cursorKey,
			wantPath: []string{"site", "content", "toc"},
		},
		{
			name:     "blank line back at root",
			text:     "site:\n  title: x\n",
			pos:      pos(2, 0),
			wantKind: cursorKey,
			wantPath: nil,
		},
		{
			name:           "blank column-0 line under a childless key",
			text:           "toc:\n",
			pos:            pos(1, 0),
			wantKind:       cursorKey,
			wantPath:       nil,
			wantOrphanPath: []string{"toc"},
		},
		{
			name:     "blank column-0 line under a key with children",
			text:     "toc:\n  enable: true\n",
			pos:      pos(2, 0),
			wantKind: cursorKey,
			wantPath: nil,
		},
		{
			name:           "blank column-0 line under a value-less scalar key",
			text:           "title:\n",
			pos:            pos(1, 0),
			wantKind:       cursorKey,
			wantPath:       nil,
			wantOrphanPath: []string{"title"},
		},
		{
			name:           "blank column-0 line under a nested childless key",
			text:           "site:\n  content:\n    toc:\n",
			pos:            pos(3, 0),
			wantKind:       cursorKey,
			wantPath:       nil,
			wantOrphanPath: []string{"site", "content", "toc"},
		},
		{
			name:           "a comment between the key and the blank line",
			text:           "toc:\n# note\n",
			pos:            pos(2, 0),
			wantKind:       cursorKey,
			wantPath:       nil,
			wantOrphanPath: []string{"toc"},
		},
		{
			name:           "partial key on a column-0 line under a childless key",
			text:           "toc:\nen",
			pos:            pos(1, 2),
			wantKind:       cursorKey,
			wantPath:       nil,
			wantPartial:    "en",
			wantOrphanPath: []string{"toc"},
		},
		{
			name:        "partial key under a key with children",
			text:        "toc:\n  enable: true\nen",
			pos:         pos(2, 2),
			wantKind:    cursorKey,
			wantPath:    nil,
			wantPartial: "en",
		},
		{
			name:           "partial key under a value-less scalar key",
			text:           "title:\nde",
			pos:            pos(1, 2),
			wantKind:       cursorKey,
			wantPath:       nil,
			wantPartial:    "de",
			wantOrphanPath: []string{"title"},
		},
		{
			name:        "a line with a colon typed is not an orphan",
			text:        "toc:\nenable: true",
			pos:         pos(1, 3),
			wantKind:    cursorKey,
			wantPath:    nil,
			wantPartial: "ena",
		},
		{
			name:        "a partial key with a hyphen is not an orphan",
			text:        "toc:\nmax-l",
			pos:         pos(1, 5),
			wantKind:    cursorKey,
			wantPath:    nil,
			wantPartial: "max-l",
		},
		{
			name:     "blank line under a key with a value",
			text:     "title: x\n",
			pos:      pos(1, 0),
			wantKind: cursorKey,
			wantPath: nil,
		},
		{
			name:     "value after the colon",
			text:     "site:\n  title: ",
			pos:      pos(1, 9),
			wantKind: cursorValue,
			wantPath: []string{"site"},
			wantKey:  "title",
		},
		{
			name:        "partial value nested",
			text:        "site:\n  content:\n    toc:\n      enable: tr",
			pos:         pos(3, 16),
			wantKind:    cursorValue,
			wantPath:    []string{"site", "content", "toc"},
			wantKey:     "enable",
			wantPartial: "tr",
		},
		{
			name:         "existing keys are known",
			text:         "site:\n  title: x\n  ",
			pos:          pos(2, 2),
			wantKind:     cursorKey,
			wantPath:     []string{"site"},
			wantExisting: []string{"title"},
		},
		{
			name:     "a dedent ends the sibling list",
			text:     "site:\n  title: x\ntheme:\n  ",
			pos:      pos(3, 2),
			wantKind: cursorKey,
			wantPath: []string{"theme"},
		},
		{
			name:     "list item completes nothing",
			text:     "tags:\n  - a\n  - ",
			pos:      pos(2, 4),
			wantKind: cursorNone,
		},
		{
			name:     "comment line completes nothing",
			text:     "# a note",
			pos:      pos(0, 8),
			wantKind: cursorNone,
		},
		{
			name:     "cursor right before the colon completes nothing",
			text:     "site:\n  title: x",
			pos:      pos(1, 7),
			wantKind: cursorNone,
		},
		{
			name:        "cursor mid-key still completes the key",
			text:        "site:\n  title: x",
			pos:         pos(1, 5),
			wantKind:    cursorKey,
			wantPath:    []string{"site"},
			wantPartial: "tit",
		},
		{
			name:     "quoted key value",
			text:     "\"my-key\": ",
			pos:      pos(0, 11),
			wantKind: cursorValue,
			wantKey:  "my-key",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := analyzeCursor(tc.text, tc.pos)
			if got.kind != tc.wantKind {
				t.Fatalf("kind = %v, want %v", got.kind, tc.wantKind)
			}
			if !reflect.DeepEqual(got.path, tc.wantPath) {
				t.Fatalf("path = %v, want %v", got.path, tc.wantPath)
			}
			if !reflect.DeepEqual(got.orphanPath, tc.wantOrphanPath) {
				t.Fatalf("orphanPath = %v, want %v", got.orphanPath, tc.wantOrphanPath)
			}
			if got.key != tc.wantKey {
				t.Fatalf("key = %q, want %q", got.key, tc.wantKey)
			}
			if got.partial != tc.wantPartial {
				t.Fatalf("partial = %q, want %q", got.partial, tc.wantPartial)
			}
			for _, key := range tc.wantExisting {
				if !got.existingKeys[key] {
					t.Fatalf("existingKeys missing %q (got %v)", key, got.existingKeys)
				}
			}
		})
	}
}

func TestAnalyzeCursorPartialRange(t *testing.T) {
	got := analyzeCursor("site:\n  ti", pos(1, 4))
	if got.partialRange.Start.Line != 1 || got.partialRange.Start.Character != 2 {
		t.Fatalf("partial range start = %+v, want line 1 char 2", got.partialRange.Start)
	}
	if got.partialRange.End.Line != 1 || got.partialRange.End.Character != 4 {
		t.Fatalf("partial range end = %+v, want line 1 char 4", got.partialRange.End)
	}
}

func TestAnalyzeCursorUTF16(t *testing.T) {
	// An emoji before the cursor: two UTF-16 units, one rune,
	// four bytes. Character 2 is just past it.
	got := analyzeCursor("🎉 ", pos(0, 2))
	if got.kind != cursorKey {
		t.Fatalf("kind = %v, want cursorKey", got.kind)
	}
	if got.partial != "🎉" {
		t.Fatalf("partial = %q, want the emoji", got.partial)
	}
}
