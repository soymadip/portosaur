package main

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// renamePair builds one file rename from filesystem paths.
func renamePair(oldPath, newPath string) protocol.FileRename {
	return protocol.FileRename{OldURI: uri.File(oldPath).String(), NewURI: uri.File(newPath).String()}
}

// applyEdits applies text edits to a document, returning the
// result. Edits are applied from the end of the document
// backwards so earlier offsets stay valid.
func applyEdits(text string, edits []protocol.TextEdit) string {
	lines := strings.Split(text, "\n")
	sorted := make([]protocol.TextEdit, len(edits))
	copy(sorted, edits)
	sort.Slice(sorted, func(i, j int) bool {
		return positionToOffset(lines, sorted[i].Range.Start) > positionToOffset(lines, sorted[j].Range.Start)
	})
	for _, edit := range sorted {
		start := positionToOffset(lines, edit.Range.Start)
		end := positionToOffset(lines, edit.Range.End)
		text = text[:start] + edit.NewText + text[end:]
	}
	return text
}

func TestWillRenameFilesUpdatesCleanURLs(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/1 - getting-started/2 - installation.mdx": "# Installation\n\n## Setup\n",
		"docs/1 - getting-started/index.mdx":            "# Getting Started\n",
		"docs/sibling.mdx":                              "# Sibling\n",
		"docs/linker.mdx": "# Linker\n\n" +
			"[install](/docs/getting-started/installation/)\n\n" +
			"[sib](/docs/sibling/)\n\n" +
			"<Link to=\"/docs/getting-started/installation\">Install</Link>\n",
		"docs/other.mdx": "# Other\n\n<Btn to=\"/docs/getting-started/installation/\">Go</Btn>\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "1 - getting-started", "2 - installation.mdx"),
		filepath.Join(root, "docs", "1 - getting-started", "3 - setup.mdx"),
	))
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	if len(edit.Changes) != 2 {
		t.Fatalf("changed files = %d, want 2 (linker and other)", len(edit.Changes))
	}
	linker := filepath.Join(root, "docs", "linker.mdx")
	linkerEdits := edit.Changes[uri.File(linker)]
	if len(linkerEdits) != 2 {
		t.Fatalf("linker edits = %d, want 2 (the markdown link and the Link prop)", len(linkerEdits))
	}
	wantLinker := "# Linker\n\n" +
		"[install](/docs/getting-started/setup/)\n\n" +
		"[sib](/docs/sibling/)\n\n" +
		"<Link to=\"/docs/getting-started/setup\">Install</Link>\n"
	gotLinker := applyEdits("# Linker\n\n[install](/docs/getting-started/installation/)\n\n[sib](/docs/sibling/)\n\n<Link to=\"/docs/getting-started/installation\">Install</Link>\n", linkerEdits)
	if gotLinker != wantLinker {
		t.Fatalf("linker after edits = %q, want %q", gotLinker, wantLinker)
	}
	other := filepath.Join(root, "docs", "other.mdx")
	otherEdits := edit.Changes[uri.File(other)]
	if len(otherEdits) != 1 {
		t.Fatalf("other edits = %d, want 1 (the Btn prop)", len(otherEdits))
	}
	if got := applyEdits("# Other\n\n<Btn to=\"/docs/getting-started/installation/\">Go</Btn>\n", otherEdits); got != "# Other\n\n<Btn to=\"/docs/getting-started/setup/\">Go</Btn>\n" {
		t.Fatalf("other after edits = %q, want the Btn prop rewritten", got)
	}
}

func TestWillRenameFilesPreservesHash(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/sibling.mdx": "# Sibling\n\n## Section\n",
		"docs/linker.mdx":  "# Linker\n\n[a](/docs/sibling/#section)\n\n[b](/docs/sibling#section)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "sibling.mdx"),
		filepath.Join(root, "docs", "renamed.mdx"),
	))
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	linker := filepath.Join(root, "docs", "linker.mdx")
	edits := edit.Changes[uri.File(linker)]
	if len(edits) != 2 {
		t.Fatalf("linker edits = %d, want 2", len(edits))
	}
	want := "# Linker\n\n[a](/docs/renamed/#section)\n\n[b](/docs/renamed#section)\n"
	if got := applyEdits("# Linker\n\n[a](/docs/sibling/#section)\n\n[b](/docs/sibling#section)\n", edits); got != want {
		t.Fatalf("linker after edits = %q, want %q", got, want)
	}
}

func TestWillRenameFilesLeavesRelativeMarkdownLinks(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/1 - getting-started/2 - installation.mdx": "# Installation\n\n[sib](../sibling.mdx)\n",
		"docs/sibling.mdx": "# Sibling\n",
		"docs/linker.mdx": "# Linker\n\n" +
			"[inst](./1%20-%20getting-started/2%20-%20installation.mdx)\n\n" +
			"[sib](./sibling.mdx)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "1 - getting-started", "2 - installation.mdx"),
		filepath.Join(root, "docs", "1 - getting-started", "3 - setup.mdx"),
	))
	if edit != nil {
		t.Fatalf("willRenameFiles = %v, want nil (relative markdown links are the MDX server's job)", edit.Changes)
	}
}

func TestWillRenameFilesRecomputesRelativeProps(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/guide/a.mdx": "# A\n\n" +
			"<Link to=\"./b.mdx\">B</Link>\n\n" +
			"<Link to=\"../sibling.mdx\">Sib</Link>\n\n" +
			"<Link to=\"./b.mdx#part\">B part</Link>\n\n" +
			"<Link to=\"./my%20page.mdx\">My</Link>\n\n" +
			"[b](./b.mdx)\n",
		"docs/guide/b.mdx":       "# B\n",
		"docs/guide/my page.mdx": "# My Page\n",
		"docs/sibling.mdx":       "# Sibling\n",
		"docs/linker.mdx":        "# Linker\n\n[x](/docs/guide/a/)\n",
	})
	s := startTestServer(t, root)
	oldA := filepath.Join(root, "docs", "guide", "a.mdx")
	edit := s.willRenameFiles(t, renamePair(oldA, filepath.Join(root, "docs", "other", "a.mdx")))
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	if len(edit.Changes) != 2 {
		t.Fatalf("changed files = %d, want 2 (the moved file and the linker)", len(edit.Changes))
	}
	// Edits to the moved file are keyed by its OLD URI: the
	// client applies them before renaming.
	aEdits := edit.Changes[uri.File(oldA)]
	if len(aEdits) != 3 {
		t.Fatalf("moved file edits = %d, want 3 (the two ./b.mdx props and the encoded one)", len(aEdits))
	}
	wantA := "# A\n\n" +
		"<Link to=\"../guide/b.mdx\">B</Link>\n\n" +
		"<Link to=\"../sibling.mdx\">Sib</Link>\n\n" +
		"<Link to=\"../guide/b.mdx#part\">B part</Link>\n\n" +
		"<Link to=\"../guide/my%20page.mdx\">My</Link>\n\n" +
		"[b](./b.mdx)\n"
	gotA := applyEdits("# A\n\n<Link to=\"./b.mdx\">B</Link>\n\n<Link to=\"../sibling.mdx\">Sib</Link>\n\n<Link to=\"./b.mdx#part\">B part</Link>\n\n<Link to=\"./my%20page.mdx\">My</Link>\n\n[b](./b.mdx)\n", aEdits)
	if gotA != wantA {
		t.Fatalf("moved file after edits = %q, want %q", gotA, wantA)
	}
	linker := filepath.Join(root, "docs", "linker.mdx")
	linkerEdits := edit.Changes[uri.File(linker)]
	if len(linkerEdits) != 1 {
		t.Fatalf("linker edits = %d, want 1", len(linkerEdits))
	}
	if got := applyEdits("# Linker\n\n[x](/docs/guide/a/)\n", linkerEdits); got != "# Linker\n\n[x](/docs/other/a/)\n" {
		t.Fatalf("linker after edits = %q, want the URL rewritten to /docs/other/a/", got)
	}
}

func TestWillRenameFilesDirectory(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/guide/index.mdx": "# Guide\n",
		"docs/guide/a.mdx":     "# A\n\n<Link to=\"./b.mdx\">B</Link>\n\n<Link to=\"../sibling.mdx\">Sib</Link>\n",
		"docs/guide/b.mdx":     "# B\n\n[x](/docs/guide/a/)\n",
		"docs/sibling.mdx":     "# Sibling\n",
		"docs/linker.mdx":      "# Linker\n\n[g](/docs/guide/)\n\n[a](/docs/guide/a/)\n\n[b](/docs/guide/b/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "guide"),
		filepath.Join(root, "docs", "manual"),
	))
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	if len(edit.Changes) != 2 {
		t.Fatalf("changed files = %d, want 2 (linker and b)", len(edit.Changes))
	}
	linker := filepath.Join(root, "docs", "linker.mdx")
	linkerEdits := edit.Changes[uri.File(linker)]
	if len(linkerEdits) != 3 {
		t.Fatalf("linker edits = %d, want 3 (one per page under the renamed folder)", len(linkerEdits))
	}
	wantLinker := "# Linker\n\n[g](/docs/manual/)\n\n[a](/docs/manual/a/)\n\n[b](/docs/manual/b/)\n"
	if got := applyEdits("# Linker\n\n[g](/docs/guide/)\n\n[a](/docs/guide/a/)\n\n[b](/docs/guide/b/)\n", linkerEdits); got != wantLinker {
		t.Fatalf("linker after edits = %q, want %q", got, wantLinker)
	}
	b := filepath.Join(root, "docs", "guide", "b.mdx")
	bEdits := edit.Changes[uri.File(b)]
	if len(bEdits) != 1 {
		t.Fatalf("b edits = %d, want 1 (its link to a, which moved with it)", len(bEdits))
	}
	if got := applyEdits("# B\n\n[x](/docs/guide/a/)\n", bEdits); got != "# B\n\n[x](/docs/manual/a/)\n" {
		t.Fatalf("b after edits = %q, want the link rewritten to /docs/manual/a/", got)
	}
	if _, ok := edit.Changes[uri.File(filepath.Join(root, "docs", "guide", "a.mdx"))]; ok {
		t.Fatal("a.mdx has edits, want none (its relative props still resolve after the move)")
	}
}

func TestWillRenameFilesOutsideContentDirs(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/sibling.mdx": "# Sibling\n",
		"docs/linker.mdx":  "# Linker\n\n[s](/docs/sibling/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "sibling.mdx"),
		filepath.Join(root, "notes", "sibling.mdx"),
	))
	if edit != nil {
		t.Fatalf("willRenameFiles = %v, want nil (the page has no new URL outside the content dirs)", edit.Changes)
	}
}

func TestWillRenameFilesNonPage(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/notes.txt":   "plain text\n",
		"docs/sibling.mdx": "# Sibling\n",
		"docs/linker.mdx":  "# Linker\n\n[s](/docs/sibling/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "notes.txt"),
		filepath.Join(root, "docs", "memo.txt"),
	))
	if edit != nil {
		t.Fatalf("willRenameFiles = %v, want nil (a non-page rename moves no links)", edit.Changes)
	}
}

func TestWillRenameFilesMultiple(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/1 - getting-started/2 - installation.mdx": "# Installation\n",
		"docs/sibling.mdx": "# Sibling\n",
		"docs/linker.mdx":  "# Linker\n\n[i](/docs/getting-started/installation/)\n\n[s](/docs/sibling/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t,
		renamePair(
			filepath.Join(root, "docs", "1 - getting-started", "2 - installation.mdx"),
			filepath.Join(root, "docs", "1 - getting-started", "3 - setup.mdx"),
		),
		renamePair(
			filepath.Join(root, "docs", "sibling.mdx"),
			filepath.Join(root, "docs", "renamed.mdx"),
		),
	)
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	linker := filepath.Join(root, "docs", "linker.mdx")
	edits := edit.Changes[uri.File(linker)]
	if len(edits) != 2 {
		t.Fatalf("linker edits = %d, want 2 (one per renamed file)", len(edits))
	}
	want := "# Linker\n\n[i](/docs/getting-started/setup/)\n\n[s](/docs/renamed/)\n"
	if got := applyEdits("# Linker\n\n[i](/docs/getting-started/installation/)\n\n[s](/docs/sibling/)\n", edits); got != want {
		t.Fatalf("linker after edits = %q, want %q", got, want)
	}
}

func TestWillRenameFilesUsesOpenDocument(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/1 - getting-started/2 - installation.mdx": "# Installation\n",
		"docs/linker.mdx": "# Linker\n",
	})
	s := startTestServer(t, root)
	linker := filepath.Join(root, "docs", "linker.mdx")
	unsaved := "# Linker\n\n[install](/docs/getting-started/installation/)\n"
	s.open(t, linker, unsaved)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "1 - getting-started", "2 - installation.mdx"),
		filepath.Join(root, "docs", "1 - getting-started", "3 - setup.mdx"),
	))
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	edits := edit.Changes[uri.File(linker)]
	if len(edits) != 1 {
		t.Fatalf("linker edits = %d, want 1 (the link exists only in the unsaved text)", len(edits))
	}
	if got := applyEdits(unsaved, edits); got != "# Linker\n\n[install](/docs/getting-started/setup/)\n" {
		t.Fatalf("linker after edits = %q, want the unsaved link rewritten", got)
	}
}

func TestWillRenameFilesSlugOverrideTravels(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/old.mdx":    "---\nslug: custom\n---\n# Old\n",
		"docs/linker.mdx": "# Linker\n\n[o](/docs/custom/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "old.mdx"),
		filepath.Join(root, "docs", "sub", "old.mdx"),
	))
	if edit == nil {
		t.Fatal("willRenameFiles = nil, want edits")
	}
	linker := filepath.Join(root, "docs", "linker.mdx")
	edits := edit.Changes[uri.File(linker)]
	if len(edits) != 1 {
		t.Fatalf("linker edits = %d, want 1", len(edits))
	}
	if got := applyEdits("# Linker\n\n[o](/docs/custom/)\n", edits); got != "# Linker\n\n[o](/docs/sub/custom/)\n" {
		t.Fatalf("linker after edits = %q, want the slug override kept under the new parent", got)
	}
}

func TestWillRenameFilesDuplicateURLUntouched(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/dup.mdx":     "# Dup\n",
		"docs/1 - dup.mdx": "# Dup Too\n",
		"docs/linker.mdx":  "# Linker\n\n[d](/docs/dup/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "1 - dup.mdx"),
		filepath.Join(root, "docs", "other.mdx"),
	))
	if edit != nil {
		t.Fatalf("willRenameFiles = %v, want nil (the other page still serves /docs/dup/)", edit.Changes)
	}
}

func TestWillRenameFilesSluggedIndexDirRename(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/guide/index.mdx": "---\nslug: manual\n---\n# Guide\n",
		"docs/guide/a.mdx":     "# A\n",
		"docs/linker.mdx":      "# Linker\n\n[g](/docs/manual/)\n\n[a](/docs/manual/a/)\n",
	})
	s := startTestServer(t, root)
	edit := s.willRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "guide"),
		filepath.Join(root, "docs", "handbook"),
	))
	if edit != nil {
		t.Fatalf("willRenameFiles = %v, want nil (the slug travels with the index file, so no URL changes)", edit.Changes)
	}
}

func TestDidRenameFilesRefreshesPageIndex(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/a.mdx":      "# A\n",
		"docs/linker.mdx": "# Linker\n",
	})
	s := startTestServer(t, root)
	linker := filepath.Join(root, "docs", "linker.mdx")
	documentURI := s.open(t, linker, "# Linker\n\n[x](")
	// Warm the page index: the old URL is offered, the new one
	// is not a page yet.
	items := s.complete(t, documentURI, 2, 4)
	if !hasLabel(items, "/docs/a/") {
		t.Fatalf("completions = %v, want /docs/a/ (warming the index)", labels(items))
	}
	if err := os.Rename(filepath.Join(root, "docs", "a.mdx"), filepath.Join(root, "docs", "b.mdx")); err != nil {
		t.Fatal(err)
	}
	// Before the notification, the cached index is stale: the
	// old URL is still offered. This is the control — without
	// it, the test below could pass even if didRenameFiles did
	// nothing.
	items = s.complete(t, documentURI, 2, 4)
	if !hasLabel(items, "/docs/a/") {
		t.Fatalf("completions = %v, want /docs/a/ still (stale cache before the notification)", labels(items))
	}
	s.didRenameFiles(t, renamePair(
		filepath.Join(root, "docs", "a.mdx"),
		filepath.Join(root, "docs", "b.mdx"),
	))
	items = s.complete(t, documentURI, 2, 4)
	if !hasLabel(items, "/docs/b/") {
		t.Fatalf("completions = %v, want /docs/b/ after the rename", labels(items))
	}
	if hasLabel(items, "/docs/a/") {
		t.Fatalf("completions = %v, want no /docs/a/ after the rename", labels(items))
	}
}

func TestDidRenameFilesOutsideProjectIsNoop(t *testing.T) {
	root := contentFixture(t, "docs_home:\n  title: Docs\n", map[string]string{
		"docs/a.mdx":      "# A\n",
		"docs/linker.mdx": "# Linker\n",
	})
	s := startTestServer(t, root)
	linker := filepath.Join(root, "docs", "linker.mdx")
	documentURI := s.open(t, linker, "# Linker\n\n[x](")
	items := s.complete(t, documentURI, 2, 4)
	if !hasLabel(items, "/docs/a/") {
		t.Fatalf("completions = %v, want /docs/a/ (warming the index)", labels(items))
	}
	if err := os.Rename(filepath.Join(root, "docs", "a.mdx"), filepath.Join(root, "docs", "b.mdx")); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	s.didRenameFiles(t,
		renamePair(filepath.Join(outside, "x.mdx"), filepath.Join(outside, "y.mdx")),
		protocol.FileRename{OldURI: "://bad", NewURI: "://bad"},
	)
	// The outside rename changed nothing: the index is still the
	// warm, stale one, and nothing crashed.
	items = s.complete(t, documentURI, 2, 4)
	if !hasLabel(items, "/docs/a/") {
		t.Fatalf("completions = %v, want /docs/a/ still (outside rename must not invalidate)", labels(items))
	}
	if hasLabel(items, "/docs/b/") {
		t.Fatalf("completions = %v, want no /docs/b/ (outside rename must not invalidate)", labels(items))
	}
}
