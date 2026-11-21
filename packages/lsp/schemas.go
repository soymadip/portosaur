package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Schema resolution, per project and per schema kind. The server
// embeds nothing: each schema comes from the project's installed
// @portosaur/cli (strict mode — the schema matches the project's
// own version, so diagnostics apply) or, failing that, from the
// website (lenient mode — the website serves the latest release's
// schema, which cannot be tied to the project's version, so no
// schema-based diagnostics). When neither source works the server
// notifies the user and exits; onFatal does not return.

type schemaKind string

const (
	schemaConfig      schemaKind = "config"
	schemaFrontmatter schemaKind = "frontmatter"
	schemaComponents  schemaKind = "components"
)

// websiteBase is where the current release's schemas live.
const websiteBase = "https://soymadip.github.io/schema"

type resolvedSchema struct {
	raw      map[string]any
	compiled *jsonschema.Schema
	strict   bool
}

type projectSchemas struct {
	mu      sync.Mutex
	schemas map[schemaKind]*resolvedSchema
}

type schemaResolver struct {
	mu       sync.Mutex
	projects map[string]*projectSchemas
	client   *http.Client
	website  string
	onFatal  func(message string)
}

func newSchemaResolver(onFatal func(string)) *schemaResolver {
	return &schemaResolver{
		projects: map[string]*projectSchemas{},
		client:   &http.Client{Timeout: 10 * time.Second},
		website:  websiteBase,
		onFatal:  onFatal,
	}
}

// resolve returns the schema for a project, loading and compiling
// it on first use and caching it after. It never returns nil:
// when no source works it calls onFatal, which exits.
func (r *schemaResolver) resolve(root string, kind schemaKind) *resolvedSchema {
	r.mu.Lock()
	ps, ok := r.projects[root]
	if !ok {
		ps = &projectSchemas{schemas: map[schemaKind]*resolvedSchema{}}
		r.projects[root] = ps
	}
	r.mu.Unlock()

	ps.mu.Lock()
	defer ps.mu.Unlock()
	if s, ok := ps.schemas[kind]; ok {
		return s
	}

	if raw, ok := loadInstalledSchema(root, kind); ok {
		s, err := compileSchema(kind, raw, true)
		if err != nil {
			r.onFatal(fmt.Sprintf("Portosaur: the installed %s schema is broken (%v). Reinstall @portosaur/cli.", kind, err))
		}
		ps.schemas[kind] = s
		return s
	}
	if raw, ok := r.fetchSchema(kind); ok {
		s, err := compileSchema(kind, raw, false)
		if err != nil {
			r.onFatal(fmt.Sprintf("Portosaur: the %s schema from the website is broken (%v).", kind, err))
		}
		ps.schemas[kind] = s
		return s
	}
	r.onFatal(fmt.Sprintf("Portosaur: could not load the %s schema. Install the project dependencies or check your connection.", kind))
	return nil
}

// loadInstalledSchema walks up from the project root for the
// schema in an installed @portosaur/cli, the way npm hoisting
// lays it out. A file that exists but does not parse is skipped,
// so a parent install can still win.
func loadInstalledSchema(root string, kind schemaKind) (map[string]any, bool) {
	dir := root
	for {
		raw, err := os.ReadFile(filepath.Join(dir, "node_modules", "@portosaur", "cli", "schema", string(kind)+".json"))
		if err == nil {
			var doc map[string]any
			if json.Unmarshal(raw, &doc) == nil {
				return doc, true
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return nil, false
		}
		dir = parent
	}
}

func (r *schemaResolver) fetchSchema(kind schemaKind) (map[string]any, bool) {
	resp, err := r.client.Get(r.website + "/" + string(kind) + ".json")
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, false
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, false
	}
	var doc map[string]any
	if json.Unmarshal(body, &doc) != nil {
		return nil, false
	}
	return doc, true
}

// compileSchema compiles a raw schema document. Each call uses a
// fresh compiler: schemas from different projects share a URL but
// not content, and a shared compiler would return the first one
// it compiled.
func compileSchema(kind schemaKind, raw map[string]any, strict bool) (*resolvedSchema, error) {
	url := "https://portosaur.dev/schema/" + string(kind) + ".json"
	compiler := jsonschema.NewCompiler()
	if err := compiler.AddResource(url, raw); err != nil {
		return nil, err
	}
	compiled, err := compiler.Compile(url)
	if err != nil {
		return nil, err
	}
	return &resolvedSchema{raw: raw, compiled: compiled, strict: strict}, nil
}
