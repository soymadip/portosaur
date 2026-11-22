package main

import (
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"go.lsp.dev/protocol"
)

// Path completion for links: inside a markdown link destination
// or a Link/Btn link prop value, the server offers page paths
// from the page index as clean URLs with a trailing slash. After
// a `#` it offers the target page's heading ids, and when the
// typed text starts with `.` it offers relative `.md`/`.mdx`
// file paths instead. The inserted name is `%20`-encoded in a
// plain destination, where a space would end it, and written
// as-is in an angle-bracket destination or a Link/Btn prop
// value. Relative candidates are limited to files inside the
// content dirs: a link anywhere else would be broken on the site.

// linkCompletion offers link destinations at the cursor. The
// second return value reports whether the cursor is on a link
// destination at all: when it is not, the caller falls through
// to component completion.
func (s *Server) linkCompletion(params *protocol.CompletionParams, text string, root string) (*protocol.CompletionList, bool) {
	link := linkAtCursor(text, params.Position)
	if !link.found {
		return nil, false
	}
	partial := link.partial
	if hash := strings.Index(partial, "#"); hash >= 0 {
		return s.headingCompletion(params, text, root, link, partial, hash), true
	}
	if strings.HasPrefix(partial, ".") {
		return s.relativeCompletion(params, root, link, partial), true
	}
	return s.pageCompletion(params, root, link, partial), true
}

// refLabelCompletion offers the document's reference labels
// inside the second bracket of `[text][|]` (or `![alt][|]`),
// filtered by the typed prefix, case-insensitively. The edit
// replaces the label text typed so far. The second return
// value reports whether the cursor is on a ref label at all.
func (s *Server) refLabelCompletion(params *protocol.CompletionParams, text string) (*protocol.CompletionList, bool) {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil, false
		}
		contentStart = block.endLine + 1
	}
	lineNo := int(params.Position.Line)
	if lineNo < contentStart || lineNo >= len(lines) {
		return nil, false
	}
	if fenceLines(lines, contentStart)[lineNo] {
		return nil, false
	}
	line := lines[lineNo]
	cursor := utf16ToByte(line, params.Position.Character)
	spans := codeSpanRanges(line)
	for i := 0; i < len(line); i++ {
		if line[i] != '[' || i == 0 || line[i-1] != ']' {
			continue
		}
		// The second bracket follows a `]` directly; the
		// first bracket opens the link text before it.
		if strings.LastIndex(line[:i-1], "[") < 0 {
			continue
		}
		if inCodeSpan(spans, i) {
			continue
		}
		labelStart := i + 1
		labelEnd := len(line)
		if close := strings.IndexByte(line[labelStart:], ']'); close >= 0 {
			labelEnd = labelStart + close
		}
		if cursor < labelStart || cursor > labelEnd {
			continue
		}
		partial := line[labelStart:cursor]
		lineOffset := positionToOffset(lines, protocol.Position{Line: uint32(lineNo)})
		editRange := rangeFromOffsets(lines, lineOffset+labelStart, lineOffset+labelEnd)
		var items []protocol.CompletionItem
		for _, def := range scanRefDefinitions(text) {
			if !strings.HasPrefix(strings.ToLower(def.label), strings.ToLower(partial)) {
				continue
			}
			items = append(items, protocol.CompletionItem{
				Label:    def.label,
				Kind:     protocol.CompletionItemKindReference,
				Detail:   protocol.NewOptional(def.dest),
				TextEdit: &protocol.TextEdit{Range: editRange, NewText: def.label},
			})
		}
		sort.Slice(items, func(a, b int) bool { return strings.ToLower(items[a].Label) < strings.ToLower(items[b].Label) })
		return &protocol.CompletionList{IsIncomplete: false, Items: items}, true
	}
	return nil, false
}

// pageCompletion offers clean URLs from the page index,
// filtered by the typed prefix.
func (s *Server) pageCompletion(params *protocol.CompletionParams, root string, link linkContext, partial string) *protocol.CompletionList {
	index := s.pages.forRoot(root)
	var items []protocol.CompletionItem
	for pageURL, files := range index.byURL {
		if !strings.HasPrefix(pageURL, partial) {
			continue
		}
		item := protocol.CompletionItem{
			Label:    pageURL,
			Kind:     protocol.CompletionItemKindFile,
			TextEdit: &protocol.TextEdit{Range: link.partialRange, NewText: pageURL},
		}
		if rel, err := filepath.Rel(root, files[0]); err == nil {
			item.Detail = protocol.NewOptional(filepath.ToSlash(rel))
		}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// headingCompletion offers the heading ids of the page the path
// before the `#` points at (the current file for a bare `#`).
// The edit replaces only the text after the `#`.
func (s *Server) headingCompletion(params *protocol.CompletionParams, text, root string, link linkContext, partial string, hash int) *protocol.CompletionList {
	target, ok := s.resolveLink(root, uriPath(params.TextDocument.URI), partial[:hash])
	if !ok {
		return &protocol.CompletionList{}
	}
	hashPartial := partial[hash+1:]
	lines := strings.Split(text, "\n")
	hashStart := positionToOffset(lines, link.partialRange.Start) + hash + 1
	editRange := protocol.Range{
		Start: offsetToPosition(lines, hashStart),
		End:   link.partialRange.End,
	}
	var items []protocol.CompletionItem
	for _, heading := range extractHeadings(s.targetText(target.file)) {
		if !strings.HasPrefix(heading.id, hashPartial) {
			continue
		}
		items = append(items, protocol.CompletionItem{
			Label:    heading.id,
			Kind:     protocol.CompletionItemKindValue,
			Detail:   protocol.NewOptional(heading.text),
			TextEdit: &protocol.TextEdit{Range: editRange, NewText: heading.id},
		})
	}
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// relativeCompletion offers relative `.md`/`.mdx` file paths
// for a partial starting with `.`. With no slash yet, the only
// candidates are `./` and `../`; after a slash, the files and
// subdirectories of the directory named so far.
func (s *Server) relativeCompletion(params *protocol.CompletionParams, root string, link linkContext, partial string) *protocol.CompletionList {
	slash := strings.LastIndex(partial, "/")
	if slash < 0 {
		var items []protocol.CompletionItem
		for _, candidate := range []string{"./", "../"} {
			if !strings.HasPrefix(candidate, partial) {
				continue
			}
			items = append(items, protocol.CompletionItem{
				Label:    candidate,
				Kind:     protocol.CompletionItemKindFolder,
				TextEdit: &protocol.TextEdit{Range: link.partialRange, NewText: candidate},
			})
		}
		return &protocol.CompletionList{IsIncomplete: false, Items: items}
	}
	dirPart := partial[:slash+1]
	filePartial := partial[slash+1:]
	// The inserted segment follows the destination form: a plain
	// markdown destination needs %20, while an angle-bracket
	// destination or a Link/Btn prop value takes the name as-is.
	encode := encodePathSegment
	if link.angled || link.jsx {
		encode = func(segment string) string { return segment }
	}
	// The typed path may already be percent-encoded: decode it
	// for the disk lookup and the prefix match, and keep the
	// typed form as the insert prefix.
	decodedDir, err := url.PathUnescape(dirPart)
	if err != nil {
		decodedDir = dirPart
	}
	decodedPartial, err := url.PathUnescape(filePartial)
	if err != nil {
		decodedPartial = filePartial
	}
	currentDir := filepath.Dir(uriPath(params.TextDocument.URI))
	dir := filepath.Join(currentDir, decodedDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return &protocol.CompletionList{}
	}
	files := s.pages.forRoot(root).fileSet()
	var items []protocol.CompletionItem
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || !strings.HasPrefix(name, decodedPartial) {
			continue
		}
		full := filepath.Join(dir, name)
		if entry.IsDir() {
			if !files.hasBelow(full) {
				continue
			}
			insert := dirPart + encode(name) + "/"
			items = append(items, protocol.CompletionItem{
				Label:    insert,
				Kind:     protocol.CompletionItemKindFolder,
				TextEdit: &protocol.TextEdit{Range: link.partialRange, NewText: insert},
			})
			continue
		}
		if !isContentFile(name) || !files.has(full) {
			continue
		}
		insert := dirPart + encode(name)
		items = append(items, protocol.CompletionItem{
			Label:    insert,
			Kind:     protocol.CompletionItemKindFile,
			TextEdit: &protocol.TextEdit{Range: link.partialRange, NewText: insert},
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// encodePathSegment percent-encodes one path segment for a
// link: spaces become %20, the form the file-links plugin
// accepts.
func encodePathSegment(segment string) string {
	return url.PathEscape(segment)
}

// pageFileSet is the set of files in a page index, for checking
// whether a relative link candidate is a content file.
type pageFileSet map[string]bool

func (index *pageIndex) fileSet() pageFileSet {
	files := pageFileSet{}
	for _, atURL := range index.byURL {
		for _, file := range atURL {
			files[file] = true
		}
	}
	return files
}

func (files pageFileSet) has(file string) bool {
	return files[file]
}

// hasBelow reports whether any file in the set lives under the
// given directory.
func (files pageFileSet) hasBelow(dir string) bool {
	prefix := dir + string(filepath.Separator)
	for file := range files {
		if strings.HasPrefix(file, prefix) {
			return true
		}
	}
	return false
}
