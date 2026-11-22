package main

import (
	"testing"
)

func TestLinkAtCursorMarkdown(t *testing.T) {
	text, pos := posAt(t, "[install](/docs/getting-started/installation/|)")
	ctx := linkAtCursor(text, pos)
	if !ctx.found {
		t.Fatal("no link found at the cursor")
	}
	if ctx.value != "/docs/getting-started/installation/" {
		t.Fatalf("value = %q, want the full destination", ctx.value)
	}
	if ctx.partial != "/docs/getting-started/installation/" {
		t.Fatalf("partial = %q, want the destination before the cursor", ctx.partial)
	}
}

func TestLinkAtCursorMarkdownPartial(t *testing.T) {
	text, pos := posAt(t, "[install](/docs/get|ting-started/)")
	ctx := linkAtCursor(text, pos)
	if !ctx.found || ctx.partial != "/docs/get" {
		t.Fatalf("link = %+v, want partial /docs/get", ctx)
	}
	if ctx.value != "/docs/getting-started/" {
		t.Fatalf("value = %q, want the full destination", ctx.value)
	}
}

func TestLinkAtCursorMarkdownAngleBrackets(t *testing.T) {
	text, pos := posAt(t, "[mp](<./my page|.mdx>)")
	ctx := linkAtCursor(text, pos)
	if !ctx.found || ctx.value != "./my page.mdx" {
		t.Fatalf("link = %+v, want value ./my page.mdx", ctx)
	}
}

func TestLinkAtCursorJSX(t *testing.T) {
	text, pos := posAt(t, "<Link href=\"/docs/get|ting-started/\">x</Link>")
	ctx := linkAtCursor(text, pos)
	if !ctx.found || ctx.value != "/docs/getting-started/" || ctx.partial != "/docs/get" {
		t.Fatalf("link = %+v, want the Link href value", ctx)
	}
}

func TestLinkAtCursorJSXExpression(t *testing.T) {
	text, pos := posAt(t, "<Link href={u|rl}>x</Link>")
	if ctx := linkAtCursor(text, pos); ctx.found {
		t.Fatalf("link = %+v, want none for an expression value", ctx)
	}
}

func TestLinkAtCursorNotALink(t *testing.T) {
	for _, marked := range []string{
		"Just some text| here.",
		"[text][ref|]",
		"```\n[x](/docs/page/|)\n```\n",
		"---\ntitle: [x](/docs/page/|)\n---\n",
		"Use `[x](/docs/page/|)` here.",
		"<Btn variant=\"prim|ary\">x</Btn>",
		"<Icon id=\"lu:st|ar\">",
	} {
		text, pos := posAt(t, marked)
		if ctx := linkAtCursor(text, pos); ctx.found {
			t.Fatalf("linkAtCursor(%q) = %+v, want none", marked, ctx)
		}
	}
}

func TestScanMarkdownImages(t *testing.T) {
	text := "---\ntitle: ![fm](/docs/fm.png)\n---\n\n![a](/images/one.png)\n\n[b](/docs/page/)\n\n![c](./two.png \"A title\")\n\n![d](<./my pic.png>)\n\n```md\n![e](/images/three.png)\n```\n\nUse `![f](/images/four.png)` inline.\n"
	dests := scanMarkdownImages(text)
	want := []string{"/images/one.png", "./two.png", "./my pic.png"}
	if len(dests) != len(want) {
		t.Fatalf("destinations = %+v, want %v", dests, want)
	}
	for i, w := range want {
		if dests[i].value != w {
			t.Fatalf("destination %d = %q, want %q", i, dests[i].value, w)
		}
		if text[dests[i].start:dests[i].end] != w {
			t.Fatalf("destination %d offsets cover %q, want %q", i, text[dests[i].start:dests[i].end], w)
		}
	}
}

func TestScanRefDefinitions(t *testing.T) {
	text := "---\ntitle: x\n---\n\n[install]: /docs/getting-started/installation/\n[angled]: <./my page.mdx>\n[titled]: /docs/sibling/ \"Sibling page\"\n  [indented]: /docs/sibling/\n    [codeblock]: /docs/sibling/\n[INSTALL]: /docs/other/\n[empty]:\n[bad[bracket]: /docs/sibling/\n\n`[code]: /docs/sibling/`\n\n```md\n[fenced]: /docs/sibling/\n```\n"
	defs := scanRefDefinitions(text)
	want := []struct {
		label string
		dest  string
	}{
		{"install", "/docs/getting-started/installation/"},
		{"angled", "./my page.mdx"},
		{"titled", "/docs/sibling/"},
		{"indented", "/docs/sibling/"},
	}
	if len(defs) != len(want) {
		t.Fatalf("definitions = %+v, want %d", defs, len(want))
	}
	for i, w := range want {
		if defs[i].label != w.label || defs[i].dest != w.dest {
			t.Fatalf("definition %d = %q -> %q, want %q -> %q", i, defs[i].label, defs[i].dest, w.label, w.dest)
		}
		if text[defs[i].destStart:defs[i].destEnd] != w.dest {
			t.Fatalf("definition %d offsets cover %q, want %q", i, text[defs[i].destStart:defs[i].destEnd], w.dest)
		}
		if text[defs[i].labelStart:defs[i].labelEnd] != w.label {
			t.Fatalf("definition %d label offsets cover %q, want %q", i, text[defs[i].labelStart:defs[i].labelEnd], w.label)
		}
	}
}

func TestScanRefDefinitionsUnclosedFrontmatter(t *testing.T) {
	text := "---\ntitle: x\n\n[install]: /docs/page/\n"
	if defs := scanRefDefinitions(text); len(defs) != 0 {
		t.Fatalf("definitions = %+v, want none for unclosed frontmatter", defs)
	}
}

func TestScanRefUses(t *testing.T) {
	text := "[install]: /docs/getting-started/installation/\n[guide]: /docs/getting-started/\n\nSee [the install guide][install] and [guide][] and [guide] for more.\nAn [undefined][missing] ref and [also undefined][] stay plain.\nAn [inline](/docs/page/) link is not a ref.\n![an image][install] uses the same definition.\nUse `[code][install]` inline, not a use.\n[no def here] is plain text.\n"
	defs := scanRefDefinitions(text)
	uses := scanRefUses(text, defs)
	want := []struct {
		label string
		image bool
	}{
		{"install", false},
		{"guide", false},
		{"guide", false},
		{"missing", false},
		{"also undefined", false},
		{"install", true},
	}
	if len(uses) != len(want) {
		t.Fatalf("uses = %+v, want %d", uses, len(want))
	}
	for i, w := range want {
		if uses[i].label != w.label || uses[i].image != w.image {
			t.Fatalf("use %d = %+v, want label %q image %v", i, uses[i], w.label, w.image)
		}
		if text[uses[i].labelStart:uses[i].labelEnd] != w.label {
			t.Fatalf("use %d offsets cover %q, want %q", i, text[uses[i].labelStart:uses[i].labelEnd], w.label)
		}
	}
}

func TestScanRefUsesCaseInsensitive(t *testing.T) {
	text := "[Guide]: /docs/getting-started/\n\nSee [GUIDE] here.\n"
	defs := scanRefDefinitions(text)
	uses := scanRefUses(text, defs)
	if len(uses) != 1 || uses[0].label != "GUIDE" {
		t.Fatalf("uses = %+v, want the shortcut ref matching case-insensitively", uses)
	}
}

func TestLinkAtCursorRefDefinition(t *testing.T) {
	text, pos := posAt(t, "[install]: /docs/getting-started/installation/|")
	ctx := linkAtCursor(text, pos)
	if !ctx.found || ctx.value != "/docs/getting-started/installation/" || ctx.partial != "/docs/getting-started/installation/" {
		t.Fatalf("link = %+v, want the definition destination", ctx)
	}
}

func TestLinkAtCursorRefDefinitionPartial(t *testing.T) {
	text, pos := posAt(t, "[install]: /docs/get|ting-started/")
	ctx := linkAtCursor(text, pos)
	if !ctx.found || ctx.partial != "/docs/get" || ctx.value != "/docs/getting-started/" {
		t.Fatalf("link = %+v, want partial /docs/get", ctx)
	}
}

func TestLinkAtCursorRefDefinitionAngled(t *testing.T) {
	text, pos := posAt(t, "[mp]: <./my page|.mdx>")
	ctx := linkAtCursor(text, pos)
	if !ctx.found || ctx.value != "./my page.mdx" || !ctx.angled {
		t.Fatalf("link = %+v, want the angled destination", ctx)
	}
}

func TestLinkAtCursorRefDefinitionTitleAndLabel(t *testing.T) {
	for _, marked := range []string{
		"[t]: /docs/sibling/ \"Ti|tle\"",
		"[ins|tall]: /docs/getting-started/",
	} {
		text, pos := posAt(t, marked)
		if ctx := linkAtCursor(text, pos); ctx.found {
			t.Fatalf("linkAtCursor(%q) = %+v, want none (title and label are not destinations)", marked, ctx)
		}
	}
}
