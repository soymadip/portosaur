package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// codeActions sends a textDocument/codeAction request with an
// empty range at the cursor and returns the actions.
func (s *testServer) codeActions(t *testing.T, documentURI uri.URI, line, character uint32, only ...protocol.CodeActionKind) []*protocol.CodeAction {
	t.Helper()
	at := protocol.Position{Line: line, Character: character}
	result, err := s.server.CodeAction(context.Background(), &protocol.CodeActionParams{
		TextDocument: protocol.TextDocumentIdentifier{URI: documentURI},
		Range:        protocol.Range{Start: at, End: at},
		Context:      protocol.CodeActionContext{Only: only},
	})
	if err != nil {
		t.Fatalf("codeAction: %v", err)
	}
	var actions []*protocol.CodeAction
	for _, item := range result {
		action, ok := item.(*protocol.CodeAction)
		if !ok {
			t.Fatalf("code action is %T, want *protocol.CodeAction", item)
		}
		actions = append(actions, action)
	}
	return actions
}

func actionTitles(actions []*protocol.CodeAction) []string {
	var out []string
	for _, action := range actions {
		out = append(out, action.Title)
	}
	return out
}

// actionEdit returns the single edit of an action, or fails.
func actionEdit(t *testing.T, action *protocol.CodeAction) protocol.TextEdit {
	t.Helper()
	edits := actionEdits(t, action)
	if len(edits) != 1 {
		t.Fatalf("action %q has %d edits, want one", action.Title, len(edits))
	}
	return edits[0]
}

// actionEdits returns every edit of an action, or fails.
func actionEdits(t *testing.T, action *protocol.CodeAction) []protocol.TextEdit {
	t.Helper()
	if action.Edit == nil {
		t.Fatalf("action %q has no edit", action.Title)
	}
	var edits []protocol.TextEdit
	for _, list := range action.Edit.Changes {
		edits = append(edits, list...)
	}
	return edits
}

func TestCodeActionUnknownKey(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nbogus: true\n---\n")
	actions := s.codeActions(t, documentURI, 1, 2)
	if len(actions) != 1 || actions[0].Title != "Remove unknown key" {
		t.Fatalf("actions = %v, want only Remove unknown key", actionTitles(actions))
	}
	edit := actionEdit(t, actions[0])
	if edit.Range.Start.Line != 1 || edit.Range.Start.Character != 0 {
		t.Fatalf("edit start = %+v, want (1, 0)", edit.Range.Start)
	}
	if edit.Range.End.Line != 2 || edit.Range.End.Character != 0 {
		t.Fatalf("edit end = %+v, want (2, 0) (the whole line plus its newline)", edit.Range.End)
	}
	if edit.NewText != "" {
		t.Fatalf("edit text = %q, want empty", edit.NewText)
	}
}

func TestCodeActionUnknownKeyNestedValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nbogus:\n  a: 1\n---\n")
	actions := s.codeActions(t, documentURI, 1, 2)
	if len(actions) != 0 {
		t.Fatalf("actions = %v, want none (the value spans lines, the line cannot go alone)", actionTitles(actions))
	}
}

func TestCodeActionMissingProp(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon>\n")
	actions := s.codeActions(t, documentURI, 2, 2)
	if len(actions) != 1 || actions[0].Title != "Add missing prop 'id'" {
		t.Fatalf("actions = %v, want only Add missing prop 'id'", actionTitles(actions))
	}
	edit := actionEdit(t, actions[0])
	if edit.Range.Start.Line != 2 || edit.Range.Start.Character != 5 {
		t.Fatalf("edit start = %+v, want (2, 5) (right after the tag name)", edit.Range.Start)
	}
	if edit.Range.Start != edit.Range.End {
		t.Fatalf("edit is not an insertion: %+v", edit.Range)
	}
	if edit.NewText != ` id=""` {
		t.Fatalf("edit text = %q, want ` id=\"\"`", edit.NewText)
	}
}

func TestCodeActionEnumValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"bogus\">\n")
	actions := s.codeActions(t, documentURI, 2, 16)
	if len(actions) != 7 {
		t.Fatalf("actions = %v, want one per valid variant", actionTitles(actions))
	}
	for _, want := range []string{"Change to 'primary'", "Change to 'ghost'"} {
		found := false
		for _, action := range actions {
			if action.Title == want {
				found = true
				edit := actionEdit(t, action)
				if edit.Range.Start.Line != 2 || edit.Range.Start.Character != 14 {
					t.Fatalf("%s: edit start = %+v, want (2, 14) (the value, inside the quotes)", want, edit.Range.Start)
				}
				if edit.Range.End.Character != 19 {
					t.Fatalf("%s: edit end = %+v, want character 19", want, edit.Range.End)
				}
			}
		}
		if !found {
			t.Fatalf("actions = %v, want %q", actionTitles(actions), want)
		}
	}
}

func TestCodeActionValidEnumValueIsEmpty(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"primary\">\n")
	actions := s.codeActions(t, documentURI, 2, 16)
	if len(actions) != 0 {
		t.Fatalf("actions = %v, want none", actionTitles(actions))
	}
}

func TestCodeActionNoFixForTypeError(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: 42\n---\n")
	actions := s.codeActions(t, documentURI, 1, 8)
	if len(actions) != 0 {
		t.Fatalf("actions = %v, want none (a type error has no fix)", actionTitles(actions))
	}
}

func TestCodeActionRangeFilter(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nbogus: true\n---\n\n## Hello\n")
	actions := s.codeActions(t, documentURI, 0, 0)
	if len(actions) != 0 {
		t.Fatalf("actions at (0, 0) = %v, want none (the diagnostic is on line 1)", actionTitles(actions))
	}
	actions = s.codeActions(t, documentURI, 4, 2)
	if len(actions) != 0 {
		t.Fatalf("actions at (4, 2) = %v, want none", actionTitles(actions))
	}
}

func TestCodeActionDuplicateHeading(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "## Prerequisites\n\nSome text.\n\n## Prerequisites\n")
	actions := s.codeActions(t, documentURI, 4, 5)
	if len(actions) != 1 || actions[0].Title != "Use custom id '[#prerequisites-1]'" {
		t.Fatalf("actions = %v, want the custom-id fix", actionTitles(actions))
	}
	edit := actionEdit(t, actions[0])
	if edit.Range.Start.Line != 4 || edit.Range.Start.Character != 16 || edit.Range.End.Line != 4 || edit.Range.End.Character != 16 {
		t.Fatalf("edit range = %+v, want an insert at (4, 16) (end of the heading text)", edit.Range)
	}
	if edit.NewText != " [#prerequisites-1]" {
		t.Fatalf("edit text = %q, want \" [#prerequisites-1]\"", edit.NewText)
	}
}

func TestCodeActionDuplicateHeadingSharedIDHasNoFix(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "## First [#shared]\n\n## Second [#shared]\n")
	actions := s.codeActions(t, documentURI, 2, 5)
	if len(actions) != 0 {
		t.Fatalf("actions = %v, want none (a shared custom id has no fix to offer)", actionTitles(actions))
	}
}

func TestCodeActionOnlyKindFilter(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\nbogus: true\n---\n")
	actions := s.codeActions(t, documentURI, 1, 2, protocol.CodeActionKindRefactor)
	if len(actions) != 0 {
		t.Fatalf("actions for refactor-only = %v, want none", actionTitles(actions))
	}
	actions = s.codeActions(t, documentURI, 1, 2, protocol.CodeActionKindQuickFix)
	if len(actions) != 1 {
		t.Fatalf("actions for quickfix-only = %v, want one", actionTitles(actions))
	}
}

func TestCodeActionLenientModeIsEmpty(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	frontmatter := realSchema(t, schemaFrontmatter)
	components := realSchema(t, schemaComponents)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/frontmatter.json":
			_, _ = w.Write(frontmatter)
		case "/components.json":
			_, _ = w.Write(components)
		default:
			http.NotFound(w, r)
		}
	}))
	defer website.Close()

	s := startTestServer(t, root)
	s.local.resolver.website = website.URL
	documentURI := s.open(t, filepath.Join(root, "page.mdx"), "---\nbogus: true\n---\n\n<Icon>\n")
	actions := s.codeActions(t, documentURI, 1, 2)
	if len(actions) != 0 {
		t.Fatalf("lenient actions = %v, want none", actionTitles(actions))
	}
	actions = s.codeActions(t, documentURI, 4, 2)
	if len(actions) != 0 {
		t.Fatalf("lenient actions = %v, want none", actionTitles(actions))
	}
}

// The real frontmatter schema has no enums, so the frontmatter
// enum path is tested against a synthetic schema: an enum
// mismatch carries the valid values, and the range covers a
// quoted value's quotes.
func TestValidationIssuesEnum(t *testing.T) {
	schema, err := compileSchema(schemaFrontmatter, map[string]any{
		"type": "object",
		"properties": map[string]any{
			"position": map[string]any{"type": "string", "enum": []any{"left", "right"}},
		},
		"additionalProperties": false,
	}, true)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	for _, tc := range []struct {
		yaml      string
		startChar uint32
		endChar   uint32
	}{
		{"position: center\n", 10, 16},
		{"position: \"center\"\n", 10, 18},
	} {
		rootNode, err := parseYAML(tc.yaml)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		var value any
		if err := rootNode.Decode(&value); err != nil {
			t.Fatalf("decode: %v", err)
		}
		err = schema.compiled.Validate(value)
		verr, ok := err.(*jsonschema.ValidationError)
		if !ok {
			t.Fatalf("validate(%q): err = %v, want a validation error", tc.yaml, err)
		}
		issues := validationIssues(verr, rootNode, strings.Split(tc.yaml, "\n"))
		if len(issues) != 1 {
			t.Fatalf("issues for %q = %d, want one", tc.yaml, len(issues))
		}
		if len(issues[0].enum) != 2 || issues[0].enum[0] != "left" || issues[0].enum[1] != "right" {
			t.Fatalf("enum = %v, want [left right]", issues[0].enum)
		}
		if issues[0].diag.Range.Start.Character != tc.startChar || issues[0].diag.Range.End.Character != tc.endChar {
			t.Fatalf("range for %q = %+v, want characters %d-%d", tc.yaml, issues[0].diag.Range, tc.startChar, tc.endChar)
		}
	}
}

func TestValidationIssuesUnknownKey(t *testing.T) {
	schema, err := compileSchema(schemaFrontmatter, map[string]any{
		"type":                 "object",
		"properties":           map[string]any{"title": map[string]any{"type": "string"}},
		"additionalProperties": false,
	}, true)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	yamlText := "title: x\nbogus: true\n"
	rootNode, err := parseYAML(yamlText)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	var value any
	if err := rootNode.Decode(&value); err != nil {
		t.Fatalf("decode: %v", err)
	}
	err = schema.compiled.Validate(value)
	verr, ok := err.(*jsonschema.ValidationError)
	if !ok {
		t.Fatalf("validate: err = %v, want a validation error", err)
	}
	issues := validationIssues(verr, rootNode, strings.Split(yamlText, "\n"))
	if len(issues) != 1 || issues[0].unknownKey != "bogus" || !issues[0].unknownScalar {
		t.Fatalf("issues = %+v, want one unknown-key issue for bogus", issues)
	}
	if issues[0].diag.Range.Start.Line != 1 {
		t.Fatalf("diagnostic line = %d, want 1", issues[0].diag.Range.Start.Line)
	}
}

func TestCodeActionMoveToFrontmatterTitle(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "# Hello\n\nSome text.\n"
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), doc)
	actions := s.codeActions(t, documentURI, 0, 3)
	if len(actions) != 1 || actions[0].Title != "Move to frontmatter title" {
		t.Fatalf("actions = %v, want only Move to frontmatter title", actionTitles(actions))
	}
	if got := applyEdits(doc, actionEdits(t, actions[0])); got != "---\ntitle: Hello\n---\n\n\nSome text.\n" {
		t.Fatalf("after the fix the document is %q, want the H1 moved to a new frontmatter title", got)
	}
}

func TestCodeActionMoveToFrontmatterTitleExisting(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\ndesc: Something\n---\n\n# Hello\n"
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), doc)
	actions := s.codeActions(t, documentURI, 4, 3)
	if len(actions) != 1 || actions[0].Title != "Move to frontmatter title" {
		t.Fatalf("actions = %v, want only Move to frontmatter title", actionTitles(actions))
	}
	if got := applyEdits(doc, actionEdits(t, actions[0])); got != "---\ntitle: Hello\ndesc: Something\n---\n\n" {
		t.Fatalf("after the fix the document is %q, want the title key added and the H1 removed", got)
	}
}

func TestCodeActionMoveToFrontmatterTitleQuoted(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "# Hello: World\n"
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), doc)
	actions := s.codeActions(t, documentURI, 0, 3)
	if len(actions) != 1 || actions[0].Title != "Move to frontmatter title" {
		t.Fatalf("actions = %v, want only Move to frontmatter title", actionTitles(actions))
	}
	if got := applyEdits(doc, actionEdits(t, actions[0])); got != "---\ntitle: \"Hello: World\"\n---\n\n" {
		t.Fatalf("after the fix the document is %q, want the title quoted (it holds a colon)", got)
	}
}

func TestCodeActionNoFixForH1Warning(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: T\n---\n\n# Hello\n")
	actions := s.codeActions(t, documentURI, 4, 3)
	if len(actions) != 0 {
		t.Fatalf("actions = %v, want none (the override warning has no fix)", actionTitles(actions))
	}
}

func TestCodeActionNoFixForSecondH1(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	documentURI := s.open(t, filepath.Join(s.root, "page.mdx"), "# First\n\n# Second\n")
	actions := s.codeActions(t, documentURI, 2, 3)
	if len(actions) != 0 {
		t.Fatalf("actions = %v, want none (the second-H1 error has no fix)", actionTitles(actions))
	}
}
