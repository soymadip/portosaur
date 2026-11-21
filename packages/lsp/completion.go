package main

import (
	"context"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"

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

// isMDXFile reports whether the document is an MDX file: the
// frontmatter and component features serve it. porto.yml is not
// served here at all — the YAML extension handles it through the
// $schema line at the top of the file.
func isMDXFile(documentURI uri.URI) bool {
	return strings.HasSuffix(uriPath(documentURI), ".mdx")
}

// projectFor finds the project a document belongs to.
func (s *Server) projectFor(documentURI uri.URI) (string, bool) {
	return s.detector.findProjectRoot(uriPath(documentURI))
}

// Completion answers frontmatter keys and values in MDX from
// the frontmatter schema, and component names, prop names and
// prop values in MDX from the components schema. A document
// outside a Portosaur project gets an empty list, not an error.
func (s *Server) Completion(ctx context.Context, params *protocol.CompletionParams) (protocol.CompletionResult, error) {
	text, ok := s.documents.waitFor(params.TextDocument.URI, 100*time.Millisecond)
	if !ok {
		return &protocol.CompletionList{}, nil
	}
	if isMDXFile(params.TextDocument.URI) {
		return s.mdxCompletion(params, text)
	}
	return &protocol.CompletionList{}, nil
}

func (s *Server) mdxCompletion(params *protocol.CompletionParams, text string) (protocol.CompletionResult, error) {
	root, ok := s.projectFor(params.TextDocument.URI)
	if !ok {
		return &protocol.CompletionList{}, nil
	}
	if block, ok := extractFrontmatter(text); ok && block.contains(params.Position.Line) {
		return s.frontmatterCompletion(params, block, s.resolver.resolve(root, schemaFrontmatter)), nil
	}
	if list, handled := s.varsCompletion(params, text, root); handled {
		return list, nil
	}
	if list, handled := s.envCompletion(params, text, root); handled {
		return list, nil
	}
	if list, handled := s.linkCompletion(params, text, root); handled {
		return list, nil
	}
	if list, handled := s.shortcodeCompletion(params, text, root); handled {
		return list, nil
	}
	return s.componentCompletion(params, text, s.resolver.resolve(root, schemaComponents)), nil
}

// frontmatterCompletion runs the YAML engine over the
// frontmatter slice and shifts the edits back into the
// document. The cursor's line is adjusted to the slice, whose
// line 0 is the document's line 1.
func (s *Server) frontmatterCompletion(params *protocol.CompletionParams, block frontmatterBlock, schema *resolvedSchema) *protocol.CompletionList {
	slicePos := protocol.Position{Line: params.Position.Line - uint32(block.startLine), Character: params.Position.Character}
	context := analyzeCursor(block.yaml, slicePos)
	var list *protocol.CompletionList
	switch context.kind {
	case cursorKey:
		list = keyCompletions(schema, context)
	case cursorValue:
		list = valueCompletions(schema, context)
	default:
		return &protocol.CompletionList{}
	}
	return shiftCompletionList(list, block.startLine)
}

// componentCompletion offers component names, prop names and
// prop values from the components schema, following the tag the
// cursor sits inside.
func (s *Server) componentCompletion(params *protocol.CompletionParams, text string, schema *resolvedSchema) *protocol.CompletionList {
	context := scanTag(text, params.Position)
	if !context.found {
		return &protocol.CompletionList{}
	}
	switch context.kind {
	case tagName:
		return componentNameCompletions(schema, context)
	case tagProp:
		return propNameCompletions(schema, context)
	case tagValue:
		return propValueCompletions(schema, context)
	default:
		return &protocol.CompletionList{}
	}
}

// componentNameCompletions offers the component names from the
// schema's definitions, filtered by the typed prefix. The
// description lists the component's props, required ones marked.
func componentNameCompletions(schema *resolvedSchema, context tagContext) *protocol.CompletionList {
	definitions, _ := asMap(schema.raw["definitions"])
	if definitions == nil {
		return &protocol.CompletionList{}
	}
	var items []protocol.CompletionItem
	for name, raw := range definitions {
		if !strings.HasPrefix(name, context.partial) {
			continue
		}
		def, _ := asMap(raw)
		item := protocol.CompletionItem{
			Label: name,
			Kind:  protocol.CompletionItemKindClass,
		}
		if required := schemaRequired(def); len(required) > 0 {
			item.Detail = protocol.NewOptional("required: " + strings.Join(required, ", "))
		}
		if doc := componentDoc(def); doc != "" {
			item.Documentation = &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: doc}
		}
		item.TextEdit = &protocol.TextEdit{Range: context.partialRange, NewText: name}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// propNameCompletions offers the props of the tag's component,
// minus the ones already present. Boolean props complete bare
// (a bare prop means true in JSX); the rest take `name=` so the
// value can follow.
func propNameCompletions(schema *resolvedSchema, context tagContext) *protocol.CompletionList {
	def := componentDef(schema, context.name)
	if def == nil {
		return &protocol.CompletionList{}
	}
	props := schemaProperties(def)
	if props == nil {
		return &protocol.CompletionList{}
	}
	var items []protocol.CompletionItem
	for name, raw := range props {
		if context.existingProps[name] {
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
		text := name
		if !schemaHasType(prop, "boolean") {
			text += "="
		}
		item.TextEdit = &protocol.TextEdit{Range: context.partialRange, NewText: text}
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Label < items[j].Label })
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// propValueCompletions offers the prop's enum values, or
// true/false for a boolean prop. Inside quotes the value goes
// in bare; without quotes a string value is quoted, and a
// boolean stays bare.
func propValueCompletions(schema *resolvedSchema, context tagContext) *protocol.CompletionList {
	def := componentDef(schema, context.name)
	if def == nil {
		return &protocol.CompletionList{}
	}
	prop, ok := asMap(schemaProperties(def)[context.prop])
	if !ok {
		return &protocol.CompletionList{}
	}
	var values []string
	isBoolean := false
	if enums := schemaEnum(prop); enums != nil {
		values = enums
	} else if schemaHasType(prop, "boolean") {
		values = []string{"true", "false"}
		isBoolean = true
	}
	var items []protocol.CompletionItem
	for _, value := range values {
		if !strings.HasPrefix(value, context.partial) {
			continue
		}
		text := value
		if !context.quoted && !isBoolean {
			text = `"` + value + `"`
		}
		items = append(items, protocol.CompletionItem{
			Label:    value,
			Kind:     protocol.CompletionItemKindValue,
			TextEdit: &protocol.TextEdit{Range: context.partialRange, NewText: text},
		})
	}
	return &protocol.CompletionList{IsIncomplete: false, Items: items}
}

// componentDef looks a component up in the components schema's
// definitions.
func componentDef(schema *resolvedSchema, name string) map[string]any {
	definitions, _ := asMap(schema.raw["definitions"])
	if definitions == nil {
		return nil
	}
	def, _ := asMap(definitions[name])
	return def
}

// schemaRequired returns the node's required keys, or nil.
func schemaRequired(node map[string]any) []string {
	list, ok := node["required"].([]any)
	if !ok {
		return nil
	}
	required := make([]string, 0, len(list))
	for _, v := range list {
		if s, ok := v.(string); ok {
			required = append(required, s)
		}
	}
	return required
}

// componentDoc renders a component's props as a one-line doc:
// "Props: value*, label, default" with required props marked.
func componentDoc(def map[string]any) string {
	props := schemaProperties(def)
	if props == nil {
		return ""
	}
	required := map[string]bool{}
	for _, name := range schemaRequired(def) {
		required[name] = true
	}
	names := make([]string, 0, len(props))
	for name := range props {
		if required[name] {
			names = append(names, name+"*")
		} else {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	return "Props: " + strings.Join(names, ", ")
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
