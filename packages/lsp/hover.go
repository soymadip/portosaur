package main

import (
	"context"
	"strings"

	"go.lsp.dev/protocol"
)

// Hover shows the schema's description and type for the key under
// the cursor, whether the cursor sits on the key or its value.
func (s *Server) Hover(ctx context.Context, params *protocol.HoverParams) (*protocol.Hover, error) {
	text, ok := s.documents.get(params.TextDocument.URI)
	if !ok || !isConfigFile(params.TextDocument.URI) {
		return nil, nil
	}
	root, ok := s.projectFor(params.TextDocument.URI)
	if !ok {
		return nil, nil
	}
	schema := s.resolver.resolve(root, schemaConfig)
	path, key, span, ok := hoverTarget(text, params.Position)
	if !ok {
		return nil, nil
	}
	node, ok := schemaAt(schema.raw, append(path, key))
	if !ok {
		return nil, nil
	}
	var value strings.Builder
	value.WriteString("**" + key + "**")
	if t := schemaType(node); t != "" {
		value.WriteString(" `" + t + "`")
	}
	if d := schemaDescription(node); d != "" {
		value.WriteString("\n\n" + d)
	}
	return &protocol.Hover{
		Contents: &protocol.MarkupContent{Kind: protocol.MarkupKindMarkdown, Value: value.String()},
		Range:    &span,
	}, nil
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
