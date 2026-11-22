package main

import (
	"testing"
)

func TestGithubSlug(t *testing.T) {
	for _, tc := range []struct {
		in, want string
	}{
		{"Hello World", "hello-world"},
		{"Getting Started!", "getting-started"},
		{"What's New?", "whats-new"},
		{"C++ Guide", "c-guide"},
		{"a  b", "a-b"},
		{"snake_case", "snake_case"},
		{"v1.2.3", "v123"},
		{"  padded  ", "padded"},
		{"100% Coverage", "100-coverage"},
	} {
		if got := githubSlug(tc.in); got != tc.want {
			t.Fatalf("githubSlug(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestExtractHeadings(t *testing.T) {
	text := "---\ntitle: x\n---\n# Top\n\n## Getting Started\n\n### Deep Dive\n\n## Getting Started\n"
	headings := extractHeadings(text)
	if len(headings) != 4 {
		t.Fatalf("extractHeadings found %d headings, want 4", len(headings))
	}
	want := []struct {
		level int
		text  string
		id    string
		line  int
	}{
		{1, "Top", "top", 3},
		{2, "Getting Started", "getting-started", 5},
		{3, "Deep Dive", "deep-dive", 7},
		{2, "Getting Started", "getting-started-1", 9},
	}
	for i, w := range want {
		got := headings[i]
		if got.level != w.level || got.text != w.text || got.id != w.id || got.line != w.line {
			t.Fatalf("heading %d = %+v, want %+v", i, got, w)
		}
	}
}

func TestExtractHeadingsSkipsCodeAndFrontmatter(t *testing.T) {
	text := "---\ntitle: '# Not a heading'\n---\n# Real\n\n```\n# Not a heading\n```\n\n## Also Real\n"
	headings := extractHeadings(text)
	if len(headings) != 2 || headings[0].text != "Real" || headings[1].text != "Also Real" {
		t.Fatalf("headings = %+v, want Real and Also Real", headings)
	}
}

func TestExtractHeadingsStripsMarkdown(t *testing.T) {
	text := "# The `Code` *Emphasis* [Link](/x) <span>Tag</span>\n"
	headings := extractHeadings(text)
	if len(headings) != 1 {
		t.Fatalf("headings = %+v, want one", headings)
	}
	if headings[0].text != "The Code Emphasis Link Tag" {
		t.Fatalf("heading text = %q, want the plain text", headings[0].text)
	}
	if headings[0].id != "the-code-emphasis-link-tag" {
		t.Fatalf("heading id = %q, want the-code-emphasis-link-tag", headings[0].id)
	}
}

func TestExtractHeadingsCustomID(t *testing.T) {
	text := "## Getting Started [#setup]\n\n## Mixed Case [#My-ID]\n"
	headings := extractHeadings(text)
	if len(headings) != 2 {
		t.Fatalf("headings = %+v, want 2", headings)
	}
	if headings[0].text != "Getting Started" || headings[0].id != "setup" {
		t.Fatalf("heading 0 = %+v, want text Getting Started and id setup", headings[0])
	}
	if headings[1].text != "Mixed Case" || headings[1].id != "My-ID" {
		t.Fatalf("heading 1 = %+v, want text Mixed Case and id My-ID (verbatim)", headings[1])
	}
}

func TestExtractHeadingsCustomIDDedup(t *testing.T) {
	text := "## Same\n\n## Other [#same]\n\n## Same\n\n## Again [#same]\n"
	headings := extractHeadings(text)
	if len(headings) != 4 {
		t.Fatalf("headings = %+v, want 4", headings)
	}
	want := []string{"same", "same", "same-2", "same"}
	for i, w := range want {
		if headings[i].id != w {
			t.Fatalf("heading %d id = %q, want %q", i, headings[i].id, w)
		}
	}
}

func TestExtractHeadingsCustomIDOnlyMidText(t *testing.T) {
	text := "## See [#note] here\n"
	headings := extractHeadings(text)
	if len(headings) != 1 {
		t.Fatalf("headings = %+v, want 1", headings)
	}
	if headings[0].id != "see-note-here" {
		t.Fatalf("heading id = %q, want see-note-here (a mid-text [#id] is not a custom id)", headings[0].id)
	}
}

func TestExtractHeadingsUnclosedFrontmatter(t *testing.T) {
	headings := extractHeadings("---\ntitle: x\n# Not a heading\n")
	if len(headings) != 0 {
		t.Fatalf("headings = %+v, want none", headings)
	}
}

func TestExtractHeadingsKeepsUnderscores(t *testing.T) {
	for _, tc := range []struct {
		line string
		text string
		id   string
	}{
		{"### `topic_list` Options\n", "topic_list Options", "topic_list-options"},
		{"## snake_case heading\n", "snake_case heading", "snake_case-heading"},
		{"## _italic_ and __bold__\n", "italic and bold", "italic-and-bold"},
		{"## `_private` method\n", "_private method", "_private-method"},
		{"## `__init__`\n", "__init__", "__init__"},
		{"## my__var\n", "my__var", "my__var"},
	} {
		headings := extractHeadings(tc.line)
		if len(headings) != 1 {
			t.Fatalf("extractHeadings(%q) = %d headings, want 1", tc.line, len(headings))
		}
		if headings[0].text != tc.text {
			t.Fatalf("extractHeadings(%q) text = %q, want %q", tc.line, headings[0].text, tc.text)
		}
		if headings[0].id != tc.id {
			t.Fatalf("extractHeadings(%q) id = %q, want %q", tc.line, headings[0].id, tc.id)
		}
	}
}
