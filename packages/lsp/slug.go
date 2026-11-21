package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// The site's slug algorithm, ported from core `lib/slug.ts` and
// `lib/slug-server.ts` so link targets resolve to the same URLs
// the loader builds: number prefixes stripped (including dotted
// ones), README/index files collapsing to their folder, a
// frontmatter `slug` overriding the path, and parent index slugs
// inherited down the tree. Keep this in sync with those files.

// Number prefixes stripped from file and directory names: `1 -
// x`, `4.1 - x`, `2. x`.
var numberPrefixPattern = regexp.MustCompile(`^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)`)

// cleanSegment strips a number prefix from one path segment and
// slugifies it.
func cleanSegment(segment string) string {
	stripped := numberPrefixPattern.ReplaceAllString(segment, "")
	lower := strings.ToLower(stripped)
	var b strings.Builder
	lastDash := false
	for _, r := range lower {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
		} else if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

// isIndexBase reports whether a file base name (no extension)
// marks an index file.
func isIndexBase(base string) bool {
	lower := strings.ToLower(base)
	return lower == "index" || lower == "readme"
}

// posixResolve joins URL-style path parts, normalizing `.` and
// `..` (a `..` past the root is dropped), and returns an
// absolute path with a leading `/`.
func posixResolve(parts ...string) string {
	var out []string
	for _, part := range parts {
		for _, segment := range strings.Split(part, "/") {
			if segment == "" || segment == "." {
				continue
			}
			if segment == ".." {
				if len(out) > 0 {
					out = out[:len(out)-1]
				}
				continue
			}
			out = append(out, segment)
		}
	}
	return "/" + strings.Join(out, "/")
}

// computeSlug is the shared slug algorithm. segments are the
// path parts relative to the content root (last part is the file
// name with extension). resolveParentSlug returns the custom slug
// of the index file in the directory given by dirSegments, or "".
// It returns the slug with a leading `/`.
// posixExtname is the substring from the last `.` (inclusive),
// or "" when there is no extension (a leading dot does not
// start one).
func posixExtname(filename string) string {
	dot := strings.LastIndex(filename, ".")
	if dot <= 0 {
		return ""
	}
	return filename[dot:]
}

func computeSlug(segments []string, frontMatter map[string]any, resolveParentSlug func([]string) string) string {
	filename := segments[len(segments)-1]
	ext := posixExtname(filename)
	base := strings.TrimSuffix(filename, ext)
	isIndexFile := isIndexBase(base)

	currentRoutePath := "/"

	// Resolve directories up to grandparent for index files,
	// otherwise parent.
	dirLimit := len(segments) - 1
	if isIndexFile {
		dirLimit = len(segments) - 2
	}
	for i := 0; i < dirLimit; i++ {
		dirSegments := segments[:i+1]
		resolvedSlug := resolveParentSlug(dirSegments)
		if resolvedSlug != "" {
			if strings.HasPrefix(resolvedSlug, "/") {
				currentRoutePath = resolvedSlug
			} else {
				currentRoutePath = posixResolve(currentRoutePath, resolvedSlug)
			}
		} else {
			currentRoutePath = posixResolve(currentRoutePath, cleanSegment(segments[i]))
		}
	}

	userSlug, _ := frontMatter["slug"].(string)
	var finalSlug string
	if isIndexFile {
		if userSlug != "" {
			if strings.HasPrefix(userSlug, "/") {
				finalSlug = userSlug
			} else {
				finalSlug = posixResolve(currentRoutePath, userSlug)
			}
		} else if len(segments) == 1 {
			finalSlug = currentRoutePath
		} else {
			finalSlug = posixResolve(currentRoutePath, cleanSegment(segments[len(segments)-2]))
		}
	} else if userSlug != "" {
		if strings.HasPrefix(userSlug, "/") {
			finalSlug = userSlug
		} else {
			finalSlug = posixResolve(currentRoutePath, userSlug)
		}
	} else {
		finalSlug = posixResolve(currentRoutePath, cleanSegment(base))
	}
	return finalSlug
}

// guessDocPermalink computes a doc permalink from a
// content-relative file path, using the Docusaurus slug
// algorithm. parentSlugs holds custom slugs of parent index
// files, keyed by directory path relative to the content root
// (e.g. {"guide": "/manual"}). It returns the slug with no
// leading slash.
func guessDocPermalink(filePath string, frontMatter map[string]any, parentSlugs map[string]string) string {
	cleanPath := strings.TrimPrefix(filePath, "./")
	var segments []string
	for _, segment := range strings.Split(cleanPath, "/") {
		if segment != "" {
			segments = append(segments, segment)
		}
	}
	if len(segments) == 0 {
		return ""
	}
	slug := computeSlug(segments, frontMatter, func(dirSegments []string) string {
		return parentSlugs[strings.Join(dirSegments, "/")]
	})
	return strings.TrimPrefix(slug, "/")
}

// Index file names, in the order their slugs are preferred.
var indexNames = []string{"index.mdx", "index.md", "README.mdx", "README.md"}

// readFileFrontmatter parses the frontmatter of a file on disk,
// or nil when the file has none (or cannot be read).
func readFileFrontmatter(filePath string) map[string]any {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}
	block, ok := extractFrontmatter(string(raw))
	if !ok || !block.closed {
		return nil
	}
	rootNode, err := parseYAML(block.yaml)
	if err != nil || rootNode == nil {
		return nil
	}
	var fm map[string]any
	if err := rootNode.Decode(&fm); err != nil {
		return nil
	}
	return fm
}

// collectParentSlugs returns the custom slugs of the index files
// in a file's ancestor directories, keyed by directory path
// relative to the content root. absolutePath is the file's path
// on disk; contentPath is its content-relative path with `/`
// separators.
func collectParentSlugs(absolutePath, contentPath string) map[string]string {
	return collectParentSlugsWithReader(absolutePath, contentPath, readFileFrontmatter)
}

// collectParentSlugsWithReader is collectParentSlugs with the
// frontmatter source supplied by the caller: the rename handler
// reads through the rename, since the file still sits at its
// old path on disk.
func collectParentSlugsWithReader(absolutePath, contentPath string, read func(string) map[string]any) map[string]string {
	parentSlugs := map[string]string{}
	var dirSegments []string
	for _, segment := range strings.Split(contentPath, "/") {
		if segment != "" {
			dirSegments = append(dirSegments, segment)
		}
	}
	if len(dirSegments) > 0 {
		dirSegments = dirSegments[:len(dirSegments)-1]
	}
	fileDir := filepath.Dir(absolutePath)
	for i := 1; i <= len(dirSegments); i++ {
		dirKey := strings.Join(dirSegments[:i], "/")
		up := len(dirSegments) - i
		dirPath := fileDir
		for j := 0; j < up; j++ {
			dirPath = filepath.Dir(dirPath)
		}
		for _, name := range indexNames {
			fm := read(filepath.Join(dirPath, name))
			if fm == nil {
				continue
			}
			if slug, ok := fm["slug"].(string); ok && slug != "" {
				parentSlugs[dirKey] = slug
				break
			}
		}
	}
	return parentSlugs
}
