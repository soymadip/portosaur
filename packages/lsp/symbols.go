package main

import (
	"context"
	"strings"
	"time"

	"go.lsp.dev/protocol"
	"gopkg.in/yaml.v3"
)

// Document symbols: the page outline. Headings H1–H6 nest by
// level, and a Frontmatter symbol holds the top-level
// frontmatter keys. The outline is purely syntactic, so it needs
// no project: it works on any MDX file.

// DocumentSymbol answers textDocument/documentSymbol.
func (s *Server) DocumentSymbol(_ context.Context, params *protocol.DocumentSymbolParams) (protocol.DocumentSymbolResult, error) {
	text, ok := s.documents.waitFor(params.TextDocument.URI, 100*time.Millisecond)
	if !ok {
		return nil, nil
	}
	if !isMDXFile(params.TextDocument.URI) {
		return nil, nil
	}
	symbols := documentSymbols(text)
	if len(symbols) == 0 {
		return nil, nil
	}
	return protocol.DocumentSymbolSlice(symbols), nil
}

func strPtr(s string) *string {
	return &s
}

// documentSymbols builds the outline for a document's text.
func documentSymbols(text string) []protocol.DocumentSymbol {
	lines := strings.Split(text, "\n")
	var symbols []protocol.DocumentSymbol
	if block, ok := extractFrontmatter(text); ok && block.closed {
		if frontmatter, ok := frontmatterSymbol(block, lines); ok {
			symbols = append(symbols, frontmatter)
		}
	}
	symbols = append(symbols, headingSymbols(text, lines)...)
	return symbols
}

// frontmatterSymbol builds the Frontmatter symbol with one
// child per top-level key. It reports false when the block has
// no keys (or its YAML does not parse).
func frontmatterSymbol(block frontmatterBlock, lines []string) (protocol.DocumentSymbol, bool) {
	rootNode, err := parseYAML(block.yaml)
	if err != nil || rootNode == nil {
		return protocol.DocumentSymbol{}, false
	}
	yamlLines := strings.Split(block.yaml, "\n")
	var children []protocol.DocumentSymbol
	if rootNode.Kind == yaml.DocumentNode && len(rootNode.Content) > 0 {
		mapping := rootNode.Content[0]
		if mapping.Kind == yaml.MappingNode {
			for i := 0; i+1 < len(mapping.Content); i += 2 {
				key, value := mapping.Content[i], mapping.Content[i+1]
				child := protocol.DocumentSymbol{
					Name:           key.Value,
					Kind:           protocol.SymbolKindProperty,
					Range:          shiftRange(nodeRange(key, yamlLines), block.startLine),
					SelectionRange: shiftRange(nodeRange(key, yamlLines), block.startLine),
				}
				if detail := frontmatterKeyDetail(value); detail != "" {
					child.Detail = strPtr(detail)
				}
				children = append(children, child)
			}
		}
	}
	if len(children) == 0 {
		return protocol.DocumentSymbol{}, false
	}
	return protocol.DocumentSymbol{
		Name: "Frontmatter",
		Kind: protocol.SymbolKindObject,
		Range: protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: uint32(block.endLine), Character: byteToUTF16(lines[block.endLine], len(lines[block.endLine]))},
		},
		SelectionRange: protocol.Range{
			Start: protocol.Position{Line: 0, Character: 0},
			End:   protocol.Position{Line: 0, Character: byteToUTF16(lines[0], len(lines[0]))},
		},
		Children: children,
	}, true
}

// frontmatterKeyDetail previews a frontmatter value: the value
// itself for a scalar, "object" for a mapping, "list" for a
// sequence.
func frontmatterKeyDetail(value *yaml.Node) string {
	switch value.Kind {
	case yaml.ScalarNode:
		return varsDetail(value.Value)
	case yaml.MappingNode:
		return "object"
	case yaml.SequenceNode:
		return "list"
	default:
		return ""
	}
}

// headingSymbols builds the nested heading outline. A heading's
// range is its section: from its line to the line before the
// next heading of the same or higher level (or the end of the
// document), with trailing blank lines trimmed.
func headingSymbols(text string, lines []string) []protocol.DocumentSymbol {
	headings := extractHeadings(text)
	type node struct {
		symbol   protocol.DocumentSymbol
		level    int
		children []*node
	}
	var roots []*node
	var stack []*node
	for i, h := range headings {
		endLine := len(lines) - 1
		for j := i + 1; j < len(headings); j++ {
			if headings[j].level <= h.level {
				endLine = headings[j].line - 1
				break
			}
		}
		for endLine > h.line && strings.TrimSpace(lines[endLine]) == "" {
			endLine--
		}
		symbol := protocol.DocumentSymbol{
			Name:   h.text,
			Detail: strPtr("#" + h.id),
			Kind:   protocol.SymbolKindString,
			Range: protocol.Range{
				Start: protocol.Position{Line: uint32(h.line), Character: 0},
				End:   protocol.Position{Line: uint32(endLine), Character: byteToUTF16(lines[endLine], len(lines[endLine]))},
			},
			SelectionRange: protocol.Range{
				Start: protocol.Position{Line: uint32(h.line), Character: byteToUTF16(lines[h.line], h.textFrom)},
				End:   protocol.Position{Line: uint32(h.line), Character: byteToUTF16(lines[h.line], h.textTo)},
			},
		}
		n := &node{symbol: symbol, level: h.level}
		for len(stack) > 0 && stack[len(stack)-1].level >= h.level {
			stack = stack[:len(stack)-1]
		}
		if len(stack) == 0 {
			roots = append(roots, n)
		} else {
			parent := stack[len(stack)-1]
			parent.children = append(parent.children, n)
		}
		stack = append(stack, n)
	}
	var convert func(n *node) protocol.DocumentSymbol
	convert = func(n *node) protocol.DocumentSymbol {
		symbol := n.symbol
		for _, child := range n.children {
			symbol.Children = append(symbol.Children, convert(child))
		}
		return symbol
	}
	var symbols []protocol.DocumentSymbol
	for _, root := range roots {
		symbols = append(symbols, convert(root))
	}
	return symbols
}
