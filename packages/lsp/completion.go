package main

import (
	"context"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"

	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
)

// Shared helpers for the feature handlers.

// uriPath turns a document URI into a filesystem path.
func uriPath(documentURI uri.URI) string {
	return fsPath(documentURI)
}

// fsPath turns a parsed URI into a filesystem path, using the
// platform the server runs on.
func fsPath(parsed uri.URI) string {
	platform := uri.PlatformPOSIX
	if runtime.GOOS == "windows" {
		platform = uri.PlatformWindows
	}
	return uri.FsPathFor(parsed, platform, false)
}

// isConfigFile reports whether the document is a Portosaur
// config file. Phase 2 covers porto.yml only; MDX comes in
// Phase 3.
func isConfigFile(documentURI uri.URI) bool {
	base := filepath.Base(uriPath(documentURI))
	return base == "porto.yml" || base == "porto.yaml"
}

// projectFor finds the project a document belongs to.
func (s *Server) projectFor(documentURI uri.URI) (string, bool) {
	return s.detector.findProjectRoot(uriPath(documentURI))
}

// Completion answers key and value completion for porto.yml from
// the config schema. A document outside a Portosaur project gets
// an empty list, not an error.
func (s *Server) Completion(ctx context.Context, params *protocol.CompletionParams) (protocol.CompletionResult, error) {
	text, ok := s.documents.get(params.TextDocument.URI)
	if !ok || !isConfigFile(params.TextDocument.URI) {
		return &protocol.CompletionList{}, nil
	}
	root, ok := s.projectFor(params.TextDocument.URI)
	if !ok {
		return &protocol.CompletionList{}, nil
	}
	schema := s.resolver.resolve(root, schemaConfig)
	context := analyzeCursor(text, params.Position)
	switch context.kind {
	case cursorKey:
		return keyCompletions(schema, context), nil
	case cursorValue:
		return valueCompletions(schema, context), nil
	default:
		return &protocol.CompletionList{}, nil
	}
}

func keyCompletions(schema *resolvedSchema, context cursorContext) *protocol.CompletionList {
	node, ok := schemaAt(schema.raw, context.path)
	if !ok {
		return &protocol.CompletionList{}
	}
	props := schemaProperties(node)
	if props == nil {
		return &protocol.CompletionList{}
	}
	var items []protocol.CompletionItem
	for name, raw := range props {
		if context.existingKeys[name] {
			continue
		}
		if !strings.HasPrefix(name, context.partial) {
			continue
		}
		prop, _ := asMap(raw)
		item := protocol.CompletionItem{
			Label: name,
			Kind:  protocol.CompletionItemKindProperty,
		}
		if t := schemaType(prop); t != "" {
			item.Detail = protocol.NewOptional(t)
		}
		if d := schemaDescription(prop); d != "" {
			item.Documentation = &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: d}
		}
		// Object-valued keys take `key:` (the value goes on the
		// next line); scalars take `key: ` (the value follows).
		text := name + ":"
		if !isObjectSchema(prop) {
			text += " "
		}
		item.TextEdit = &protocol.TextEdit{Range: context.partialRange, NewText: text}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

func valueCompletions(schema *resolvedSchema, context cursorContext) *protocol.CompletionList {
	node, ok := schemaAt(schema.raw, append(context.path, context.key))
	if !ok {
		return &protocol.CompletionList{}
	}
	var values []string
	if enums := schemaEnum(node); enums != nil {
		values = enums
	} else if schemaHasType(node, "boolean") {
		values = []string{"true", "false"}
	}
	var items []protocol.CompletionItem
	for _, value := range values {
		if !strings.HasPrefix(value, context.partial) {
			continue
		}
		items = append(items, protocol.CompletionItem{
			Label:    value,
			Kind:     protocol.CompletionItemKindValue,
			TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: yamlQuote(value)},
		})
	}
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// yamlQuote leaves plain-safe scalars bare and double-quotes the
// rest, so a value with a space or a colon stays one scalar.
var plainScalarRe = regexp.MustCompile(`^[A-Za-z0-9_./-]+$`)

func yamlQuote(value string) string {
	if plainScalarRe.MatchString(value) {
		return value
	}
	return `"` + strings.ReplaceAll(value, `"`, `\"`) + `"`
}
