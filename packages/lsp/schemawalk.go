package main

import (
	"strconv"
	"strings"
)

// Walking a raw JSON Schema (the parsed JSON document) by path.
// The compiled schema validates; the raw document answers
// completion and hover, where descriptions and enums live.

func asMap(v any) (map[string]any, bool) {
	m, ok := v.(map[string]any)
	return m, ok
}

// schemaAt walks a schema by path segments: through `properties`
// for named keys, through `additionalProperties` for free-form
// keys, through `items` for array elements (a segment is never an
// array index here — the cursor analysis stops at list items).
func schemaAt(schema map[string]any, path []string) (map[string]any, bool) {
	node := schema
	for _, segment := range path {
		if props, ok := asMap(node["properties"]); ok {
			if child, ok := asMap(props[segment]); ok {
				node = child
				continue
			}
		}
		if additional, ok := asMap(node["additionalProperties"]); ok {
			node = additional
			continue
		}
		return nil, false
	}
	return node, true
}

// schemaHasType reports whether the node's type includes the
// given type, handling both "boolean" and ["boolean", "null"].
func schemaHasType(node map[string]any, want string) bool {
	switch t := node["type"].(type) {
	case string:
		return t == want
	case []any:
		for _, p := range t {
			if s, ok := p.(string); ok && s == want {
				return true
			}
		}
	}
	return false
}

// schemaType renders a schema node's type: "string", "string |
// number", or the x-ts-type when the node has no JSON type (a
// component prop whose type is a TS-only shape).
func schemaType(node map[string]any) string {
	switch t := node["type"].(type) {
	case string:
		return t
	case []any:
		parts := make([]string, 0, len(t))
		for _, p := range t {
			if s, ok := p.(string); ok {
				parts = append(parts, s)
			}
		}
		return strings.Join(parts, " | ")
	}
	if ts, ok := node["x-ts-type"].(string); ok {
		return ts
	}
	return ""
}

func schemaDescription(node map[string]any) string {
	if d, ok := node["description"].(string); ok {
		return d
	}
	return ""
}

// schemaDefaultText renders a schema node's default value as
// plain text for a snippet placeholder, or "" when the node has
// no literal default. JSON numbers arrive as float64.
func schemaDefaultText(node map[string]any) (string, bool) {
	switch v := node["default"].(type) {
	case string:
		return v, true
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64), true
	case bool:
		return strconv.FormatBool(v), true
	}
	return "", false
}

// schemaEnum returns the node's enum values as strings, or nil.
func schemaEnum(node map[string]any) []string {
	list, ok := node["enum"].([]any)
	if !ok {
		return nil
	}
	values := make([]string, 0, len(list))
	for _, v := range list {
		if s, ok := v.(string); ok {
			values = append(values, s)
		}
	}
	return values
}

// schemaProperties returns the node's properties, or nil.
func schemaProperties(node map[string]any) map[string]any {
	props, _ := asMap(node["properties"])
	return props
}

// isObjectSchema reports whether the node describes an object
// with properties (a key whose value is a mapping, not a scalar).
func isObjectSchema(node map[string]any) bool {
	if schemaProperties(node) != nil {
		return true
	}
	if t, ok := node["type"].(string); ok && t == "object" {
		return true
	}
	return false
}
