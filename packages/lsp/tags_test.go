package main

import (
	"testing"
)

func TestScanImports(t *testing.T) {
	for _, tc := range []struct {
		name string
		text string
		want []importedComponent
	}{
		{
			"default import",
			"import Foo from './Foo'\n\n<Foo>",
			[]importedComponent{{"Foo", "./Foo"}},
		},
		{
			"named imports",
			"import { Bar, Baz } from './parts'\n\n<Bar>",
			[]importedComponent{{"Bar", "./parts"}, {"Baz", "./parts"}},
		},
		{
			"mixed default and named",
			"import Foo, { Bar } from './mix'\n\n<Foo>",
			[]importedComponent{{"Foo", "./mix"}, {"Bar", "./mix"}},
		},
		{
			"aliased named import offers the alias",
			"import { Orig as Alias } from './alias'\n\n<Alias>",
			[]importedComponent{{"Alias", "./alias"}},
		},
		{
			"default as offers the alias",
			"import { default as Foo } from './def'\n\n<Foo>",
			[]importedComponent{{"Foo", "./def"}},
		},
		{
			"multiline named import",
			"import {\n  Bar,\n  Baz,\n} from './multi'\n\n<Bar>",
			[]importedComponent{{"Bar", "./multi"}, {"Baz", "./multi"}},
		},
		{
			"double quotes and a semicolon",
			"import Foo from \"./Foo\";\n\n<Foo>",
			[]importedComponent{{"Foo", "./Foo"}},
		},
		{
			"type-only import offers nothing",
			"import type Foo from './types'\nimport type { Bar } from './types'\n\n<Foo>",
			nil,
		},
		{
			"inline type specifier is skipped, the rest kept",
			"import { type Foo, Bar } from './mixed'\n\n<Bar>",
			[]importedComponent{{"Bar", "./mixed"}},
		},
		{
			"namespace import offers nothing",
			"import * as X from './ns'\n\n<X.Foo>",
			nil,
		},
		{
			"default plus namespace keeps the default",
			"import Foo, * as X from './ns'\n\n<Foo>",
			[]importedComponent{{"Foo", "./ns"}},
		},
		{
			"side-effect import offers nothing",
			"import './setup'\n\nText",
			nil,
		},
		{
			"prose starting with import is not an import",
			"important: read this first\n\nText",
			nil,
		},
		{
			"import in a fenced block is an example",
			"```mdx\nimport Foo from './Foo'\n```\n\nText",
			nil,
		},
		{
			"import inside frontmatter is not an import",
			"---\nimport Foo from './Foo'\n---\n\nText",
			nil,
		},
		{
			"import after frontmatter counts",
			"---\ntitle: x\n---\nimport Foo from './Foo'\n\n<Foo>",
			[]importedComponent{{"Foo", "./Foo"}},
		},
		{
			"import after prose still counts",
			"# Hello\n\nSome text.\n\nimport Foo from './Foo'\n\n<Foo>",
			[]importedComponent{{"Foo", "./Foo"}},
		},
	} {
		got := scanImports(tc.text)
		if len(got) != len(tc.want) {
			t.Fatalf("%s: scanImports = %+v, want %+v", tc.name, got, tc.want)
		}
		for i, want := range tc.want {
			if got[i] != want {
				t.Fatalf("%s: scanImports[%d] = %+v, want %+v", tc.name, i, got[i], want)
			}
		}
	}
}

func TestHTMLTags(t *testing.T) {
	seen := map[string]bool{}
	void := map[string]bool{}
	for _, tag := range htmlTags {
		if seen[tag.name] {
			t.Fatalf("htmlTags lists %q twice", tag.name)
		}
		seen[tag.name] = true
		if tag.void {
			void[tag.name] = true
		}
	}
	for _, want := range []string{"div", "span", "p", "a", "ul", "ol", "li", "table", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer", "nav", "main", "img", "video", "button", "input", "form", "pre", "code", "blockquote", "hr", "br", "em", "strong", "details", "summary", "svg"} {
		if !seen[want] {
			t.Fatalf("htmlTags is missing %q", want)
		}
	}
	for _, want := range []string{"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"} {
		if !void[want] {
			t.Fatalf("htmlTags does not mark %q as void", want)
		}
	}
	for _, want := range []string{"div", "span", "p", "a", "svg", "video"} {
		if void[want] {
			t.Fatalf("htmlTags wrongly marks %q as void", want)
		}
	}
}
