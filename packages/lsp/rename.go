package main

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// Renaming a page file: `workspace/willRenameFiles` updates the
// links that point at it. The request arrives BEFORE the rename
// happens — the old tree is still on disk — and the client
// applies the returned edits before renaming, so edits to the
// moved file itself are keyed by its OLD URI. Clean-URL
// destinations pointing at the renamed file are rewritten to
// the URL the new path serves (the `#hash` kept), and the
// relative Link/Btn props inside the moved file are recomputed
// from its new location. Relative markdown links are left
// alone: the MDX language server rewrites those, and two
// servers editing one range would conflict.

// WillRenameFiles answers workspace/willRenameFiles: the
// clean-URL destinations naming a renamed page, across every
// content file in the project, plus the relative Link/Btn props
// inside the moved file itself. Nothing to update means a null
// result.
func (s *Server) WillRenameFiles(_ context.Context, params *protocol.RenameFilesParams) (*protocol.WorkspaceEdit, error) {
	byRoot := map[string][]fileRename{}
	for _, file := range params.Files {
		oldURI, err := uri.Parse(file.OldURI)
		if err != nil {
			continue
		}
		newURI, err := uri.Parse(file.NewURI)
		if err != nil {
			continue
		}
		root, ok := s.projectFor(oldURI)
		if !ok {
			continue
		}
		byRoot[root] = append(byRoot[root], fileRename{oldPath: fsPath(oldURI), newPath: fsPath(newURI)})
	}
	changes := map[uri.URI][]protocol.TextEdit{}
	for root, renames := range byRoot {
		for documentURI, edits := range s.renameEdits(root, renames) {
			changes[documentURI] = append(changes[documentURI], edits...)
		}
	}
	if len(changes) == 0 {
		return nil, nil
	}
	return &protocol.WorkspaceEdit{Changes: changes}, nil
}

// DidRenameFiles answers workspace/didRenameFiles: the rename
// has happened, so the cached page index is stale — drop it and
// let the next lookup rebuild from the new tree. Invalidating
// in WillRenameFiles would be useless: that request arrives
// before the rename, so the rebuild would read the same old
// tree. The old URI names the project when the file moved
// within it or out of it; the new URI covers a file moved into
// a project from outside. The content-file gate in
// invalidatePages does not fit here — a folder rename names no
// content file — so the handler resolves the root and drops the
// index through the same pages.invalidate call. A rename
// outside any known project is a no-op.
func (s *Server) DidRenameFiles(_ context.Context, params *protocol.RenameFilesParams) error {
	for _, file := range params.Files {
		oldURI, err := uri.Parse(file.OldURI)
		if err != nil {
			continue
		}
		if root, ok := s.projectFor(oldURI); ok {
			s.pages.invalidate(root)
			continue
		}
		newURI, err := uri.Parse(file.NewURI)
		if err != nil {
			continue
		}
		if root, ok := s.projectFor(newURI); ok {
			s.pages.invalidate(root)
		}
	}
	return nil
}

// fileRename is one rename in the request, as filesystem paths.
type fileRename struct {
	oldPath string
	newPath string
}

// renamePlan is the per-project picture of a rename request:
// which content files move and which clean URLs change.
type renamePlan struct {
	index     *pageIndex
	renames   []fileRename
	moved     map[string]string // old file path -> new file path
	urlChange map[string]string // old clean URL -> new clean URL, both with a trailing slash
}

// renameEdits computes the edits for one project's renames:
// every content file is scanned for clean-URL destinations
// naming a moved page, and each moved file is scanned for
// relative Link/Btn props to recompute. File text comes from
// the document store when the file is open, from disk
// otherwise.
func (s *Server) renameEdits(root string, renames []fileRename) map[uri.URI][]protocol.TextEdit {
	plan := newRenamePlan(root, s.pages.forRoot(root), renames)
	edits := map[uri.URI][]protocol.TextEdit{}
	if len(plan.urlChange) == 0 && len(plan.moved) == 0 {
		return edits
	}
	for file := range plan.index.byFile {
		text := s.targetText(file)
		changed := plan.fileEdits(file, text)
		if len(changed) == 0 {
			continue
		}
		lines := strings.Split(text, "\n")
		var textEdits []protocol.TextEdit
		for _, edit := range changed {
			textEdits = append(textEdits, protocol.TextEdit{
				Range:   rangeFromOffsets(lines, edit.start, edit.end),
				NewText: edit.newText,
			})
		}
		edits[uri.File(file)] = textEdits
	}
	return edits
}

// newRenamePlan works out which content files move and which
// clean URLs change. A file rename moves one file; a directory
// rename moves every page under it. The new URL is computed
// from the new path with the site's slug rules, reading
// frontmatter through the rename (the file still sits at its
// old path on disk).
func newRenamePlan(root string, index *pageIndex, renames []fileRename) *renamePlan {
	plan := &renamePlan{index: index, renames: renames, moved: map[string]string{}, urlChange: map[string]string{}}
	for _, rename := range renames {
		for file := range index.byFile {
			if moved, ok := translatePath(file, rename.oldPath, rename.newPath); ok {
				plan.moved[file] = moved
			}
		}
	}
	read := func(path string) map[string]any {
		return readFileFrontmatter(plan.translateBack(path))
	}
	for oldFile, newFile := range plan.moved {
		oldURL, ok := index.urlFor(oldFile)
		if !ok {
			continue
		}
		if len(index.filesAt(oldURL)) != 1 {
			// Another page still serves this URL after the
			// rename, so links to it still resolve: leave them.
			continue
		}
		newURL, ok := urlForNewPath(root, newFile, read)
		if !ok || newURL == oldURL {
			continue
		}
		plan.urlChange[oldURL] = newURL
	}
	return plan
}

// translatePath maps a path from one side of a rename to the
// other: when path is the renamed path itself or under it, the
// corresponding path on the other side; otherwise unchanged.
// It serves both directions: old to new, and new to old.
func translatePath(path, from, to string) (string, bool) {
	if path == from {
		return to, true
	}
	rel, err := filepath.Rel(from, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	return filepath.Join(to, rel), true
}

// translateBack maps a path in the tree after the rename to
// where that file sits on disk right now: inside a renamed
// subtree, at the corresponding old path; anywhere else,
// unchanged. Frontmatter reads for the new URL go through it.
func (p *renamePlan) translateBack(path string) string {
	for _, rename := range p.renames {
		if old, ok := translatePath(path, rename.newPath, rename.oldPath); ok {
			return old
		}
	}
	return path
}

// translateForward maps a path in the tree before the rename
// to where it will sit after it: inside a renamed subtree, at
// the corresponding new path; anywhere else, unchanged.
// Relative-prop targets go through it, so a target that moves
// with the file still resolves.
func (p *renamePlan) translateForward(path string) string {
	for _, rename := range p.renames {
		if moved, ok := translatePath(path, rename.oldPath, rename.newPath); ok {
			return moved
		}
	}
	return path
}

// urlForNewPath computes the clean URL a path will serve after
// the rename, with the site's slug rules. The file does not sit
// at that path yet, so its frontmatter (and its parent index
// slugs) come from the read function, which the caller points
// at the file's current location. A path outside the content
// dirs serves no URL.
func urlForNewPath(root, newPath string, read func(string) map[string]any) (string, bool) {
	cfg := loadProjectConfig(root)
	for _, content := range projectContentDirs(root, cfg) {
		rel, err := filepath.Rel(content.dir, newPath)
		if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			continue
		}
		contentPath := filepath.ToSlash(rel)
		slug := guessDocPermalink(contentPath, read(newPath), collectParentSlugsWithReader(newPath, contentPath, read))
		if slug == "" {
			return "/" + content.route + "/", true
		}
		return "/" + content.route + "/" + slug + "/", true
	}
	return "", false
}

// renameEdit is one destination rewrite, as byte offsets in the
// file's text.
type renameEdit struct {
	start, end int
	newText    string
}

// fileEdits scans one file's text for destinations that change:
// clean URLs naming a moved page (in markdown links and Link/Btn
// props), and — when the file itself moved — relative Link/Btn
// props recomputed from its new location. Edits are sorted by
// position with overlaps dropped, so a markdown-looking
// destination inside a prop value never yields two edits for
// one range.
func (p *renamePlan) fileEdits(file, text string) []renameEdit {
	var edits []renameEdit
	for _, dest := range scanMarkdownLinks(text) {
		if newText, ok := p.rewrittenCleanURL(dest.value); ok {
			edits = append(edits, renameEdit{start: dest.start, end: dest.end, newText: newText})
		}
	}
	newFile, moved := p.moved[file]
	for _, tag := range scanAllTags(text) {
		if tag.name != "Link" && tag.name != "Btn" {
			continue
		}
		for _, prop := range tag.props {
			if !linkProps[prop.name] || !prop.hasValue || prop.expr {
				continue
			}
			value := text[prop.valueStart:prop.valueEnd]
			if newText, ok := p.rewrittenCleanURL(value); ok {
				edits = append(edits, renameEdit{start: prop.valueStart, end: prop.valueEnd, newText: newText})
				continue
			}
			if moved {
				if newText, ok := p.recomputedRelativeProp(file, newFile, value); ok {
					edits = append(edits, renameEdit{start: prop.valueStart, end: prop.valueEnd, newText: newText})
				}
			}
		}
	}
	sort.Slice(edits, func(i, j int) bool { return edits[i].start < edits[j].start })
	out := edits[:0]
	end := -1
	for _, edit := range edits {
		if edit.start < end {
			continue
		}
		out = append(out, edit)
		end = edit.end
	}
	return out
}

// rewrittenCleanURL rewrites a clean-URL destination that names
// a moved page: the new URL, with the author's trailing slash
// and `#hash` kept as they were. Anything else is not a clean
// URL to a moved page.
func (p *renamePlan) rewrittenCleanURL(value string) (string, bool) {
	path, hash, hasHash := strings.Cut(value, "#")
	if !strings.HasPrefix(path, "/") {
		return "", false
	}
	newURL, ok := p.urlChange[strings.TrimSuffix(path, "/")+"/"]
	if !ok {
		return "", false
	}
	if !strings.HasSuffix(path, "/") {
		newURL = strings.TrimSuffix(newURL, "/")
	}
	if hasHash {
		newURL += "#" + hash
	}
	return newURL, true
}

// recomputedRelativeProp recomputes a relative Link/Btn prop
// path from the moved file's new location to the same target
// file. The target may itself have moved with the rename, so
// it is translated first. The `#hash` and the author's encoding
// (literal or `%20`) are kept, and the result keeps a `./` or
// `../` prefix so it still reads as a relative link. A path
// that does not resolve to a content file is left alone.
func (p *renamePlan) recomputedRelativeProp(oldFile, newFile, value string) (string, bool) {
	path, hash, hasHash := strings.Cut(value, "#")
	if !strings.HasPrefix(path, ".") {
		return "", false
	}
	decoded, err := url.PathUnescape(path)
	if err != nil {
		decoded = path
	}
	target := filepath.Join(filepath.Dir(oldFile), decoded)
	if !isContentFile(target) {
		return "", false
	}
	if _, err := os.Stat(target); err != nil {
		return "", false
	}
	rel, err := filepath.Rel(filepath.Dir(newFile), p.translateForward(target))
	if err != nil {
		return "", false
	}
	rel = filepath.ToSlash(rel)
	if !strings.HasPrefix(rel, ".") {
		rel = "./" + rel
	}
	if strings.Contains(path, "%") {
		segments := strings.Split(rel, "/")
		for i, segment := range segments {
			if segment != "." && segment != ".." {
				segments[i] = encodePathSegment(segment)
			}
		}
		rel = strings.Join(segments, "/")
	}
	if hasHash {
		rel += "#" + hash
	}
	if rel == value {
		return "", false
	}
	return rel, true
}
