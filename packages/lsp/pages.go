package main

import (
	"io/fs"
	"path/filepath"
	"strings"
	"sync"
)

// The page index: every content file in a project, mapped from
// its clean URL to its path on disk. Go-to-definition and link
// completion both resolve through it. One index per project,
// built lazily and invalidated when an MDX file in the project
// is opened, changed, or closed.

// pageIndex maps clean URLs (with a trailing slash) to absolute
// file paths.
type pageIndex struct {
	byURL map[string]string
}

// pageIndexCache holds one index per project root.
type pageIndexCache struct {
	mu      sync.Mutex
	indexes map[string]*pageIndex
}

func newPageIndexCache() *pageIndexCache {
	return &pageIndexCache{indexes: map[string]*pageIndex{}}
}

// forRoot returns the cached index for a project, building it on
// first use.
func (c *pageIndexCache) forRoot(root string) *pageIndex {
	c.mu.Lock()
	defer c.mu.Unlock()
	index, ok := c.indexes[root]
	if !ok {
		index = buildPageIndex(root)
		c.indexes[root] = index
	}
	return index
}

// invalidate drops the cached index for a project, so the next
// lookup rebuilds it.
func (c *pageIndexCache) invalidate(root string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.indexes, root)
}

// isContentFile reports whether a path on disk is a content
// file the site loads: `.md` or `.mdx`.
func isContentFile(path string) bool {
	return strings.HasSuffix(path, ".mdx") || strings.HasSuffix(path, ".md")
}

// buildPageIndex walks the project's content dirs and computes
// each file's URL with the site's slug rules.
func buildPageIndex(root string) *pageIndex {
	index := &pageIndex{byURL: map[string]string{}}
	cfg := loadProjectConfig(root)
	for _, content := range projectContentDirs(root, cfg) {
		_ = filepath.WalkDir(content.dir, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if entry.IsDir() {
				if strings.HasPrefix(entry.Name(), ".") {
					return filepath.SkipDir
				}
				return nil
			}
			if !isContentFile(path) {
				return nil
			}
			rel, err := filepath.Rel(content.dir, path)
			if err != nil {
				return nil
			}
			contentPath := filepath.ToSlash(rel)
			fm := readFileFrontmatter(path)
			slug := guessDocPermalink(contentPath, fm, collectParentSlugs(path, contentPath))
			url := "/" + content.route + "/" + slug + "/"
			if slug == "" {
				url = "/" + content.route + "/"
			}
			index.byURL[url] = path
			return nil
		})
	}
	return index
}

// lookup resolves a clean URL to the file it serves, accepting
// the URL with or without a trailing slash.
func (index *pageIndex) lookup(url string) (string, bool) {
	url = strings.TrimSuffix(url, "/") + "/"
	file, ok := index.byURL[url]
	return file, ok
}
