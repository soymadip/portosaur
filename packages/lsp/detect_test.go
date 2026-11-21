package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFindProjectRoot(t *testing.T) {
	base := t.TempDir()
	site := filepath.Join(base, "docs", "site")
	if err := os.MkdirAll(filepath.Join(site, "pages"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(site, "porto.yml"), []byte("site:\n  title: x\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	detector := newProjectDetector("")
	root, ok := detector.findProjectRoot(filepath.Join(site, "pages", "index.mdx"))
	if !ok {
		t.Fatal("no project found")
	}
	if root != site {
		t.Fatalf("root = %q, want %q", root, site)
	}
}

func TestFindProjectRootYAML(t *testing.T) {
	base := t.TempDir()
	if err := os.WriteFile(filepath.Join(base, "porto.yaml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	detector := newProjectDetector("")
	if _, ok := detector.findProjectRoot(filepath.Join(base, "porto.yaml")); !ok {
		t.Fatal("porto.yaml was not detected")
	}
}

func TestFindProjectRootPackageJSON(t *testing.T) {
	base := t.TempDir()
	pkg := `{"dependencies": {"@portosaur/core": "^0.26.0"}}`
	if err := os.WriteFile(filepath.Join(base, "package.json"), []byte(pkg), 0o644); err != nil {
		t.Fatal(err)
	}
	detector := newProjectDetector("")
	root, ok := detector.findProjectRoot(filepath.Join(base, "docs", "index.mdx"))
	if !ok {
		t.Fatal("package.json marker was not detected")
	}
	if root != base {
		t.Fatalf("root = %q, want %q", root, base)
	}
}

func TestFindProjectRootIgnoresOtherPackages(t *testing.T) {
	base := t.TempDir()
	pkg := `{"dependencies": {"react": "^19.0.0"}}`
	if err := os.WriteFile(filepath.Join(base, "package.json"), []byte(pkg), 0o644); err != nil {
		t.Fatal(err)
	}
	detector := newProjectDetector("")
	if _, ok := detector.findProjectRoot(filepath.Join(base, "index.mdx")); ok {
		t.Fatal("a package.json without Portosaur counted as a project")
	}
}

func TestFindProjectRootStopsAtWorkspaceRoot(t *testing.T) {
	base := t.TempDir()
	if err := os.WriteFile(filepath.Join(base, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	workspace := filepath.Join(base, "child")
	if err := os.MkdirAll(workspace, 0o755); err != nil {
		t.Fatal(err)
	}
	detector := newProjectDetector(workspace)
	if _, ok := detector.findProjectRoot(filepath.Join(workspace, "index.mdx")); ok {
		t.Fatal("the walk passed the workspace root")
	}
}

func TestFindProjectRootNearestWins(t *testing.T) {
	base := t.TempDir()
	outer := filepath.Join(base, "outer")
	inner := filepath.Join(outer, "inner")
	if err := os.MkdirAll(inner, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outer, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(inner, "porto.yml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	detector := newProjectDetector("")
	root, ok := detector.findProjectRoot(filepath.Join(inner, "index.mdx"))
	if !ok {
		t.Fatal("no project found")
	}
	if root != inner {
		t.Fatalf("root = %q, want the nearer %q", root, inner)
	}
}
