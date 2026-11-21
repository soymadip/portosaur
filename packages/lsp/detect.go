package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Project detection: a Portosaur project is a directory holding
// porto.yml (or porto.yaml). A package.json that depends on
// @portosaur/cli or @portosaur/core counts too, for projects whose
// config file is missing or not yet written. Detection is per
// document: the walk starts at the file's own directory, so a
// site inside a bigger workspace's docs/ or wiki/ dir is found,
// and several Portosaur sites can live in one workspace.

var configFileNames = []string{"porto.yml", "porto.yaml"}

type projectDetector struct {
	mu sync.Mutex
	// dir -> whether it is a project root. Negative results are
	// cached too; a porto.yml appearing mid-session is picked up
	// by a later server start, not this one.
	cache map[string]bool
	// Stop the walk here (the workspace root). "" walks to the
	// filesystem root, for lone files outside a workspace.
	limit string
}

func newProjectDetector(workspaceRoot string) *projectDetector {
	return &projectDetector{cache: map[string]bool{}, limit: workspaceRoot}
}

// findProjectRoot walks up from the file's directory for the
// nearest project marker.
func (d *projectDetector) findProjectRoot(filePath string) (string, bool) {
	dir := filepath.Dir(filePath)
	for {
		if d.isProjectRoot(dir) {
			return dir, true
		}
		if dir == d.limit || dir == filepath.Dir(dir) {
			return "", false
		}
		dir = filepath.Dir(dir)
	}
}

func (d *projectDetector) isProjectRoot(dir string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	if marked, ok := d.cache[dir]; ok {
		return marked
	}
	marked := false
	for _, name := range configFileNames {
		if info, err := os.Stat(filepath.Join(dir, name)); err == nil && !info.IsDir() {
			marked = true
			break
		}
	}
	if !marked {
		marked = packageDependsOnPortosaur(filepath.Join(dir, "package.json"))
	}
	d.cache[dir] = marked
	return marked
}

func packageDependsOnPortosaur(packageJSON string) bool {
	raw, err := os.ReadFile(packageJSON)
	if err != nil {
		return false
	}
	var pkg struct {
		Dependencies    map[string]string `json:"dependencies"`
		DevDependencies map[string]string `json:"devDependencies"`
	}
	if json.Unmarshal(raw, &pkg) != nil {
		return false
	}
	_, ok := pkg.Dependencies["@portosaur/cli"]
	if !ok {
		_, ok = pkg.Dependencies["@portosaur/core"]
	}
	if !ok {
		_, ok = pkg.DevDependencies["@portosaur/cli"]
	}
	if !ok {
		_, ok = pkg.DevDependencies["@portosaur/core"]
	}
	return ok
}
