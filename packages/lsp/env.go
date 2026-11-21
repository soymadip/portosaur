package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Environment variables for `{env.VAR}` references: the build
// resolves them from its process environment with the project's
// `.env` files loaded on top, so the server counts a var as
// defined when it is set in either place. The server sees its
// own process environment (inherited from the editor), which can
// differ from the build's environment.

// dotenvFiles are the `.env` files the build can see at the
// project root, in increasing precedence order: later files
// override earlier ones for values, matching Next (`.env.local`
// wins). Only the names matter for the missing-var check.
var dotenvFiles = []string{".env", ".env.development", ".env.production", ".env.test", ".env.local"}

// envNameRe matches a valid env var name: no dots.
var envNameRe = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// eachDotenvEntry calls fn for every KEY=VALUE line in the
// project's `.env` files, in increasing precedence order, so
// later files override earlier ones.
func eachDotenvEntry(root string, fn func(file, key, value string)) {
	for _, name := range dotenvFiles {
		raw, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(raw), "\n") {
			if key, value, ok := parseDotenvLine(line); ok {
				fn(name, key, value)
			}
		}
	}
}

// loadDotenv reads the project's `.env` files into one
// name-to-value map. Missing or unreadable files are skipped.
func loadDotenv(root string) map[string]string {
	values := map[string]string{}
	eachDotenvEntry(root, func(_, key, value string) {
		values[key] = value
	})
	return values
}

// envValue is one env var the build can see: its value, and
// where it came from. source is empty for the system
// environment, otherwise the `.env` file name.
type envValue struct {
	value  string
	source string
}

// resolveEnv returns every env var the build can see, with its
// value and where it came from. A var set in the process
// environment wins over the `.env` files, matching Next; among
// the `.env` files the last in precedence order wins. A var set
// to "" counts as resolved.
func resolveEnv(root string) map[string]envValue {
	resolved := map[string]envValue{}
	eachDotenvEntry(root, func(file, key, value string) {
		resolved[key] = envValue{value: value, source: file}
	})
	for _, entry := range os.Environ() {
		if key, value, ok := strings.Cut(entry, "="); ok {
			resolved[key] = envValue{value: value}
		}
	}
	return resolved
}

// parseDotenvLine parses one `KEY=VALUE` line: blank lines and
// `#` comments are skipped, an optional `export ` prefix is
// stripped, and surrounding single or double quotes come off
// the value. A line without `=` or with an invalid key is not a
// definition.
func parseDotenvLine(line string) (string, string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return "", "", false
	}
	if rest, ok := strings.CutPrefix(trimmed, "export "); ok {
		trimmed = strings.TrimSpace(rest)
	} else if rest, ok := strings.CutPrefix(trimmed, "export\t"); ok {
		trimmed = strings.TrimSpace(rest)
	}
	key, value, ok := strings.Cut(trimmed, "=")
	if !ok {
		return "", "", false
	}
	key = strings.TrimSpace(key)
	if !envNameRe.MatchString(key) {
		return "", "", false
	}
	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
			value = value[1 : len(value)-1]
		}
	}
	return key, value, true
}

// definedEnvNames returns the env vars that count as defined:
// the server process environment plus the project's `.env`
// files. A var set to "" counts as defined.
func definedEnvNames(root string) map[string]bool {
	defined := map[string]bool{}
	for _, entry := range os.Environ() {
		if key, _, ok := strings.Cut(entry, "="); ok {
			defined[key] = true
		}
	}
	for key := range loadDotenv(root) {
		defined[key] = true
	}
	return defined
}
