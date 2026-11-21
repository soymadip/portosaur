package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCleanSegment(t *testing.T) {
	for _, tc := range []struct {
		in, want string
	}{
		{"1 - getting-started", "getting-started"},
		{"4.1 - installation", "installation"},
		{"2. config", "config"},
		{"10 - advanced topics", "advanced-topics"},
		{"plain", "plain"},
		{"Hello World", "hello-world"},
		{"under_score", "under-score"},
		{"a--b", "a-b"},
		{"-trim-", "trim"},
		{"caf\xc3\xa9", "caf"},
	} {
		if got := cleanSegment(tc.in); got != tc.want {
			t.Fatalf("cleanSegment(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestGuessDocPermalink(t *testing.T) {
	noParents := map[string]string{}
	for _, tc := range []struct {
		name        string
		filePath    string
		frontMatter map[string]any
		parents     map[string]string
		want        string
	}{
		{"plain page", "getting-started.mdx", nil, noParents, "getting-started"},
		{"numbered file", "1 - intro.mdx", nil, noParents, "intro"},
		{"dotted number", "4.1 - install.mdx", nil, noParents, "install"},
		{"nested", "1 - getting-started/2 - installation.mdx", nil, noParents, "getting-started/installation"},
		{"root index", "index.mdx", nil, noParents, ""},
		{"root readme", "README.mdx", nil, noParents, ""},
		{"folder index", "1 - getting-started/index.mdx", nil, noParents, "getting-started"},
		{"folder readme", "1 - getting-started/README.mdx", nil, noParents, "getting-started"},
		{"deep index", "a/b/index.mdx", nil, noParents, "a/b"},
		{"absolute slug", "old.mdx", map[string]any{"slug": "/new-home"}, noParents, "new-home"},
		{"relative slug", "guide/page.mdx", map[string]any{"slug": "renamed"}, noParents, "guide/renamed"},
		{"index slug", "guide/index.mdx", map[string]any{"slug": "/manual"}, noParents, "manual"},
		{"parent slug", "guide/page.mdx", nil, map[string]string{"guide": "/manual"}, "manual/page"},
		{"parent slug relative", "guide/page.mdx", nil, map[string]string{"guide": "manual"}, "manual/page"},
		{"parent slug deeper", "a/b/page.mdx", nil, map[string]string{"a": "/x", "a/b": "/y"}, "y/page"},
		{"dot-slash prefix", "./guide/page.mdx", nil, noParents, "guide/page"},
	} {
		if got := guessDocPermalink(tc.filePath, tc.frontMatter, tc.parents); got != tc.want {
			t.Fatalf("%s: guessDocPermalink(%q) = %q, want %q", tc.name, tc.filePath, got, tc.want)
		}
	}
}

func TestCollectParentSlugs(t *testing.T) {
	root := t.TempDir()
	guide := filepath.Join(root, "guide")
	if err := os.MkdirAll(guide, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(guide, "index.mdx"), []byte("---\nslug: /manual\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.mdx"), []byte("---\nslug: /home\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	page := filepath.Join(guide, "page.mdx")
	slugs := collectParentSlugs(page, "guide/page.mdx")
	if slugs["guide"] != "/manual" {
		t.Fatalf("parent slug for guide = %q, want /manual", slugs["guide"])
	}
	if len(slugs) != 1 {
		t.Fatalf("parent slugs = %v, want only guide", slugs)
	}
}

func TestCollectParentSlugsNoIndex(t *testing.T) {
	root := t.TempDir()
	guide := filepath.Join(root, "guide")
	if err := os.MkdirAll(guide, 0o755); err != nil {
		t.Fatal(err)
	}
	page := filepath.Join(guide, "page.mdx")
	if slugs := collectParentSlugs(page, "guide/page.mdx"); len(slugs) != 0 {
		t.Fatalf("parent slugs = %v, want none", slugs)
	}
}

func TestPosixResolve(t *testing.T) {
	for _, tc := range []struct {
		parts []string
		want  string
	}{
		{[]string{"/", "a"}, "/a"},
		{[]string{"/a", "b"}, "/a/b"},
		{[]string{"/a/b", "..", "c"}, "/a/c"},
		{[]string{"/", ".."}, "/"},
		{[]string{"/a", "./b"}, "/a/b"},
	} {
		if got := posixResolve(tc.parts...); got != tc.want {
			t.Fatalf("posixResolve(%v) = %q, want %q", tc.parts, got, tc.want)
		}
	}
}
