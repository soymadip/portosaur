package main

import (
	"os"
	"path/filepath"
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
