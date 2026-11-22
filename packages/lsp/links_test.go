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
