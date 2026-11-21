package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// realSchema reads one of the repo's generated schemas, so the
// tests exercise the schemas users actually get.
func realSchema(t *testing.T, kind schemaKind) []byte {
	t.Helper()
	raw, err := os.ReadFile("../cli/schema/" + string(kind) + ".json")
	if err != nil {
		t.Fatalf("reading the generated %s schema: %v", kind, err)
	}
	return raw
}

func realConfigSchema(t *testing.T) []byte {
	t.Helper()
	return realSchema(t, schemaConfig)
}

func installSchema(t *testing.T, root string, kind schemaKind, raw []byte) {
	t.Helper()
	dir := filepath.Join(root, "node_modules", "@portosaur", "cli", "schema")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, string(kind)+".json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestResolveInstalledSchemaIsStrict(t *testing.T) {
	root := t.TempDir()
	installSchema(t, root, schemaConfig, realConfigSchema(t))
	resolver := newSchemaResolver(func(string) { t.Fatal("onFatal called for an installed schema") })
	schema := resolver.resolve(root, schemaConfig)
	if !schema.strict {
		t.Fatal("installed schema is not strict")
	}
	if _, ok := schema.raw["properties"]; !ok {
		t.Fatal("resolved schema has no properties")
	}
	if schema.compiled == nil {
		t.Fatal("resolved schema is not compiled")
	}
}

func TestResolveFindsHoistedSchema(t *testing.T) {
	parent := t.TempDir()
	installSchema(t, parent, schemaConfig, realConfigSchema(t))
	child := filepath.Join(parent, "packages", "site")
	if err := os.MkdirAll(child, 0o755); err != nil {
		t.Fatal(err)
	}
	resolver := newSchemaResolver(func(string) { t.Fatal("onFatal called for a hoisted schema") })
	schema := resolver.resolve(child, schemaConfig)
	if !schema.strict {
		t.Fatal("hoisted schema is not strict")
	}
}

func TestResolveFallsBackToWebsite(t *testing.T) {
	raw := realConfigSchema(t)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/config.json" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(raw)
	}))
	defer website.Close()

	resolver := newSchemaResolver(func(string) { t.Fatal("onFatal called when the website answered") })
	resolver.website = website.URL
	schema := resolver.resolve(t.TempDir(), schemaConfig)
	if schema.strict {
		t.Fatal("website schema is strict")
	}
	if _, ok := schema.raw["properties"]; !ok {
		t.Fatal("website schema has no properties")
	}
}

func TestResolveFatalWhenNothingWorks(t *testing.T) {
	called := ""
	resolver := newSchemaResolver(func(message string) { called = message })
	resolver.website = "http://127.0.0.1:1"
	schema := resolver.resolve(t.TempDir(), schemaConfig)
	if called == "" {
		t.Fatal("onFatal was not called")
	}
	if schema != nil {
		t.Fatal("resolve returned a schema after onFatal")
	}
}

func TestResolveSkipsUnparseableInstalledSchema(t *testing.T) {
	root := t.TempDir()
	installSchema(t, root, schemaConfig, []byte("{not json"))
	raw := realConfigSchema(t)
	website := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(raw)
	}))
	defer website.Close()

	resolver := newSchemaResolver(func(string) { t.Fatal("onFatal called when the website answered") })
	resolver.website = website.URL
	schema := resolver.resolve(root, schemaConfig)
	if schema.strict {
		t.Fatal("an unparseable installed schema beat the website fallback")
	}
}
