package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.lsp.dev/protocol"
)

// InlayHint shows the resolved value of every `{vars.key}` and
// `{env.VAR}` reference in the requested range, right after the
// reference. Only references that resolve to a value the build
// can substitute get a hint: unknown keys already get a
// diagnostic, and a map, list, or boolean cannot be substituted.
func (s *Server) InlayHint(_ context.Context, params *protocol.InlayHintParams) ([]protocol.InlayHint, error) {
	text, ok := s.documents.waitFor(params.TextDocument.URI, 100*time.Millisecond)
	if !ok {
		return nil, nil
	}
	if !isMDXFile(params.TextDocument.URI) {
		return nil, nil
	}
	root, ok := s.projectFor(params.TextDocument.URI)
	if !ok {
		return nil, nil
	}
	cfg := loadProjectConfig(root)
	vars, _ := cfg["vars"].(map[string]any)
	lines := strings.Split(text, "\n")
	var hints []protocol.InlayHint
	for _, ref := range scanVarsRefs(text) {
		value, ok := resolveVarsValue(vars, ref.path)
		if !ok {
			continue
		}
		if hint, ok := valueHint(lines, ref.end, params.Range, fmt.Sprintf("%v", value)); ok {
			hints = append(hints, hint)
		}
	}
	env := resolveEnv(root)
	for _, ref := range scanEnvRefs(text) {
		value, ok := env[ref.name]
		if !ok {
			continue
		}
		if hint, ok := valueHint(lines, ref.end, params.Range, value.value); ok {
			hints = append(hints, hint)
		}
	}
	return hints, nil
}

// valueHint is the inlay hint showing label right after the
// reference ending at end, when the label is non-empty and the
// position falls inside rng.
func valueHint(lines []string, end int, rng protocol.Range, label string) (protocol.InlayHint, bool) {
	if label == "" {
		// An empty string cannot be a hint label.
		return protocol.InlayHint{}, false
	}
	pos := offsetToPosition(lines, end)
	if !positionInRange(pos, rng) {
		return protocol.InlayHint{}, false
	}
	padding := true
	return protocol.InlayHint{
		Position:    pos,
		Label:       protocol.String(label),
		PaddingLeft: &padding,
	}, true
}

// positionInRange reports whether pos falls inside rng,
// endpoints included.
func positionInRange(pos protocol.Position, rng protocol.Range) bool {
	if pos.Line < rng.Start.Line || pos.Line > rng.End.Line {
		return false
	}
	if pos.Line == rng.Start.Line && pos.Character < rng.Start.Character {
		return false
	}
	if pos.Line == rng.End.Line && pos.Character > rng.End.Character {
		return false
	}
	return true
}
