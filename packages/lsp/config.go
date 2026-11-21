package main

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// The project's porto.yml, read fresh when needed. The server
// does not serve porto.yml, but it reads it for the content
// directories, the routes, and the `vars:` map — a small file,
// so a fresh read is always correct and needs no cache.

// loadProjectConfig parses the project's porto.yml (or
// porto.yaml) into a plain map. It returns nil when the file is
// missing or unparsable; callers fall back to defaults.
func loadProjectConfig(root string) map[string]any {
	for _, name := range configFileNames {
		raw, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			continue
		}
		var cfg map[string]any
		if yaml.Unmarshal(raw, &cfg) != nil {
			return nil
		}
		if cfg == nil {
			return map[string]any{}
		}
		return cfg
	}
	return nil
}

// configString reads a dotted key from the config, falling back
// to the default when the key is missing or not a string.
func configString(cfg map[string]any, path []string, fallback string) string {
	node := cfg
	for i, segment := range path {
		if node == nil {
			return fallback
		}
		value, ok := node[segment]
		if !ok {
			return fallback
		}
		if i == len(path)-1 {
			if s, ok := value.(string); ok && s != "" {
				return s
			}
			return fallback
		}
		node, _ = value.(map[string]any)
	}
	return fallback
}

// configDocsMode reports whether the site is in docs mode: the
// CLI treats a project as docs mode when porto.yml has a
// `docs_home` key (siteConfig.ts).
func configDocsMode(cfg map[string]any) bool {
	value, ok := cfg["docs_home"]
	if !ok || value == nil {
		return false
	}
	if b, ok := value.(bool); ok {
		return b
	}
	if s, ok := value.(string); ok {
		return s != ""
	}
	return true
}

// contentDir is one content collection: the directory on disk
// and the URL section its pages serve under.
type contentDir struct {
	dir   string // absolute path
	route string // URL section, no slashes
}

// projectContentDirs returns the collections the site reads:
// the docs collection (mode-aware: the docs dir in docs mode,
// the notes dir in portfolio mode) and the blog collection.
// The keys and defaults match the config schema and
// siteConfig.ts.
func projectContentDirs(root string, cfg map[string]any) []contentDir {
	var docsDir, docsRoute string
	if configDocsMode(cfg) {
		docsDir = configString(cfg, []string{"site", "docs", "dir"}, "docs")
		docsRoute = configString(cfg, []string{"site", "docs", "route"}, "docs")
	} else {
		docsDir = configString(cfg, []string{"site", "notes", "dir"}, "notes")
		docsRoute = configString(cfg, []string{"site", "notes", "route"}, "notes")
	}
	return []contentDir{
		{dir: filepath.Join(root, docsDir), route: docsRoute},
		{dir: filepath.Join(root, configString(cfg, []string{"site", "blog", "dir"}, "blog")), route: configString(cfg, []string{"site", "blog", "route"}, "blog")},
	}
}
