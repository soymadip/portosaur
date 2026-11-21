package main

import (
	"context"
	"strings"
	"time"

	"go.lsp.dev/protocol"
)

// Hover shows the schema's description and type for the key
// under the cursor, whether the cursor sits on the key or its
// value. In MDX it covers frontmatter keys and component names
// and props.
func (s *Server) Hover(ctx context.Context, params *protocol.HoverParams) (*protocol.Hover, error) {
	text, ok := s.documents.waitFor(params.TextDocument.URI, 100*time.Millisecond)
	if !ok {
		return nil, nil
	}
	if isMDXFile(params.TextDocument.URI) {
		return s.mdxHover(params, text)
	}
	return nil, nil
}

func (s *Server) mdxHover(params *protocol.HoverParams, text string) (*protocol.Hover, error) {
	root, ok := s.projectFor(params.TextDocument.URI)
	if !ok {
		return nil, nil
	}
	if block, ok := extractFrontmatter(text); ok && block.contains(params.Position.Line) {
		schema := s.resolver.resolve(root, schemaFrontmatter)
		slicePos := protocol.Position{Line: params.Position.Line - uint32(block.startLine), Character: params.Position.Character}
		return yamlHover(schema, block.yaml, slicePos, block.startLine), nil
	}
	cfg := loadProjectConfig(root)
	vars, _ := cfg["vars"].(map[string]any)
	if hover := varsHover(text, params.Position, vars); hover != nil {
		return hover, nil
	}
	schema := s.resolver.resolve(root, schemaComponents)
	return componentHover(schema, text, params.Position), nil
}

// varsHover describes a `{vars.key}` reference: where the value
// comes from and that the build replaces the reference with it.
// The value itself stays out of the hover — it already shows
// inline as an inlay hint — and so does any type. Only
// references that resolve to a value the build can substitute
// get a hover; unknown keys already get a diagnostic.
func varsHover(text string, pos protocol.Position, vars map[string]any) *protocol.Hover {
	lines := strings.Split(text, "\n")
	offset := positionToOffset(lines, pos)
	for _, ref := range scanVarsRefs(text) {
		if offset < ref.start || offset >= ref.end {
			continue
		}
		if _, ok := resolveVarsValue(vars, ref.path); !ok {
			return nil
		}
		value := "**{vars." + ref.path + "}**\n\nDefined under `vars:` in `porto.yml`. The build replaces this reference with its value."
		rng := rangeFromOffsets(lines, ref.start, ref.end)
		return &protocol.Hover{
			Contents: &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: value},
			Range:    &rng,
		}
	}
	return nil
}

// yamlHover shows the schema's description and type for the key
// on the cursor's line, shifting the range down by lineOffset
// (the frontmatter slice's line 0 is the document's line 1).
func yamlHover(schema *resolvedSchema, text string, pos protocol.Position, lineOffset int) *protocol.Hover {
	path, key, span, ok := hoverTarget(text, pos)
	if !ok {
		return nil
	}
	node, ok := schemaAt(schema.raw, append(path, key))
	if !ok {
		return nil
	}
	var value strings.Builder
	value.WriteString("**" + key + "**")
	if t := schemaType(node); t != "" {
		value.WriteString(" `" + t + "`")
	}
	if d := schemaDescription(node); d != "" {
		value.WriteString("\n\n" + d)
	}
	span = shiftRange(span, lineOffset)
	return &protocol.Hover{
		Contents: &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: value.String()},
		Range:    &span,
	}
}

// componentHover shows a component's props on its tag name, or
// a prop's description and type on its name or value.
func componentHover(schema *resolvedSchema, text string, pos protocol.Position) *protocol.Hover {
	context := scanTag(text, pos)
	if !context.found {
		return nil
	}
	def := componentDef(schema, context.name)
	if def == nil {
		return nil
	}
	switch context.token.kind {
	case tokenName:
		doc := componentDoc(def)
		if doc == "" {
			return nil
		}
		return &protocol.Hover{
			Contents: &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: "**" + context.name + "**\n\n" + doc},
			Range:    &context.token.rng,
		}
	case tokenPropName, tokenPropValue:
		prop, ok := asMap(schemaProperties(def)[context.token.prop])
		if !ok {
			return nil
		}
		var value strings.Builder
		value.WriteString("**" + context.token.prop + "**")
		if t := schemaType(prop); t != "" {
			value.WriteString(" `" + t + "`")
		}
		if d := schemaDescription(prop); d != "" {
			value.WriteString("\n\n" + d)
		}
		return &protocol.Hover{
			Contents: &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: value.String()},
			Range:    &context.token.rng,
		}
	default:
		return nil
	}
}

// hoverTarget finds the key on the cursor's line and the span to
// highlight: the key itself, or the value when the cursor sits
// past the colon.
func hoverTarget(text string, pos protocol.Position) (path []string, key string, span protocol.Range, ok bool) {
	lines := strings.Split(text, "\n")
	lineNo := int(pos.Line)
	if lineNo < 0 || lineNo >= len(lines) {
		return nil, "", protocol.Range{}, false
	}
	line := lines[lineNo]
	match := keyLineRe.FindStringSubmatch(line)
	if match == nil {
		return nil, "", protocol.Range{}, false
	}
	key = keyOf(match)
	indent := len(match[1])
	path, _ = enclosingPath(lines, lineNo, indent)

	// The key's span, quotes included when quoted.
	quoted := match[3] != "" || match[4] != ""
	keyEndByte := indent + len(key)
	if quoted {
		keyEndByte += 2
	}
	colonAt := strings.Index(line[keyEndByte:], ":") + keyEndByte
	keyStart := byteToUTF16(line, indent)
	keyEnd := byteToUTF16(line, keyEndByte)
	byteCol := utf16ToByte(line, pos.Character)
	if byteCol <= colonAt {
		span = protocol.Range{
			Start: protocol.Position{Line: pos.Line, Character: keyStart},
			End:   protocol.Position{Line: pos.Line, Character: keyEnd},
		}
		return path, key, span, true
	}
	// The cursor is on the value: highlight the value text,
	// without a trailing comment.
	valueStart := colonAt + 1
	for valueStart < len(line) && line[valueStart] == ' ' {
		valueStart++
	}
	valueEnd := len(line)
	for valueEnd > valueStart && (line[valueEnd-1] == ' ' || line[valueEnd-1] == '\t') {
		valueEnd--
	}
	if hash := strings.Index(line[valueStart:valueEnd], " #"); hash >= 0 {
		valueEnd = valueStart + hash
		for valueEnd > valueStart && line[valueEnd-1] == ' ' {
			valueEnd--
		}
	}
	span = protocol.Range{
		Start: protocol.Position{Line: pos.Line, Character: byteToUTF16(line, valueStart)},
		End:   protocol.Position{Line: pos.Line, Character: byteToUTF16(line, valueEnd)},
	}
	return path, key, span, true
}
