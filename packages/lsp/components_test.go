package main

import (
	"strings"
	"testing"

	"go.lsp.dev/protocol"
)

// posAt splits a test document on the `|` cursor marker and
// returns the clean text and the cursor's position.
func posAt(t *testing.T, marked string) (string, protocol.Position) {
	t.Helper()
	at := strings.Index(marked, "|")
	if at < 0 {
		t.Fatalf("no | marker in %q", marked)
	}
	text := marked[:at] + marked[at+1:]
	line := uint32(strings.Count(marked[:at], "\n"))
	lastNewline := strings.LastIndex(marked[:at], "\n")
	return text, protocol.Position{Line: line, Character: uint32(at - lastNewline - 1)}
}

func TestScanTagName(t *testing.T) {
	for _, tc := range []struct {
		marked  string
		partial string
		name    string
	}{
		{"<|", "", ""},
		{"<B|", "B", "B"},
		{"<Btn|", "Btn", "Btn"},
		{"<Btn variant=\"primary\">x\n<B|", "B", "B"},
	} {
		text, pos := posAt(t, tc.marked)
		ctx := scanTag(text, pos)
		if !ctx.found || ctx.kind != tagName {
			t.Fatalf("scanTag(%q): found = %v, kind = %v, want a tag name", tc.marked, ctx.found, ctx.kind)
		}
		if ctx.partial != tc.partial {
			t.Fatalf("scanTag(%q): partial = %q, want %q", tc.marked, ctx.partial, tc.partial)
		}
		if ctx.name != tc.name {
			t.Fatalf("scanTag(%q): name = %q, want %q", tc.marked, ctx.name, tc.name)
		}
	}
}

func TestScanTagProp(t *testing.T) {
	for _, tc := range []struct {
		marked   string
		partial  string
		existing []string
	}{
		{"<Btn |", "", nil},
		{"<Btn vari|", "vari", nil},
		{"<Btn variant=\"primary\" |", "", []string{"variant"}},
		{"<Btn |variant=\"primary\">", "", []string{"variant"}},
		{"<Btn disabled={true} vari|", "vari", []string{"disabled"}},
	} {
		text, pos := posAt(t, tc.marked)
		ctx := scanTag(text, pos)
		if !ctx.found || ctx.kind != tagProp {
			t.Fatalf("scanTag(%q): found = %v, kind = %v, want a prop name", tc.marked, ctx.found, ctx.kind)
		}
		if ctx.partial != tc.partial {
			t.Fatalf("scanTag(%q): partial = %q, want %q", tc.marked, ctx.partial, tc.partial)
		}
		for _, want := range tc.existing {
			if !ctx.existingProps[want] {
				t.Fatalf("scanTag(%q): existing props = %v, want %q", tc.marked, ctx.existingProps, want)
			}
		}
	}
}

func TestScanTagValue(t *testing.T) {
	for _, tc := range []struct {
		marked  string
		prop    string
		partial string
		quoted  bool
	}{
		{"<Btn variant=|", "variant", "", false},
		{"<Btn variant=\"pr|", "variant", "pr", true},
		{"<Btn variant=\"pri|mary\">", "variant", "pri", true},
		{"<Btn variant=\"primary\" size=|>", "size", "", false},
		{"<Btn title=\"a > b\" variant=|", "variant", "", false},
		{"<Btn\n  variant=|", "variant", "", false},
	} {
		text, pos := posAt(t, tc.marked)
		ctx := scanTag(text, pos)
		if !ctx.found || ctx.kind != tagValue {
			t.Fatalf("scanTag(%q): found = %v, kind = %v, want a prop value", tc.marked, ctx.found, ctx.kind)
		}
		if ctx.prop != tc.prop {
			t.Fatalf("scanTag(%q): prop = %q, want %q", tc.marked, ctx.prop, tc.prop)
		}
		if ctx.partial != tc.partial {
			t.Fatalf("scanTag(%q): partial = %q, want %q", tc.marked, ctx.partial, tc.partial)
		}
		if ctx.quoted != tc.quoted {
			t.Fatalf("scanTag(%q): quoted = %v, want %v", tc.marked, ctx.quoted, tc.quoted)
		}
	}
}

func TestScanTagNotATag(t *testing.T) {
	for _, marked := range []string{
		"a < b|",
		"</Btn|",
		"<Btn variant=\"primary\">|",
		"```\n<Btn|\n```\n",
		"---\ntitle: <|\n---\n",
		"# Hello\n\nSome text| here\n",
	} {
		text, pos := posAt(t, marked)
		ctx := scanTag(text, pos)
		if ctx.found {
			t.Fatalf("scanTag(%q): found a tag, want none (kind = %v)", marked, ctx.kind)
		}
	}
}

func TestScanTagHoverTokens(t *testing.T) {
	for _, tc := range []struct {
		marked string
		kind   tagTokenKind
		prop   string
	}{
		{"<B|tn variant=\"primary\">", tokenName, ""},
		{"<Btn var|iant=\"primary\">", tokenPropName, "variant"},
		{"<Btn variant=\"pri|mary\">", tokenPropValue, "variant"},
		{"<Btn variant|=\"primary\">", tokenPropName, "variant"},
	} {
		text, pos := posAt(t, tc.marked)
		ctx := scanTag(text, pos)
		if !ctx.found {
			t.Fatalf("scanTag(%q): no tag found", tc.marked)
		}
		if ctx.token.kind != tc.kind {
			t.Fatalf("scanTag(%q): token kind = %v, want %v", tc.marked, ctx.token.kind, tc.kind)
		}
		if ctx.token.prop != tc.prop {
			t.Fatalf("scanTag(%q): token prop = %q, want %q", tc.marked, ctx.token.prop, tc.prop)
		}
	}
}

func TestScanTagNameRange(t *testing.T) {
	text, pos := posAt(t, "<B|tn>")
	ctx := scanTag(text, pos)
	if ctx.nameRange.Start.Line != 0 || ctx.nameRange.Start.Character != 1 {
		t.Fatalf("name range start = %+v, want (0, 1)", ctx.nameRange.Start)
	}
	if ctx.nameRange.End.Line != 0 || ctx.nameRange.End.Character != 4 {
		t.Fatalf("name range end = %+v, want (0, 4)", ctx.nameRange.End)
	}
}
