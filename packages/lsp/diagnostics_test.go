package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go.lsp.dev/protocol"
)

// openDiagnostics opens a document and returns the diagnostics
// the server publishes for it.
func (s *testServer) openDiagnostics(t *testing.T, path, text string) []protocol.Diagnostic {
	t.Helper()
	documentURI := s.openNoWait(t, path, text)
	return s.waitDiagnostics(t, documentURI)
}

func diagnosticMessages(diags []protocol.Diagnostic) []string {
	var out []string
	for _, d := range diags {
		out = append(out, string(d.Message.(protocol.String)))
	}
	return out
}

func hasDiagnostic(diags []protocol.Diagnostic, want string) bool {
	for _, message := range diagnosticMessages(diags) {
		if strings.Contains(message, want) {
			return true
		}
	}
	return false
}

func TestComponentDiagnosticsUnknownComponent(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Foo>text</Foo>\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Unknown component <Foo>") {
		t.Fatalf("diagnostics = %v, want one unknown-component warning", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityWarning {
		t.Fatalf("severity = %v, want warning", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 {
		t.Fatalf("diagnostic line = %d, want 2", diags[0].Range.Start.Line)
	}
}

func TestComponentDiagnosticsKnownComponentIsClean(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"primary\">Click</Btn>\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsLowercaseTagsSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<div><span>text</span></div>\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for plain HTML", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsFencedCodeSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n```mdx\n<Foo>\n```\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for fenced code", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsInlineCodeSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\nUse `<Foo>` and `<Icon>` for things.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for inline code spans", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsMissingRequiredProp(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon>\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Missing required prop 'id' for <Icon>") {
		t.Fatalf("diagnostics = %v, want the missing-id warning", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsMissingRequiredPropPresent(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon id=\"lu:star\">\n\n<TabItem value=\"a\">x</TabItem>\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsBadIcon(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	for _, tc := range []struct {
		markup string
		want   string
	}{
		{`<Icon id="xx:star">`, "Unknown icon prefix"},
		{`<Icon id="star">`, "Malformed icon id"},
		{`<Icon id="lu:">`, "Malformed icon id"},
		{`<Btn icon="xx:star">x</Btn>`, "Unknown icon prefix"},
		{`<DynamicIcon icon="xx:star">`, "Unknown icon prefix"},
	} {
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n"+tc.markup+"\n")
		if !hasDiagnostic(diags, tc.want) {
			t.Fatalf("diagnostics for %s = %v, want %q", tc.markup, diagnosticMessages(diags), tc.want)
		}
	}
}

func TestComponentDiagnosticsBadEnumValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Btn variant=\"bogus\">\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Invalid value 'bogus' for prop 'variant'") {
		t.Fatalf("diagnostics = %v, want the invalid-enum warning", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 14 {
		t.Fatalf("diagnostic range = %+v, want the value inside the quotes", diags[0].Range)
	}
}

func TestComponentDiagnosticsValidIcons(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n<Icon id=\"lu:star\">\n\n<DynamicIcon icon=\"🚀\">\n\n<DynamicIcon icon=\"/img/logo.png\">\n\n<Icon id=\"react\">\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestFrontmatterIconDiagnostics(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\nicon: xx:star\n---\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Unknown icon prefix") {
		t.Fatalf("diagnostics = %v, want the bad-prefix warning", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 1 {
		t.Fatalf("diagnostic line = %d, want 1", diags[0].Range.Start.Line)
	}
}

func TestFrontmatterIconDiagnosticsValid(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	for _, icon := range []string{"lu:star", "🚀", "react", "/img/logo.png"} {
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\nicon: "+icon+"\n---\n")
		if len(diags) != 0 {
			t.Fatalf("diagnostics for icon %q = %v, want none", icon, diagnosticMessages(diags))
		}
	}
}

func TestVarsDiagnosticsUnknownKeyDefault(t *testing.T) {
	root := fixtureProjectWithConfig(t, "vars:\n  known: hello\n")
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "# Hello\n\nSee {vars.nope} here.\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Unknown vars key "{vars.nope}"`) {
		t.Fatalf("diagnostics = %v, want the unknown-vars-key error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 4 || diags[0].Range.End.Character != 15 {
		t.Fatalf("diagnostic range = %+v, want the {vars.nope} occurrence", diags[0].Range)
	}
}

func TestVarsDiagnosticsSeverityFollowsSetting(t *testing.T) {
	for _, tc := range []struct {
		setting  string
		severity protocol.DiagnosticSeverity
		want     int
	}{
		{"warn", protocol.DiagnosticSeverityWarning, 1},
		{"ignore", 0, 0},
		{"bogus", protocol.DiagnosticSeverityError, 1},
	} {
		config := "site:\n  content:\n    on_missing_var: " + tc.setting + "\nvars:\n  known: hello\n"
		s := startTestServer(t, fixtureProjectWithConfig(t, config))
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "See {vars.nope}.\n")
		if len(diags) != tc.want {
			t.Fatalf("on_missing_var %q: diagnostics = %v, want %d", tc.setting, diagnosticMessages(diags), tc.want)
		}
		if tc.want == 1 && diags[0].Severity != tc.severity {
			t.Fatalf("on_missing_var %q: severity = %v, want %v", tc.setting, diags[0].Severity, tc.severity)
		}
	}
}

func TestVarsDiagnosticsKnownKeysAreQuiet(t *testing.T) {
	config := "vars:\n  known: hello\n  nested:\n    deep: 42\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\n{vars.known} and {vars.nested.deep} work.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestVarsDiagnosticsNestedMissingKey(t *testing.T) {
	config := "vars:\n  nested:\n    deep: 42\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "See {vars.nested.nope}.\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Unknown vars key "{vars.nested.nope}"`) {
		t.Fatalf("diagnostics = %v, want the nested unknown-key error", diagnosticMessages(diags))
	}
}

func TestVarsDiagnosticsEscapeIsQuiet(t *testing.T) {
	config := "vars:\n  known: hello\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "Write {{vars.nope}} literally, even {{{vars.nope}}}.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for the escape form", diagnosticMessages(diags))
	}
}

func TestVarsDiagnosticsAllPositions(t *testing.T) {
	config := "vars:\n  known: hello\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	doc := "# Hello\n\nText {vars.a} here.\n\nUse `{vars.b}` inline.\n\n```sh\nrun {vars.c}\n```\n\n[link]({vars.d})\n\n![img]({vars.e})\n\n{vars.f}\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 6 {
		t.Fatalf("diagnostics = %v, want one per position", diagnosticMessages(diags))
	}
	for _, key := range []string{"a", "b", "c", "d", "e", "f"} {
		if !hasDiagnostic(diags, `Unknown vars key "{vars.`+key+`}"`) {
			t.Fatalf("diagnostics = %v, want the {vars.%s} error", diagnosticMessages(diags), key)
		}
	}
}

func TestVarsDiagnosticsFrontmatterSkipped(t *testing.T) {
	config := "vars:\n  known: hello\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: \"See {vars.nope}\"\n---\n\nBody text.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for a reference in frontmatter", diagnosticMessages(diags))
	}
}

func TestVarsDiagnosticsUnclosedFrontmatterSkipped(t *testing.T) {
	config := "vars:\n  known: hello\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: x\n\nSee {vars.nope}.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none when the frontmatter never closes", diagnosticMessages(diags))
	}
}

// The build only substitutes strings and numbers: a reference to
// a nested map or a boolean is unknown to it, so the server
// flags it too.
func TestVarsDiagnosticsNonScalarValueIsUnknown(t *testing.T) {
	config := "vars:\n  nested:\n    deep: 42\n  flag: true\n"
	s := startTestServer(t, fixtureProjectWithConfig(t, config))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "See {vars.nested} and {vars.flag}.\n")
	if len(diags) != 2 {
		t.Fatalf("diagnostics = %v, want one per non-scalar reference", diagnosticMessages(diags))
	}
}

// A project without a vars: section has no known keys, so every
// reference is unknown. (The build leaves such references
// untouched instead of failing; the diagnostic still flags them,
// since the reference can never resolve.)
func TestVarsDiagnosticsNoVarsSection(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "See {vars.nope}.\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Unknown vars key "{vars.nope}"`) {
		t.Fatalf("diagnostics = %v, want the unknown-vars-key error", diagnosticMessages(diags))
	}
}

func TestEnvDiagnosticsMissingVarDefault(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "# Hello\n\nSee {env.PORTO_LSP_TEST_NOPE} here.\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Unset env var "{env.PORTO_LSP_TEST_NOPE}"`) {
		t.Fatalf("diagnostics = %v, want the unset-env-var warning", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityWarning {
		t.Fatalf("severity = %v, want warning", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 4 || diags[0].Range.End.Character != 29 {
		t.Fatalf("diagnostic range = %+v, want the {env.PORTO_LSP_TEST_NOPE} occurrence", diags[0].Range)
	}
}

func TestEnvDiagnosticsSeverityFollowsSetting(t *testing.T) {
	for _, tc := range []struct {
		setting  string
		severity protocol.DiagnosticSeverity
		want     int
	}{
		{"throw", protocol.DiagnosticSeverityError, 1},
		{"ignore", 0, 0},
		{"bogus", protocol.DiagnosticSeverityWarning, 1},
	} {
		config := "site:\n  content:\n    on_missing_env: " + tc.setting + "\n"
		s := startTestServer(t, fixtureProjectWithConfig(t, config))
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "See {env.PORTO_LSP_TEST_NOPE}.\n")
		if len(diags) != tc.want {
			t.Fatalf("on_missing_env %q: diagnostics = %v, want %d", tc.setting, diagnosticMessages(diags), tc.want)
		}
		if tc.want == 1 && diags[0].Severity != tc.severity {
			t.Fatalf("on_missing_env %q: severity = %v, want %v", tc.setting, diags[0].Severity, tc.severity)
		}
	}
}

func TestEnvDiagnosticsDefinedInProcessEnvIsQuiet(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_DEFINED", "from-process")
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "See {env.PORTO_LSP_TEST_DEFINED}.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for a var set in the process environment", diagnosticMessages(diags))
	}
}

func TestEnvDiagnosticsDefinedInDotenvIsQuiet(t *testing.T) {
	root := fixtureProject(t)
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("PORTO_LSP_TEST_IN_DOTENV=from-dotenv\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".env.local"), []byte("PORTO_LSP_TEST_IN_LOCAL=from-local\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "See {env.PORTO_LSP_TEST_IN_DOTENV} and {env.PORTO_LSP_TEST_IN_LOCAL} but not {env.PORTO_LSP_TEST_NOPE}.\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Unset env var "{env.PORTO_LSP_TEST_NOPE}"`) {
		t.Fatalf("diagnostics = %v, want only the missing-var warning", diagnosticMessages(diags))
	}
}

func TestEnvDiagnosticsSetButEmptyIsQuiet(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_EMPTY_PROC", "")
	root := fixtureProject(t)
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("PORTO_LSP_TEST_EMPTY_FILE=\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "See {env.PORTO_LSP_TEST_EMPTY_PROC} and {env.PORTO_LSP_TEST_EMPTY_FILE}.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for vars set to an empty value", diagnosticMessages(diags))
	}
}

func TestEnvDiagnosticsEscapeIsQuiet(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "Write {{env.PORTO_LSP_TEST_NOPE}} literally, even {{{env.PORTO_LSP_TEST_NOPE}}}.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for the escape form", diagnosticMessages(diags))
	}
}

func TestEnvDiagnosticsAllPositions(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "# Hello\n\nText {env.PORTO_LSP_TEST_A} here.\n\nUse `{env.PORTO_LSP_TEST_B}` inline.\n\n```sh\nrun {env.PORTO_LSP_TEST_C}\n```\n\n[link]({env.PORTO_LSP_TEST_D})\n\n![img]({env.PORTO_LSP_TEST_E})\n\n{env.PORTO_LSP_TEST_F}\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 6 {
		t.Fatalf("diagnostics = %v, want one per position", diagnosticMessages(diags))
	}
	for _, key := range []string{"A", "B", "C", "D", "E", "F"} {
		if !hasDiagnostic(diags, `Unset env var "{env.PORTO_LSP_TEST_`+key+`}"`) {
			t.Fatalf("diagnostics = %v, want the {env.PORTO_LSP_TEST_%s} warning", diagnosticMessages(diags), key)
		}
	}
}

func TestEnvDiagnosticsFrontmatterSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: \"See {env.PORTO_LSP_TEST_NOPE}\"\n---\n\nBody text.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for a reference in frontmatter", diagnosticMessages(diags))
	}
}

func TestEnvDiagnosticsUnclosedFrontmatterSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\ntitle: x\n\nSee {env.PORTO_LSP_TEST_NOPE}.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none when the frontmatter never closes", diagnosticMessages(diags))
	}
}

// The schema-based component checks are strict-only: in lenient
// mode an unknown component draws no warning. The static icon
// checks still run.
func TestComponentDiagnosticsLenientMode(t *testing.T) {
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
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "# Hello\n\n<Foo>\n\n<Icon>\n")
	if len(diags) != 0 {
		t.Fatalf("lenient diagnostics = %v, want none", diagnosticMessages(diags))
	}
	diags = s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "# Hello\n\n<Icon id=\"xx:star\">\n")
	if !hasDiagnostic(diags, "Unknown icon prefix") {
		t.Fatalf("lenient icon diagnostics = %v, want the bad-prefix warning", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsBrokenCleanURL(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[install](/docs/missing/)\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken link "/docs/missing/"`) {
		t.Fatalf("diagnostics = %v, want the broken-link error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 10 || diags[0].Range.End.Character != 24 {
		t.Fatalf("diagnostic range = %+v, want the destination", diags[0].Range)
	}
}

func TestLinkDiagnosticsBrokenRelativePath(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[sib](./missing.mdx)\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken link "./missing.mdx"`) {
		t.Fatalf("diagnostics = %v, want the broken-link error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
}

func TestLinkDiagnosticsValidLinksAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n[install](/docs/getting-started/installation/)\n\n[gs](/docs/getting-started/)\n\n[sib](./sibling.mdx)\n\n[up](../docs/sibling.mdx)\n\n[home](/)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsExternalAndAnchorAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n[x](https://example.com/page)\n\n[y](http://example.com)\n\n[z](mailto:me@example.com)\n\n[w](//cdn.example.com/x.js)\n\n[v](#details)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for external and anchor-only links", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsVarsDestinationIsQuiet(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_DOCS_URL", "/docs/getting-started/")
	root := contentFixture(t, "docs_home:\n  title: Docs\nvars:\n  page: /docs/getting-started/\n  slug: getting-started\n", map[string]string{
		"docs/1 - getting-started/index.mdx": "# Getting Started\n",
	})
	s := startTestServer(t, root)
	doc := "# Page\n\n[x]({vars.page})\n\n[y](/docs/{vars.slug}/)\n\n[z]({env.PORTO_LSP_TEST_DOCS_URL})\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for destinations that resolve at build time", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsSeverityFollowsSetting(t *testing.T) {
	for _, tc := range []struct {
		setting  string
		severity protocol.DiagnosticSeverity
		want     int
	}{
		{"warn", protocol.DiagnosticSeverityWarning, 1},
		{"ignore", 0, 0},
		{"bogus", protocol.DiagnosticSeverityError, 1},
	} {
		config := "site:\n  content:\n    on_broken_links: " + tc.setting + "\n"
		s := startTestServer(t, fixtureProjectWithConfig(t, config))
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "[x](/docs/missing/)\n")
		if len(diags) != tc.want {
			t.Fatalf("on_broken_links %q: diagnostics = %v, want %d", tc.setting, diagnosticMessages(diags), tc.want)
		}
		if tc.want == 1 && diags[0].Severity != tc.severity {
			t.Fatalf("on_broken_links %q: severity = %v, want %v", tc.setting, diags[0].Severity, tc.severity)
		}
	}
}

func TestLinkDiagnosticsJSXProps(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n<Link to=\"/docs/missing/\">x</Link>\n\n<Btn href=\"./missing.mdx\">x</Btn>\n\n<Link to=\"/docs/getting-started/\">x</Link>\n\n<Btn href=\"./sibling.mdx\">x</Btn>\n\n<Link to={dynamic}>x</Link>\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 2 {
		t.Fatalf("diagnostics = %v, want one per broken JSX link", diagnosticMessages(diags))
	}
	if !hasDiagnostic(diags, `Broken link "/docs/missing/"`) || !hasDiagnostic(diags, `Broken link "./missing.mdx"`) {
		t.Fatalf("diagnostics = %v, want both broken JSX destinations", diagnosticMessages(diags))
	}
}

// Image destinations are the broken-image check's job: a
// missing image file must not draw a broken-link diagnostic.
func TestLinkDiagnosticsImageLinksSkipped(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n![img](/images/missing.png)\n\n![img](./missing.png)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for image links", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsCodeSkipped(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "# Page\n\n```md\n[x](/docs/missing/)\n```\n\nUse `[y](/docs/missing/)` inline.\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for links in code", diagnosticMessages(diags))
	}
}

// A link is fine as long as its page exists: the #hash is
// never validated against the page's headings.
func TestLinkDiagnosticsHashNotValidated(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n[setup](/docs/getting-started/installation/#nope)\n\n[sib](./sibling.mdx#nope)\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for unknown hashes on existing pages", diagnosticMessages(diags))
	}
}
