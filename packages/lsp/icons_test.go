package main

import (
	"strings"
	"testing"
)

func TestValidateIconID(t *testing.T) {
	for _, tc := range []struct {
		value string
		want  string // "" means fine, otherwise a substring of the warning
	}{
		{"lu:star", ""},
		{"lucide:star", ""},
		{"fa:font", ""},
		{"fa7-solid:font", ""},
		{"si:react", ""},
		{"lu:maximize-2", ""},
		{"", ""},
		{"<svg viewBox=\"0 0 24 24\">", ""},
		{"/img/logo.png", ""},
		{"./logo.svg", ""},
		{"https://example.com/logo.png", ""},
		{"🚀", ""},
		{"🧙", ""},
		{"react", ""},
		{"Python", ""},
		{"getting-started", ""},
		{"xx:star", "Unknown icon prefix"},
		{"foo:bar", "Unknown icon prefix"},
		{":star", "Unknown icon prefix"},
		{"lu:", "Malformed icon id"},
		{"lu:a:b", "Malformed icon id"},
		{"star", "Malformed icon id"},
		{"not-an-icon", "Malformed icon id"},
	} {
		got := validateIconID(tc.value)
		if tc.want == "" {
			if got != "" {
				t.Fatalf("validateIconID(%q) = %q, want no warning", tc.value, got)
			}
			continue
		}
		if !strings.Contains(got, tc.want) {
			t.Fatalf("validateIconID(%q) = %q, want it to contain %q", tc.value, got, tc.want)
		}
	}
}
