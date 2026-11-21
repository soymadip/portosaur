package main

import (
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"go.lsp.dev/protocol"
)

func TestScanFence(t *testing.T) {
	cases := []struct {
		name      string
		text      string
		line      uint32
		char      uint32
		found     bool
		kind      fenceKind
		partial   string
		startChar uint32 // when found: the start of the replaced word
		endChar   uint32 // when found: the end of the replaced word
		existing  []string
	}{
		{"bare fence", "```", 0, 3, true, fenceLanguage, "", 3, 3, nil},
		{"partial language", "```jav", 0, 6, true, fenceLanguage, "jav", 3, 6, nil},
		{"language complete", "```javascript", 0, 13, true, fenceLanguage, "javascript", 3, 13, nil},
		{"cursor mid language", "```javascript", 0, 7, true, fenceLanguage, "java", 3, 13, nil},
		{"after language space", "```js ", 0, 6, true, fenceMeta, "", 6, 6, nil},
		{"meta partial", "```js ti", 0, 8, true, fenceMeta, "ti", 6, 8, nil},
		{"meta after param", "```js title=\"x\" ta", 0, 18, true, fenceMeta, "ta", 16, 18, []string{"title"}},
		{"meta single quotes", "```js title='x' ta", 0, 18, true, fenceMeta, "ta", 16, 18, []string{"title"}},
		{"lineNumbers with number", "```js lineNumbers=5 ta", 0, 22, true, fenceMeta, "ta", 20, 22, []string{"lineNumbers"}},
		{"cursor after equals", "```js title=", 0, 12, false, 0, "", 0, 0, nil},
		{"cursor inside quotes", "```js title=\"x", 0, 14, false, 0, "", 0, 0, nil},
		{"cursor after quoted value", "```js title=\"x\"", 0, 15, false, 0, "", 0, 0, nil},
		{"closing fence", "```js\ncode\n```", 2, 3, false, 0, "", 0, 0, nil},
		{"inside block", "```js\ncode\n```", 1, 2, false, 0, "", 0, 0, nil},
		{"plain line", "hello", 0, 5, false, 0, "", 0, 0, nil},
		{"indented fence", "  ```js", 0, 7, true, fenceLanguage, "js", 5, 7, nil},
		{"four space indent", "    ```js", 0, 9, false, 0, "", 0, 0, nil},
		{"tilde fence", "~~~py", 0, 5, true, fenceLanguage, "py", 3, 5, nil},
		{"tilde line inside backtick block", "```\n~~~\n```", 1, 3, false, 0, "", 0, 0, nil},
		{"backtick line inside tilde block", "~~~\n```\n~~~", 1, 3, false, 0, "", 0, 0, nil},
		{"fence after closed block", "```js\nx\n```\n```py", 3, 5, true, fenceLanguage, "py", 3, 5, nil},
		{"fence-like line inside unclosed block", "```js\n```py", 1, 5, false, 0, "", 0, 0, nil},
		{"shorter fence inside long fence", "````\n```\n````", 1, 3, false, 0, "", 0, 0, nil},
		{"frontmatter", "---\n```js\n---\n", 1, 5, false, 0, "", 0, 0, nil},
		{"unclosed frontmatter", "---\n```js\n", 1, 5, false, 0, "", 0, 0, nil},
		{"cursor on marker", "```js", 0, 2, false, 0, "", 0, 0, nil},
		{"short marker", "``js", 0, 4, false, 0, "", 0, 0, nil},
		{"longer fence", "````js", 0, 6, true, fenceLanguage, "js", 4, 6, nil},
		{"space before language", "``` js", 0, 6, true, fenceLanguage, "js", 4, 6, nil},
		{"cursor in gap before language", "``` js", 0, 3, true, fenceLanguage, "", 4, 6, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			context := scanFence(c.text, protocol.Position{Line: c.line, Character: c.char})
			if context.found != c.found {
				t.Fatalf("found = %v, want %v", context.found, c.found)
			}
			if !c.found {
				return
			}
			if context.kind != c.kind {
				t.Fatalf("kind = %v, want %v", context.kind, c.kind)
			}
			if context.partial != c.partial {
				t.Fatalf("partial = %q, want %q", context.partial, c.partial)
			}
			rng := context.partialRange
			if rng.Start.Line != c.line || rng.Start.Character != c.startChar {
				t.Fatalf("range start = %d:%d, want %d:%d", rng.Start.Line, rng.Start.Character, c.line, c.startChar)
			}
			if rng.End.Line != c.line || rng.End.Character != c.endChar {
				t.Fatalf("range end = %d:%d, want %d:%d", rng.End.Line, rng.End.Character, c.line, c.endChar)
			}
			if len(context.existing) != len(c.existing) {
				t.Fatalf("existing = %v, want %v", context.existing, c.existing)
			}
			for _, name := range c.existing {
				if !context.existing[name] {
					t.Fatalf("existing = %v, want it to hold %q", context.existing, name)
				}
			}
		})
	}
}

// The curated language list is sorted, stays small next to
// Shiki's 200-plus bundled languages, and holds the three
// fences Portosaur handles itself.
func TestFenceLanguagesCurated(t *testing.T) {
	if !sort.StringsAreSorted(fenceLanguages) {
		t.Fatal("fenceLanguages is not sorted")
	}
	if len(fenceLanguages) > 100 {
		t.Fatalf("fenceLanguages = %d entries, want a curated list under 100", len(fenceLanguages))
	}
	for _, lang := range []string{"mermaid", "package-install", "npm", "javascript", "bash", "yaml"} {
		i := sort.SearchStrings(fenceLanguages, lang)
		if i >= len(fenceLanguages) || fenceLanguages[i] != lang {
			t.Fatalf("fenceLanguages missing %q", lang)
		}
	}
}

// The meta params are exactly the set parseCodeBlockMeta
// reads: if the parser gains or drops one, this test and the
// list change together.
func TestFenceMetaParamsMatchParser(t *testing.T) {
	want := map[string]bool{"title": true, "tab": true, "noCopy": true, "noWrap": true, "lineNumbers": true}
	if len(fenceMetaParams) != len(want) {
		t.Fatalf("fenceMetaParams = %d params, want %d", len(fenceMetaParams), len(want))
	}
	for name := range want {
		if _, ok := fenceMetaParams[name]; !ok {
			t.Fatalf("fenceMetaParams missing %q", name)
		}
	}
	if !fenceMetaParams["title"].takesValue || !fenceMetaParams["tab"].takesValue {
		t.Fatal("title and tab must take values")
	}
	for _, name := range []string{"noCopy", "noWrap", "lineNumbers"} {
		if fenceMetaParams[name].takesValue {
			t.Fatalf("%s must be a bare flag", name)
		}
	}
}

func TestFenceCompletionOffersLanguages(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```\n")
	items := s.complete(t, documentURI, 0, 3)
	if len(items) != len(fenceLanguages) {
		t.Fatalf("fence completions = %d, want %d (every curated language)", len(items), len(fenceLanguages))
	}
	for _, lang := range []string{"javascript", "mermaid", "package-install", "npm"} {
		if !hasLabel(items, lang) {
			t.Fatalf("fence completions missing %q", lang)
		}
	}
	if detail := completionDetail(items, "mermaid"); detail != "Diagram" {
		t.Fatalf("detail for mermaid = %q, want Diagram", detail)
	}
	if detail := completionDetail(items, "package-install"); detail != "Install tabs" {
		t.Fatalf("detail for package-install = %q, want Install tabs", detail)
	}
	for _, item := range items {
		if item.Kind != protocol.CompletionItemKindValue {
			t.Fatalf("kind for %q = %v, want Value", item.Label, item.Kind)
		}
	}
}

func TestFenceCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```jav\n")
	items := s.complete(t, documentURI, 0, 6)
	if !hasLabel(items, "javascript") {
		t.Fatalf("fence completions %v missing javascript", labels(items))
	}
	for _, item := range items {
		if !strings.HasPrefix(item.Label, "jav") {
			t.Fatalf("completion %q does not match the typed jav", item.Label)
		}
	}
	if hasLabel(items, "python") {
		t.Fatalf("fence completions %v include python outside the jav filter", labels(items))
	}
}

func TestFenceCompletionInsertsLanguage(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```jav\n")
	items := s.complete(t, documentURI, 0, 6)
	if text, ok := editText(items, "javascript"); !ok || text != "javascript" {
		t.Fatalf("javascript edit = %q, want %q", text, "javascript")
	}
	edit := editRange(items, "javascript")
	if edit.Start.Character != 3 || edit.End.Character != 6 {
		t.Fatalf("javascript edit range = %d-%d, want 3-6 (the partial)", edit.Start.Character, edit.End.Character)
	}
}

func TestFenceCompletionOffersMeta(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```js \n")
	items := s.complete(t, documentURI, 0, 6)
	for _, name := range []string{"title", "tab", "noCopy", "noWrap", "lineNumbers"} {
		if !hasLabel(items, name) {
			t.Fatalf("fence completions %v missing %q", labels(items), name)
		}
	}
	if len(items) != len(fenceMetaParams) {
		t.Fatalf("fence completions = %d, want %d (every meta param)", len(items), len(fenceMetaParams))
	}
	for _, item := range items {
		if item.Kind != protocol.CompletionItemKindProperty {
			t.Fatalf("kind for %q = %v, want Property", item.Label, item.Kind)
		}
	}
}

func TestFenceCompletionValueParamInsertsSnippet(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```js ti\n")
	items := s.complete(t, documentURI, 0, 8)
	item, ok := completionItem(items, "title")
	if !ok {
		t.Fatalf("fence completions %v missing title", labels(items))
	}
	if item.InsertTextFormat != protocol.InsertTextFormatSnippet {
		t.Fatalf("title insert format = %v, want Snippet", item.InsertTextFormat)
	}
	if text, ok := editText(items, "title"); !ok || text != `title="$0"` {
		t.Fatalf("title edit = %q, want %q", text, `title="$0"`)
	}
}

func TestFenceCompletionFlagInsertsPlain(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```js no\n")
	items := s.complete(t, documentURI, 0, 8)
	item, ok := completionItem(items, "noCopy")
	if !ok {
		t.Fatalf("fence completions %v missing noCopy", labels(items))
	}
	if item.InsertTextFormat != 0 {
		t.Fatalf("noCopy insert format = %v, want plain (unset)", item.InsertTextFormat)
	}
	if text, ok := editText(items, "noCopy"); !ok || text != "noCopy" {
		t.Fatalf("noCopy edit = %q, want %q", text, "noCopy")
	}
}

func TestFenceCompletionSkipsExistingParams(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```js title=\"x\" \n")
	items := s.complete(t, documentURI, 0, 16)
	if hasLabel(items, "title") {
		t.Fatalf("fence completions %v re-offer title, already on the line", labels(items))
	}
	if !hasLabel(items, "tab") {
		t.Fatalf("fence completions %v missing tab", labels(items))
	}
}

func TestFenceCompletionNoTriggerOnClosingFence(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```js\ncode\n```\n")
	items := s.complete(t, documentURI, 2, 3)
	if len(items) != 0 {
		t.Fatalf("completions on the closing fence = %v, want none", labels(items))
	}
}

func TestFenceCompletionNoTriggerInsideBlock(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "```js\ncode\n```\n")
	items := s.complete(t, documentURI, 1, 2)
	if len(items) != 0 {
		t.Fatalf("completions inside the block = %v, want none", labels(items))
	}
}

func TestFenceCompletionNoTriggerOnPlainLine(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "hello\n")
	items := s.complete(t, documentURI, 0, 5)
	if len(items) != 0 {
		t.Fatalf("completions on a plain line = %v, want none", labels(items))
	}
}

// completionItem returns the completion item with the given
// label.
func completionItem(items []protocol.CompletionItem, label string) (protocol.CompletionItem, bool) {
	for _, item := range items {
		if item.Label == label {
			return item, true
		}
	}
	return protocol.CompletionItem{}, false
}
