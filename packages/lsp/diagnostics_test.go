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
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<Foo>text</Foo>\n")
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
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<Btn variant=\"primary\">Click</Btn>\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsLowercaseTagsSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<div><span>text</span></div>\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for plain HTML", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsFencedCodeSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n```mdx\n<Foo>\n```\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for fenced code", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsInlineCodeSkipped(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\nUse `<Foo>` and `<Icon>` for things.\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for inline code spans", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsMissingRequiredProp(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<Icon>\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Missing required prop 'id' for <Icon>") {
		t.Fatalf("diagnostics = %v, want the missing-id warning", diagnosticMessages(diags))
	}
}

func TestComponentDiagnosticsMissingRequiredPropPresent(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<Icon id=\"lu:star\">\n\n<TabItem value=\"a\">x</TabItem>\n")
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
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n"+tc.markup+"\n")
		if !hasDiagnostic(diags, tc.want) {
			t.Fatalf("diagnostics for %s = %v, want %q", tc.markup, diagnosticMessages(diags), tc.want)
		}
	}
}

func TestComponentDiagnosticsBadEnumValue(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<Btn variant=\"bogus\">\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Invalid value 'bogus' for prop 'variant'") {
		t.Fatalf("diagnostics = %v, want the invalid-enum warning", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 14 {
		t.Fatalf("diagnostic range = %+v, want the value inside the quotes", diags[0].Range)
	}
}

func TestComponentDiagnosticsValidIcons(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n<Icon id=\"lu:star\">\n\n<DynamicIcon icon=\"🚀\">\n\n<DynamicIcon icon=\"/img/logo.png\">\n\n<Icon id=\"react\">\n")
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
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "## Hello\n\nSee {vars.nope} here.\n")
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
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\n{vars.known} and {vars.nested.deep} work.\n")
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
	doc := "## Hello\n\nText {vars.a} here.\n\nUse `{vars.b}` inline.\n\n```sh\nrun {vars.c}\n```\n\n[link]({vars.d})\n\n![img]({vars.e})\n\n{vars.f}\n"
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
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Hello\n\nSee {env.PORTO_LSP_TEST_NOPE} here.\n")
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
	doc := "## Hello\n\nText {env.PORTO_LSP_TEST_A} here.\n\nUse `{env.PORTO_LSP_TEST_B}` inline.\n\n```sh\nrun {env.PORTO_LSP_TEST_C}\n```\n\n[link]({env.PORTO_LSP_TEST_D})\n\n![img]({env.PORTO_LSP_TEST_E})\n\n{env.PORTO_LSP_TEST_F}\n"
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
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "## Hello\n\n<Foo>\n\n<Icon>\n")
	if len(diags) != 0 {
		t.Fatalf("lenient diagnostics = %v, want none", diagnosticMessages(diags))
	}
	diags = s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "## Hello\n\n<Icon id=\"xx:star\">\n")
	if !hasDiagnostic(diags, "Unknown icon prefix") {
		t.Fatalf("lenient icon diagnostics = %v, want the bad-prefix warning", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsBrokenCleanURL(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n[install](/docs/missing/)\n")
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
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n[sib](./missing.mdx)\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken link "./missing.mdx"`) {
		t.Fatalf("diagnostics = %v, want the broken-link error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
}

func TestLinkDiagnosticsValidLinksAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\n[install](/docs/getting-started/installation/)\n\n[gs](/docs/getting-started/)\n\n[noslash](/docs/getting-started/installation)\n\n[sib](./sibling.mdx)\n\n[up](../docs/sibling.mdx)\n\n[home](/)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsExternalAndAnchorAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\n[x](https://example.com/page)\n\n[y](http://example.com)\n\n[z](mailto:me@example.com)\n\n[w](//cdn.example.com/x.js)\n\n[v](#details)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for external and anchor-only links", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsVarsDestinationIsQuiet(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_DOCS_URL", "/docs/getting-started/")
	root := contentFixture(t, "docs_home:\n  title: Docs\nvars:\n  page: /docs/getting-started/\n  slug: getting-started\n", map[string]string{
		"docs/1 - getting-started/index.mdx": "## Getting Started\n",
	})
	s := startTestServer(t, root)
	doc := "## Page\n\n[x]({vars.page})\n\n[y](/docs/{vars.slug}/)\n\n[z]({env.PORTO_LSP_TEST_DOCS_URL})\n"
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
	doc := "## Page\n\n<Link href=\"/docs/missing/\">x</Link>\n\n<Btn href=\"./missing.mdx\">x</Btn>\n\n<Link href=\"/docs/getting-started/\">x</Link>\n\n<Btn href=\"./sibling.mdx\">x</Btn>\n\n<Link href={dynamic}>x</Link>\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 2 {
		t.Fatalf("diagnostics = %v, want one per broken JSX link", diagnosticMessages(diags))
	}
	if !hasDiagnostic(diags, `Broken link "/docs/missing/"`) || !hasDiagnostic(diags, `Broken link "./missing.mdx"`) {
		t.Fatalf("diagnostics = %v, want both broken JSX destinations", diagnosticMessages(diags))
	}
}

// Image destinations are the broken-image check's job: a
// missing image file draws a broken-image diagnostic, never a
// broken-link one.
func TestLinkDiagnosticsImageLinksSkipped(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\n![img](/images/missing.png)\n\n![img](./missing.png)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 2 {
		t.Fatalf("diagnostics = %v, want the two broken-image errors", diagnosticMessages(diags))
	}
	for _, d := range diags {
		if !strings.HasPrefix(string(d.Message.(protocol.String)), "Broken image ") {
			t.Fatalf("diagnostics = %v, want only broken-image errors", diagnosticMessages(diags))
		}
	}
}

// imagesFixture is a project with an image next to the docs and
// one under static/, for the broken-image checks.
func imagesFixture(t *testing.T) string {
	t.Helper()
	return contentFixture(t, "docs_home:\n  title: Docs\nvars:\n  logo: /images/existing.png\n", map[string]string{
		"docs/existing.png":          "fake png",
		"docs/my pic.png":            "fake png",
		"static/images/existing.png": "fake png",
	})
}

func TestImageDiagnosticsBrokenRelative(t *testing.T) {
	s := startTestServer(t, imagesFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n![img](./missing.png)\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken image "./missing.png"`) {
		t.Fatalf("diagnostics = %v, want the broken-image error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 7 || diags[0].Range.End.Character != 20 {
		t.Fatalf("diagnostic range = %+v, want the src", diags[0].Range)
	}
}

func TestImageDiagnosticsBrokenAbsolute(t *testing.T) {
	s := startTestServer(t, imagesFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n![img](/images/missing.png)\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken image "/images/missing.png"`) {
		t.Fatalf("diagnostics = %v, want the broken-image error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
}

func TestImageDiagnosticsValidImagesAreQuiet(t *testing.T) {
	s := startTestServer(t, imagesFixture(t))
	doc := "## Page\n\n![a](./existing.png)\n\n![b](/images/existing.png)\n\n![c](./existing.png \"A title\")\n\n![d](./my%20pic.png)\n\n![e](./existing.png?v=2)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none", diagnosticMessages(diags))
	}
}

func TestImageDiagnosticsExternalAndSpecialAreQuiet(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_LOGO", "logo.png")
	s := startTestServer(t, imagesFixture(t))
	doc := "## Page\n\n![a](https://example.com/x.png)\n\n![b](http://example.com/x.png)\n\n![c](//cdn.example.com/x.png)\n\n![d](data:image/png;base64,AAAA)\n\n![e]()\n\n![f]({vars.logo})\n\n![g](/images/{env.PORTO_LSP_TEST_LOGO}.png)\n\n![h](images/bare.png)\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for unchecked sources", diagnosticMessages(diags))
	}
}

func TestImageDiagnosticsSeverityFollowsSetting(t *testing.T) {
	for _, tc := range []struct {
		setting  string
		severity protocol.DiagnosticSeverity
		want     int
	}{
		{"warn", protocol.DiagnosticSeverityWarning, 1},
		{"ignore", 0, 0},
		{"bogus", protocol.DiagnosticSeverityError, 1},
	} {
		config := "site:\n  content:\n    on_broken_images: " + tc.setting + "\n"
		s := startTestServer(t, fixtureProjectWithConfig(t, config))
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "![x](./missing.png)\n")
		if len(diags) != tc.want {
			t.Fatalf("on_broken_images %q: diagnostics = %v, want %d", tc.setting, diagnosticMessages(diags), tc.want)
		}
		if tc.want == 1 && diags[0].Severity != tc.severity {
			t.Fatalf("on_broken_images %q: severity = %v, want %v", tc.setting, diags[0].Severity, tc.severity)
		}
	}
}

func TestImageDiagnosticsImgTag(t *testing.T) {
	s := startTestServer(t, imagesFixture(t))
	doc := "## Page\n\n<img src=\"./missing.png\" />\n\n<img src=\"/images/missing.png\" />\n\n<img src=\"./existing.png\" />\n\n<img src={dynamic} />\n\n<img src=\"https://example.com/x.png\" />\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 2 {
		t.Fatalf("diagnostics = %v, want one per broken img src", diagnosticMessages(diags))
	}
	if !hasDiagnostic(diags, `Broken image "./missing.png"`) || !hasDiagnostic(diags, `Broken image "/images/missing.png"`) {
		t.Fatalf("diagnostics = %v, want both broken img sources", diagnosticMessages(diags))
	}
}

func TestImageDiagnosticsCodeSkipped(t *testing.T) {
	s := startTestServer(t, imagesFixture(t))
	doc := "## Page\n\n```md\n![x](./missing.png)\n\n<img src=\"./missing.png\" />\n```\n\nUse `![y](./missing.png)` inline.\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for images in code", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsCodeSkipped(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\n```md\n[x](/docs/missing/)\n```\n\nUse `[y](/docs/missing/)` inline.\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for links in code", diagnosticMessages(diags))
	}
}

// A link is fine as long as its page exists: the #hash is
// never validated against the page's headings.
func TestLinkDiagnosticsHashNotValidated(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n[setup](/docs/getting-started/installation/#nope)\n\n[sib](./sibling.mdx#nope)\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for unknown hashes on existing pages", diagnosticMessages(diags))
	}
}

func TestFrontmatterSlugDiagnosticsMultiSegment(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\nslug: a/b\n---\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Slug "a/b" must be a single segment`) {
		t.Fatalf("diagnostics = %v, want exactly one multi-segment slug error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 1 || diags[0].Range.Start.Character != 6 || diags[0].Range.End.Character != 9 {
		t.Fatalf("diagnostic range = %+v, want the slug value", diags[0].Range)
	}
}

func TestFrontmatterSlugDiagnosticsQuoted(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\nslug: \"a/b\"\n---\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Slug "a/b" must be a single segment`) {
		t.Fatalf("diagnostics = %v, want exactly one multi-segment slug error", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 1 || diags[0].Range.Start.Character != 6 || diags[0].Range.End.Character != 11 {
		t.Fatalf("diagnostic range = %+v, want the quoted slug value", diags[0].Range)
	}
}

func TestFrontmatterSlugDiagnosticsValid(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	for _, doc := range []string{"---\nslug: apple\n---\n", "---\ntitle: Hello\n---\n"} {
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
		if len(diags) != 0 {
			t.Fatalf("diagnostics for %q = %v, want none", doc, diagnosticMessages(diags))
		}
	}
}

// The slug check is static, so it runs in lenient mode too,
// where the schema path never runs.
func TestFrontmatterSlugDiagnosticsLenientMode(t *testing.T) {
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
	diags := s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "---\nslug: a/b\n---\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Slug "a/b" must be a single segment`) {
		t.Fatalf("lenient diagnostics = %v, want the multi-segment slug error", diagnosticMessages(diags))
	}
	diags = s.openDiagnostics(t, filepath.Join(root, "page.mdx"), "---\nslug: apple\n---\n")
	if len(diags) != 0 {
		t.Fatalf("lenient diagnostics for a single segment = %v, want none", diagnosticMessages(diags))
	}
}

// The schema's pattern also rejects a slug with no letter or
// digit. That failure is not a slash, so the schema error still
// comes through (strict mode only) — the dedup skips only
// pattern errors the slug check already covers.
func TestFrontmatterSlugDiagnosticsNoAlphanumeric(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "---\nslug: ---\n---\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "does not match pattern") {
		t.Fatalf("diagnostics = %v, want the schema pattern error", diagnosticMessages(diags))
	}
}

// duplicateSlugFixture is a docs-mode project with the given
// content files on disk.
func duplicateSlugFixture(t *testing.T, files map[string]string) string {
	t.Helper()
	return contentFixture(t, "docs_home:\n  title: Docs\n", files)
}

func TestDuplicateSlugDiagnosticsNumericPrefix(t *testing.T) {
	root := duplicateSlugFixture(t, map[string]string{
		"docs/1 - intro.mdx": "## Intro\n",
		"docs/2 - intro.mdx": "## Intro again\n",
	})
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "docs", "1 - intro.mdx"), "## Intro\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "Duplicate slug") {
		t.Fatalf("diagnostics = %v, want the duplicate-slug warning", diagnosticMessages(diags))
	}
	if !hasDiagnostic(diags, "docs/2 - intro.mdx") || !hasDiagnostic(diags, "/docs/intro/") {
		t.Fatalf("diagnostics = %v, want the other file and the shared URL named", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityWarning {
		t.Fatalf("severity = %v, want warning", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 0 {
		t.Fatalf("diagnostic line = %d, want 0 (the first line, no slug key)", diags[0].Range.Start.Line)
	}
	diags = s.openDiagnostics(t, filepath.Join(root, "docs", "2 - intro.mdx"), "## Intro again\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/1 - intro.mdx") {
		t.Fatalf("diagnostics = %v, want the warning on the other side too", diagnosticMessages(diags))
	}
}

func TestDuplicateSlugDiagnosticsSlugOverride(t *testing.T) {
	root := duplicateSlugFixture(t, map[string]string{
		"docs/apple.mdx":  "## Apple\n",
		"docs/orange.mdx": "---\nslug: apple\n---\n## Orange\n",
	})
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "docs", "orange.mdx"), "---\nslug: apple\n---\n## Orange\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/apple.mdx") || !hasDiagnostic(diags, "/docs/apple/") {
		t.Fatalf("diagnostics = %v, want the duplicate-slug warning", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 1 || diags[0].Range.Start.Character != 6 || diags[0].Range.End.Character != 11 {
		t.Fatalf("diagnostic range = %+v, want the slug value", diags[0].Range)
	}
	diags = s.openDiagnostics(t, filepath.Join(root, "docs", "apple.mdx"), "## Apple\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/orange.mdx") {
		t.Fatalf("diagnostics = %v, want the warning on the other side too", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 0 {
		t.Fatalf("diagnostic line = %d, want 0 (the first line, no slug key)", diags[0].Range.Start.Line)
	}
}

func TestDuplicateSlugDiagnosticsReadmeVsIndex(t *testing.T) {
	root := duplicateSlugFixture(t, map[string]string{
		"docs/guide/README.mdx": "## Guide\n",
		"docs/guide/index.mdx":  "## Guide index\n",
	})
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "docs", "guide", "README.mdx"), "## Guide\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/guide/index.mdx") || !hasDiagnostic(diags, "/docs/guide/") {
		t.Fatalf("diagnostics = %v, want the readme/index collision warning", diagnosticMessages(diags))
	}
}

func TestDuplicateSlugDiagnosticsReadmeVsSibling(t *testing.T) {
	root := duplicateSlugFixture(t, map[string]string{
		"docs/guide/README.mdx": "## Guide\n",
		"docs/guide.mdx":        "## Guide page\n",
	})
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "docs", "guide", "README.mdx"), "## Guide\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/guide.mdx") || !hasDiagnostic(diags, "/docs/guide/") {
		t.Fatalf("diagnostics = %v, want the readme/sibling collision warning", diagnosticMessages(diags))
	}
}

func TestDuplicateSlugDiagnosticsStrippedFolders(t *testing.T) {
	root := duplicateSlugFixture(t, map[string]string{
		"docs/1 - guide/setup.mdx": "## Setup\n",
		"docs/2 - guide/setup.mdx": "## Setup again\n",
	})
	s := startTestServer(t, root)
	diags := s.openDiagnostics(t, filepath.Join(root, "docs", "1 - guide", "setup.mdx"), "## Setup\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/2 - guide/setup.mdx") || !hasDiagnostic(diags, "/docs/guide/setup/") {
		t.Fatalf("diagnostics = %v, want the stripped-folder collision warning", diagnosticMessages(diags))
	}
}

func TestDuplicateSlugDiagnosticsDistinctPagesAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "sibling.mdx"), "## Sibling\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for distinct pages", diagnosticMessages(diags))
	}
}

func TestDuplicateSlugDiagnosticsOutsideContentDirIsQuiet(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Page\n")
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for a file outside the content dirs", diagnosticMessages(diags))
	}
}

// The duplicate check reads the project files directly, so it
// runs in lenient mode too, where the schema path never runs.
func TestDuplicateSlugDiagnosticsLenientMode(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "porto.yml"), []byte("docs_home:\n  title: Docs\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	for rel, content := range map[string]string{
		"docs/1 - intro.mdx": "## Intro\n",
		"docs/2 - intro.mdx": "## Intro again\n",
	} {
		path := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
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
	diags := s.openDiagnostics(t, filepath.Join(root, "docs", "1 - intro.mdx"), "## Intro\n")
	if len(diags) != 1 || !hasDiagnostic(diags, "docs/2 - intro.mdx") {
		t.Fatalf("lenient diagnostics = %v, want the duplicate-slug warning", diagnosticMessages(diags))
	}
}

func TestLinkDiagnosticsRefDefinitionBrokenCleanURL(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n[install]: /docs/missing/\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken link "/docs/missing/"`) {
		t.Fatalf("diagnostics = %v, want the broken-link error", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 || diags[0].Range.Start.Character != 11 || diags[0].Range.End.Character != 25 {
		t.Fatalf("diagnostic range = %+v, want the destination", diags[0].Range)
	}
}

func TestLinkDiagnosticsRefDefinitionBrokenRelativePath(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), "## Page\n\n[install]: ./missing.mdx\n")
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken link "./missing.mdx"`) {
		t.Fatalf("diagnostics = %v, want the broken-link error", diagnosticMessages(diags))
	}
}

func TestRefDiagnosticsUndefined(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\nSee [x][missing] and [gone][] here.\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 2 || !hasDiagnostic(diags, `Undefined link reference "[missing]"`) || !hasDiagnostic(diags, `Undefined link reference "[gone]"`) {
		t.Fatalf("diagnostics = %v, want both undefined-ref warnings", diagnosticMessages(diags))
	}
	for _, diag := range diags {
		if diag.Severity != protocol.DiagnosticSeverityWarning {
			t.Fatalf("severity = %v, want warning", diag.Severity)
		}
	}
}

func TestRefDiagnosticsShortcutWithoutDefinitionIsQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\n[just text] and [x][defined].\n\n[defined]: /docs/getting-started/\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none (a bare bracket is not a use without a definition)", diagnosticMessages(diags))
	}
}

func TestRefDiagnosticsValidAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\nSee [the install][install], [guide][] and [guide].\n\n[install]: /docs/getting-started/installation/\n[guide]: /docs/getting-started/\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for defined refs with valid destinations", diagnosticMessages(diags))
	}
}

func TestRefDiagnosticsExternalAndAnchorAreQuiet(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\nSee [x][ext] and [y][anchor].\n\n[ext]: https://example.com/page\n[anchor]: #details\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for external and anchor-only definition destinations", diagnosticMessages(diags))
	}
}

func TestImageDiagnosticsRefDefinition(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/page.mdx":         "## Page\n",
		"static/images/pic.png": "fake png",
	})
	s := startTestServer(t, root)
	doc := "## Page\n\n![alt][pic]\n\n[pic]: /images/pic.png\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none (an absolute image src resolves against static/, not the page index)", diagnosticMessages(diags))
	}
	doc = "## Page\n\n![alt][gone]\n\n[gone]: ./missing.png\n"
	diags = s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, `Broken image "./missing.png"`) {
		t.Fatalf("diagnostics = %v, want the broken-image error", diagnosticMessages(diags))
	}
}

func TestRefDiagnosticsCodeSkipped(t *testing.T) {
	s := startTestServer(t, docsFixture(t))
	doc := "## Page\n\n```\n[bad]: /docs/missing/\n```\n\nUse `[x][bad]` here.\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "docs", "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for definitions and uses in code", diagnosticMessages(diags))
	}
}

func TestDuplicateHeadingDiagnosticsDefault(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "## Prerequisites\n\nSome text.\n\n## Prerequisites\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, `Duplicate heading "Prerequisites"`) || !hasDiagnostic(diags, `"prerequisites-1"`) {
		t.Fatalf("diagnostics = %v, want the duplicate-heading warning naming the -1 id", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityWarning {
		t.Fatalf("severity = %v, want warning (the default)", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 4 || diags[0].Range.Start.Character != 3 || diags[0].Range.End.Character != 16 {
		t.Fatalf("diagnostic range = %+v, want the second heading's text", diags[0].Range)
	}
}

func TestDuplicateHeadingDiagnosticsSeverityFollowsSetting(t *testing.T) {
	for _, tc := range []struct {
		setting  string
		severity protocol.DiagnosticSeverity
		want     int
	}{
		{"throw", protocol.DiagnosticSeverityError, 1},
		{"ignore", 0, 0},
		{"bogus", protocol.DiagnosticSeverityWarning, 1},
	} {
		config := "site:\n  content:\n    on_duplicate_h2: " + tc.setting + "\n"
		s := startTestServer(t, fixtureProjectWithConfig(t, config))
		diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), "## Same\n\n## Same\n")
		if len(diags) != tc.want {
			t.Fatalf("on_duplicate_h2 %q: diagnostics = %v, want %d", tc.setting, diagnosticMessages(diags), tc.want)
		}
		if tc.want == 1 && diags[0].Severity != tc.severity {
			t.Fatalf("on_duplicate_h2 %q: severity = %v, want %v", tc.setting, diags[0].Severity, tc.severity)
		}
	}
}

func TestDuplicateHeadingDiagnosticsCustomID(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "## First [#shared]\n\n## Second [#shared]\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, `Duplicate heading id "shared"`) {
		t.Fatalf("diagnostics = %v, want the shared custom id warning", diagnosticMessages(diags))
	}
}

func TestDuplicateHeadingDiagnosticsUniqueAreQuiet(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "## One\n\n## Two\n\n## Three\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none for distinct headings", diagnosticMessages(diags))
	}
}

func TestDuplicateHeadingDiagnosticsH3Flagged(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "## Init\n\n### Options\n\n## Build\n\n### Options\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, `Duplicate heading "Options"`) || !hasDiagnostic(diags, `"options-1"`) {
		t.Fatalf("diagnostics = %v, want the h3 duplicate flagged (the LSP checks every level)", diagnosticMessages(diags))
	}
}

func TestH1TitleWarningTitleAndH1(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\ntitle: Hello\n---\n\n# Hello\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, "overrides the frontmatter title") {
		t.Fatalf("diagnostics = %v, want the H1-overrides-title warning", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityWarning {
		t.Fatalf("severity = %v, want warning", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 4 || diags[0].Range.Start.Character != 2 || diags[0].Range.End.Character != 7 {
		t.Fatalf("diagnostic range = %+v, want the H1 text on line 4", diags[0].Range)
	}
}

func TestH1TitleWarningSkippedWithHideTitle(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\ntitle: Hello\nhide_title: true\n---\n\n# Hello\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none (hide_title hides the H1, nothing is overridden)", diagnosticMessages(diags))
	}
}

func TestH1TitleErrorSecondH1(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\ntitle: T\n---\n\n# First\n\n# Second\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 2 || !hasDiagnostic(diags, "overrides the frontmatter title") || !hasDiagnostic(diags, "already has an H1") {
		t.Fatalf("diagnostics = %v, want the override warning plus the second-H1 error", diagnosticMessages(diags))
	}
	for _, d := range diags {
		if d.Severity == protocol.DiagnosticSeverityError && d.Range.Start.Line != 6 {
			t.Fatalf("error range = %+v, want the second H1 on line 6", d.Range)
		}
	}
}

func TestH1TitleErrorLoneH1AfterH2(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "## Intro\n\n# Only\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, "already has an H1") {
		t.Fatalf("diagnostics = %v, want the error (the first heading is H2, so this H1 renders next to the title)", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityError {
		t.Fatalf("severity = %v, want error", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 2 {
		t.Fatalf("diagnostic range = %+v, want the H1 on line 2", diags[0].Range)
	}
}

func TestH1TitleHoistedPlusSecondWithHideTitle(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\nhide_title: true\n---\n\n# First\n\n# Second\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none (the hoisted H1 is hidden, the second is the only visible H1)", diagnosticMessages(diags))
	}
}

func TestH1TitleErrorSecondInPlaceWithHideTitle(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\nhide_title: true\n---\n\n## Intro\n\n# One\n\n# Two\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, "already has an H1") {
		t.Fatalf("diagnostics = %v, want the error on the second in-place H1", diagnosticMessages(diags))
	}
	if diags[0].Range.Start.Line != 8 {
		t.Fatalf("diagnostic range = %+v, want the second in-place H1 on line 8", diags[0].Range)
	}
}

func TestH1TitleHintNoTitle(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "# Hello\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 1 || !hasDiagnostic(diags, "title` frontmatter key") {
		t.Fatalf("diagnostics = %v, want the suggest-the-title-key hint", diagnosticMessages(diags))
	}
	if diags[0].Severity != protocol.DiagnosticSeverityHint {
		t.Fatalf("severity = %v, want hint", diags[0].Severity)
	}
	if diags[0].Range.Start.Line != 0 || diags[0].Range.Start.Character != 2 || diags[0].Range.End.Character != 7 {
		t.Fatalf("diagnostic range = %+v, want the H1 text on line 0", diags[0].Range)
	}
}

func TestH1TitleHintSkippedWithHideTitle(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "---\nhide_title: true\n---\n\n# Hello\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none (a frontmatter title would be hidden too)", diagnosticMessages(diags))
	}
}

func TestH1TitleEmptyH1IsQuiet(t *testing.T) {
	s := startTestServer(t, fixtureProject(t))
	doc := "# [#id]\n"
	diags := s.openDiagnostics(t, filepath.Join(s.root, "page.mdx"), doc)
	if len(diags) != 0 {
		t.Fatalf("diagnostics = %v, want none (an empty H1 hoists no title and renders nowhere)", diagnosticMessages(diags))
	}
}
