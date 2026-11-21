package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseDotenvLine(t *testing.T) {
	for _, tc := range []struct {
		line       string
		key, value string
		ok         bool
	}{
		{"FOO=bar", "FOO", "bar", true},
		{"FOO=", "FOO", "", true},
		{"FOO", "", "", false},
		{"", "", "", false},
		{"   ", "", "", false},
		{"# comment", "", "", false},
		{"  # comment", "", "", false},
		{"export FOO=bar", "FOO", "bar", true},
		{"export FOO", "", "", false},
		{`FOO="quoted value"`, "FOO", "quoted value", true},
		{"FOO='quoted value'", "FOO", "quoted value", true},
		{`FOO="unclosed`, "FOO", `"unclosed`, true},
		{"FOO = spaced", "FOO", "spaced", true},
		{"  FOO=bar  ", "FOO", "bar", true},
		{"1FOO=bar", "", "", false},
		{"FOO-BAR=baz", "", "", false},
		{"FOO.BAR=baz", "", "", false},
		{"FOO=a=b", "FOO", "a=b", true},
		{"_PRIVATE=yes", "_PRIVATE", "yes", true},
	} {
		key, value, ok := parseDotenvLine(tc.line)
		if ok != tc.ok || key != tc.key || value != tc.value {
			t.Fatalf("parseDotenvLine(%q) = (%q, %q, %v), want (%q, %q, %v)", tc.line, key, value, ok, tc.key, tc.value, tc.ok)
		}
	}
}

func TestLoadDotenv(t *testing.T) {
	root := t.TempDir()
	write := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write(".env", "SHARED=from-env\nONLY_ENV=yes\n# comment\n\n")
	write(".env.local", "SHARED=from-local\nONLY_LOCAL=yes\n")
	values := loadDotenv(root)
	if values["SHARED"] != "from-local" {
		t.Fatalf("SHARED = %q, want from-local (.env.local wins)", values["SHARED"])
	}
	if values["ONLY_ENV"] != "yes" || values["ONLY_LOCAL"] != "yes" {
		t.Fatalf("values = %v, want both files read", values)
	}
	if got := loadDotenv(t.TempDir()); len(got) != 0 {
		t.Fatalf("loadDotenv with no .env files = %v, want empty", got)
	}
}

func TestResolveEnv(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_PROC", "from-process")
	root := t.TempDir()
	write := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write(".env", "PORTO_LSP_TEST_PROC=from-env\nPORTO_LSP_TEST_SHARED=from-env\nPORTO_LSP_TEST_ONLY_ENV=yes\n")
	write(".env.local", "PORTO_LSP_TEST_SHARED=from-local\n")
	resolved := resolveEnv(root)
	for name, want := range map[string]envValue{
		"PORTO_LSP_TEST_PROC":     {value: "from-process", source: ""},
		"PORTO_LSP_TEST_SHARED":   {value: "from-local", source: ".env.local"},
		"PORTO_LSP_TEST_ONLY_ENV": {value: "yes", source: ".env"},
	} {
		got, ok := resolved[name]
		if !ok || got != want {
			t.Fatalf("resolveEnv[%q] = %+v, %v; want %+v, true", name, got, ok, want)
		}
	}
	if _, ok := resolved["PORTO_LSP_TEST_NOPE"]; ok {
		t.Fatal("resolveEnv has PORTO_LSP_TEST_NOPE, want it absent")
	}
}

func TestDefinedEnvNames(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_PROC", "x")
	t.Setenv("PORTO_LSP_TEST_EMPTY", "")
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("PORTO_LSP_TEST_FILE=1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	defined := definedEnvNames(root)
	for _, name := range []string{"PORTO_LSP_TEST_PROC", "PORTO_LSP_TEST_EMPTY", "PORTO_LSP_TEST_FILE"} {
		if !defined[name] {
			t.Fatalf("defined[%q] = false, want true", name)
		}
	}
	if defined["PORTO_LSP_TEST_NOPE"] {
		t.Fatalf("defined[PORTO_LSP_TEST_NOPE] = true, want false")
	}
}

func TestScanEnvExpr(t *testing.T) {
	for _, tc := range []struct {
		marked  string
		found   bool
		partial string
	}{
		{"{env.|", true, ""},
		{"{env.P|", true, "P"},
		{"{env.PORTO_|", true, "PORTO_"},
		{"{env.|}", true, ""},
		{"{ env.|", true, ""},
		{"text {env.P| more", true, "P"},
		{"{en|", false, ""},
		{"{env|", false, ""},
		{"{env.FOO.BAR|", false, ""},
		{"{env.FOO}|", false, ""},
		{"{env.FOO-BAR|", false, ""},
		{"{foo.|", false, ""},
		{"{vars.|", false, ""},
		{"{|", false, ""},
	} {
		text, pos := posAt(t, tc.marked)
		ctx := scanEnvExpr(text, pos)
		if ctx.found != tc.found {
			t.Fatalf("scanEnvExpr(%q): found = %v, want %v", tc.marked, ctx.found, tc.found)
		}
		if !tc.found {
			continue
		}
		if ctx.partial != tc.partial {
			t.Fatalf("scanEnvExpr(%q): partial = %q, want %q", tc.marked, ctx.partial, tc.partial)
		}
	}
}

func TestScanEnvExprNotAnExpression(t *testing.T) {
	for _, marked := range []string{
		"```\n{env.|}\n```\n",
		"---\ntitle: {env.|}\n---\n",
		"Use `{env.|}` here.",
		"<Btn label=\"{env.|}\">x</Btn>",
		"<Btn href={env.|}>x</Btn>",
	} {
		text, pos := posAt(t, marked)
		ctx := scanEnvExpr(text, pos)
		if marked == "<Btn href={env.|}>x</Btn>" {
			// An expression prop value IS an expression.
			if !ctx.found {
				t.Fatalf("scanEnvExpr(%q): not found, want an env expression", marked)
			}
			continue
		}
		if ctx.found {
			t.Fatalf("scanEnvExpr(%q): found %+v, want none", marked, ctx)
		}
	}
}

func envCompletionFixture(t *testing.T) string {
	t.Helper()
	return contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		".env":       "PORTO_LSP_TEST_DOTENV=from-dotenv\nPORTO_LSP_TEST_BOTH=from-dotenv\n",
		".env.local": "PORTO_LSP_TEST_LOCAL=from-local\n",
	})
}

func TestEnvCompletionOffersProcessEnvAndDotenv(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_PROC", "from-process")
	s := startTestServer(t, envCompletionFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{env.PORTO_LSP_TEST_")
	items := s.complete(t, documentURI, 2, 20)
	want := []string{"PORTO_LSP_TEST_BOTH", "PORTO_LSP_TEST_DOTENV", "PORTO_LSP_TEST_LOCAL", "PORTO_LSP_TEST_PROC"}
	if len(items) != len(want) {
		t.Fatalf("completions = %v, want %v", labels(items), want)
	}
	for i, label := range want {
		if items[i].Label != label {
			t.Fatalf("completions = %v, want %v in order", labels(items), want)
		}
	}
	if text, ok := editText(items, "PORTO_LSP_TEST_DOTENV"); !ok || text != "PORTO_LSP_TEST_DOTENV" {
		t.Fatalf("DOTENV edit = %q, want PORTO_LSP_TEST_DOTENV", text)
	}
}

func TestEnvCompletionNameInBothAppearsOnce(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_BOTH", "from-process")
	s := startTestServer(t, envCompletionFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{env.PORTO_LSP_TEST_BOTH")
	items := s.complete(t, documentURI, 2, 24)
	if len(items) != 1 || items[0].Label != "PORTO_LSP_TEST_BOTH" {
		t.Fatalf("completions = %v, want only PORTO_LSP_TEST_BOTH once", labels(items))
	}
	detail, ok := items[0].Detail.Get()
	if !ok || detail != "system environment" {
		t.Fatalf("BOTH detail = %q, want system environment (the process env wins)", detail)
	}
}

func TestEnvCompletionFiltersByPartial(t *testing.T) {
	s := startTestServer(t, envCompletionFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{env.PORTO_LSP_TEST_D")
	items := s.complete(t, documentURI, 2, 21)
	if len(items) != 1 || items[0].Label != "PORTO_LSP_TEST_DOTENV" {
		t.Fatalf("completions = %v, want only PORTO_LSP_TEST_DOTENV", labels(items))
	}
}

func TestEnvCompletionOutsideEnvContext(t *testing.T) {
	s := startTestServer(t, envCompletionFixture(t))
	for _, tc := range []struct {
		file string
		text string
		char uint32
	}{
		{"page-a.mdx", "# Page\n\nsome text", 9},
		{"page-b.mdx", "# Page\n\n{foo.", 5},
	} {
		documentURI := s.open(t, filepath.Join(s.root, "docs", tc.file), tc.text)
		items := s.complete(t, documentURI, 2, tc.char)
		if len(items) != 0 {
			t.Fatalf("completions for %q = %v, want none", tc.text, labels(items))
		}
	}
}

func TestEnvCompletionDetailNamesSourceNotValue(t *testing.T) {
	t.Setenv("PORTO_LSP_TEST_PROC", "s3cr3t-proc-value")
	s := startTestServer(t, envCompletionFixture(t))
	documentURI := s.open(t, filepath.Join(s.root, "docs", "page.mdx"), "# Page\n\n{env.PORTO_LSP_TEST_")
	items := s.complete(t, documentURI, 2, 20)
	wantDetail := map[string]string{
		"PORTO_LSP_TEST_PROC":   "system environment",
		"PORTO_LSP_TEST_DOTENV": ".env",
		"PORTO_LSP_TEST_LOCAL":  ".env.local",
		"PORTO_LSP_TEST_BOTH":   ".env",
	}
	for _, item := range items {
		detail, ok := item.Detail.Get()
		if !ok || detail == "" {
			t.Fatalf("item %q has no detail", item.Label)
		}
		if strings.Contains(detail, "s3cr3t-proc-value") || strings.Contains(detail, "from-dotenv") || strings.Contains(detail, "from-local") {
			t.Fatalf("item %q detail = %q, want a source name, never a value", item.Label, detail)
		}
		if want, known := wantDetail[item.Label]; known && detail != want {
			t.Fatalf("item %q detail = %q, want %q", item.Label, detail, want)
		}
	}
}
