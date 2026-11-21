package main

import (
	"path/filepath"
	"testing"
)

func TestScanVarsExpr(t *testing.T) {
	for _, tc := range []struct {
		marked       string
		found        bool
		offeringVars bool
		path         []string
		partial      string
	}{
		{"{|", true, true, nil, ""},
		{"{ |", true, true, nil, ""},
		{"{v|", true, true, nil, "v"},
		{"{var|", true, true, nil, "var"},
		{"{vars|", false, false, nil, ""},
		{"{vars.|", true, false, nil, ""},
		{"{vars.p|", true, false, nil, "p"},
		{"{vars.project.|", true, false, []string{"project"}, ""},
		{"{vars.project.r|", true, false, []string{"project"}, "r"},
		{"{vars.a.b.|", true, false, []string{"a", "b"}, ""},
		{"{foo|", false, false, nil, ""},
		{"{var.x|", false, false, nil, ""},
		{"{vars..x|", false, false, nil, ""},
		{"{vars.x} {v|", true, true, nil, "v"},
		{"{vars.x}|", false, false, nil, ""},
		{"text {| more", true, true, nil, ""},
	} {
		text, pos := posAt(t, tc.marked)
		ctx := scanVarsExpr(text, pos)
		if ctx.found != tc.found {
			t.Fatalf("scanVarsExpr(%q): found = %v, want %v", tc.marked, ctx.found, tc.found)
		}
		if !tc.found {
			continue
		}
		if ctx.offeringVars != tc.offeringVars {
			t.Fatalf("scanVarsExpr(%q): offeringVars = %v, want %v", tc.marked, ctx.offeringVars, tc.offeringVars)
		}
		if len(ctx.path) != len(tc.path) {
			t.Fatalf("scanVarsExpr(%q): path = %v, want %v", tc.marked, ctx.path, tc.path)
		}
		for i := range tc.path {
			if ctx.path[i] != tc.path[i] {
				t.Fatalf("scanVarsExpr(%q): path = %v, want %v", tc.marked, ctx.path, tc.path)
			}
		}
		if ctx.partial != tc.partial {
			t.Fatalf("scanVarsExpr(%q): partial = %q, want %q", tc.marked, ctx.partial, tc.partial)
		}
	}
}

func TestScanVarsExprNotAnExpression(t *testing.T) {
	for _, marked := range []string{
		"```\n{vars.|}\n```\n",
		"---\ntitle: {vars.|}\n---\n",
		"Use `{vars.|}` here.",
		"<Btn label=\"{vars.|}\">x</Btn>",
		"<Btn href={vars.|}>x</Btn>",
	} {
		text, pos := posAt(t, marked)
		ctx := scanVarsExpr(text, pos)
		if marked == "<Btn href={vars.|}>x</Btn>" {
			// An expression prop value IS an expression.
			if !ctx.found {
				t.Fatalf("scanVarsExpr(%q): not found, want a vars expression", marked)
			}
			continue
		}
		if ctx.found {
			t.Fatalf("scanVarsExpr(%q): found %+v, want none", marked, ctx)
		}
	}
}

func varsFixture(t *testing.T) string {
	t.Helper()
	return contentFixture(t, `docs_home:
  title: Docs
vars:
  project:
    repo: https://github.com/soymadip/portosaur
    name: Portosaur
  site:
    url: https://example.com
`, nil)
}

func TestVarsCompletionOffersVars(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{")
	items := s.complete(t, documentURI, 2, 1)
	if len(items) != 1 || items[0].Label != "vars" {
		t.Fatalf("completions = %v, want only vars", labels(items))
	}
	if text, ok := editText(items, "vars"); !ok || text != "vars" {
		t.Fatalf("vars edit = %q, want vars", text)
	}
}

func TestVarsCompletionTopLevelKeys(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.")
	items := s.complete(t, documentURI, 2, 6)
	if len(items) != 2 || !hasLabel(items, "project") || !hasLabel(items, "site") {
		t.Fatalf("completions = %v, want project and site", labels(items))
	}
}

func TestVarsCompletionNestedKeys(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.project.")
	items := s.complete(t, documentURI, 2, 14)
	if len(items) != 2 || !hasLabel(items, "repo") || !hasLabel(items, "name") {
		t.Fatalf("completions = %v, want repo and name", labels(items))
	}
}

func TestVarsCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.project.r")
	items := s.complete(t, documentURI, 2, 15)
	if len(items) != 1 || items[0].Label != "repo" {
		t.Fatalf("completions = %v, want only repo", labels(items))
	}
	if text, ok := editText(items, "repo"); !ok || text != "repo" {
		t.Fatalf("repo edit = %q, want repo", text)
	}
}

func TestVarsCompletionScalarPathIsEmpty(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.project.name.")
	items := s.complete(t, documentURI, 2, 19)
	if len(items) != 0 {
		t.Fatalf("completions = %v, want none (name is a string, not an object)", labels(items))
	}
}

func TestVarsCompletionNoVarsInConfig(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.")
	items := s.complete(t, documentURI, 2, 6)
	if len(items) != 0 {
		t.Fatalf("completions = %v, want none", labels(items))
	}
}

func TestVarsCompletionValueDetail(t *testing.T) {
	s := startTestServer(t, varsFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{vars.project.")
	items := s.complete(t, documentURI, 2, 14)
	for _, item := range items {
		detail, ok := item.Detail.Get()
		if !ok || detail == "" {
			t.Fatalf("item %q has no detail", item.Label)
		}
	}
}

func TestScanVarsRefs(t *testing.T) {
	for _, tc := range []struct {
		text  string
		paths []string
	}{
		{"a {vars.x} b {vars.y.z} c", []string{"x", "y.z"}},
		{"{{vars.x}} and {vars.y}", []string{"y"}},
		{"{{{vars.x}}}", nil},
		{"---\ntitle: {vars.x}\n---\n{vars.y}\n", []string{"y"}},
		{"---\n{vars.x}\n", nil},
		{"{vars.<key>} and {vars.*} and {vars.} and {vars.1a}", nil},
		{"no refs here", nil},
	} {
		refs := scanVarsRefs(tc.text)
		if len(refs) != len(tc.paths) {
			t.Fatalf("scanVarsRefs(%q): got %d refs, want %d", tc.text, len(refs), len(tc.paths))
		}
		for i, want := range tc.paths {
			if refs[i].path != want {
				t.Fatalf("scanVarsRefs(%q): ref %d path = %q, want %q", tc.text, i, refs[i].path, want)
			}
			if got := tc.text[refs[i].start:refs[i].end]; got != "{vars."+want+"}" {
				t.Fatalf("scanVarsRefs(%q): ref %d text = %q, want %q", tc.text, i, got, "{vars."+want+"}")
			}
		}
	}
}

func TestResolveVarsValue(t *testing.T) {
	vars := map[string]any{
		"name":   "Portosaur",
		"count":  42,
		"ratio":  1.5,
		"flag":   true,
		"nested": map[string]any{"deep": "x"},
	}
	for path, want := range map[string]any{
		"name":        "Portosaur",
		"count":       42,
		"ratio":       1.5,
		"nested.deep": "x",
	} {
		got, ok := resolveVarsValue(vars, path)
		if !ok || got != want {
			t.Fatalf("resolveVarsValue(%q) = %v, %v; want %v, true", path, got, ok, want)
		}
	}
	for _, path := range []string{"flag", "nested", "nope", "nested.nope"} {
		if got, ok := resolveVarsValue(vars, path); ok {
			t.Fatalf("resolveVarsValue(%q) = %v, true; want not found", path, got)
		}
	}
}

func TestResolveVarsPath(t *testing.T) {
	vars := map[string]any{
		"name":   "Portosaur",
		"count":  42,
		"ratio":  1.5,
		"flag":   true,
		"empty":  nil,
		"nested": map[string]any{"deep": "x"},
		"list":   []any{"a"},
	}
	for path, want := range map[string]bool{
		"name":        true,
		"count":       true,
		"ratio":       true,
		"flag":        false,
		"empty":       false,
		"nested":      false,
		"nested.deep": true,
		"nested.nope": false,
		"nope":        false,
		"list":        false,
	} {
		if got := resolveVarsPath(vars, path); got != want {
			t.Fatalf("resolveVarsPath(%q) = %v, want %v", path, got, want)
		}
	}
}
