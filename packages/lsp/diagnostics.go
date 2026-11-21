package main

import (
	"context"
	"regexp"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/santhosh-tekuri/jsonschema/v6/kind"
	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
	"gopkg.in/yaml.v3"
)

// Diagnostics for porto.yml: YAML syntax errors always, schema
// validation only in strict mode (the installed CLI's schema).
// Lenient mode (the website's schema) skips validation — the
// latest schema cannot be tied to the project's version.
func (s *Server) publishDiagnostics(documentURI uri.URI) {
	text, ok := s.documents.get(documentURI)
	if !ok || !isConfigFile(documentURI) {
		return
	}
	root, ok := s.projectFor(documentURI)
	if !ok {
		s.sendDiagnostics(documentURI, nil)
		return
	}
	lines := strings.Split(text, "\n")
	rootNode, err := parseYAML(text)
	if err != nil {
		s.sendDiagnostics(documentURI, yamlParseDiagnostics(err, lines))
		return
	}
	schema := s.resolver.resolve(root, schemaConfig)
	if !schema.strict {
		s.sendDiagnostics(documentURI, nil)
		return
	}
	var value any
	if rootNode != nil {
		if err := rootNode.Decode(&value); err != nil {
			s.sendDiagnostics(documentURI, []protocol.Diagnostic{{
				Range: protocol.Range{
					Start: protocol.Position{Line: 0, Character: 0},
					End:   protocol.Position{Line: 0, Character: 1},
				},
				Severity: protocol.DiagnosticSeverityError,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String(err.Error()),
			}})
			return
		}
	}
	// An empty file is all defaults, not an error.
	if value == nil {
		s.sendDiagnostics(documentURI, nil)
		return
	}
	if err := schema.compiled.Validate(value); err != nil {
		verr, ok := err.(*jsonschema.ValidationError)
		if !ok {
			s.sendDiagnostics(documentURI, nil)
			return
		}
		s.sendDiagnostics(documentURI, validationDiagnostics(verr, rootNode, lines))
		return
	}
	s.sendDiagnostics(documentURI, nil)
}

func (s *Server) sendDiagnostics(documentURI uri.URI, diags []protocol.Diagnostic) {
	if s.client == nil {
		return
	}
	if diags == nil {
		diags = []protocol.Diagnostic{}
	}
	_ = s.client.PublishDiagnostics(context.Background(), &protocol.PublishDiagnosticsParams{
		URI:         documentURI,
		Diagnostics: diags,
	})
}

// The library prefixes leaf messages with the instance location
// ("at '/site/title': got number, want string"); the diagnostic's
// range already says where, so the prefix is dropped.
var validationMessageRe = regexp.MustCompile(`^at '[^']*': (.*)$`)

func validationDiagnostics(verr *jsonschema.ValidationError, root *yaml.Node, lines []string) []protocol.Diagnostic {
	var diags []protocol.Diagnostic
	var walk func(e *jsonschema.ValidationError)
	walk = func(e *jsonschema.ValidationError) {
		if len(e.Causes) > 0 {
			for _, cause := range e.Causes {
				walk(cause)
			}
			return
		}
		message := e.Error()
		if match := validationMessageRe.FindStringSubmatch(message); match != nil {
			message = match[1]
		}
		var node *yaml.Node
		if additional, ok := e.ErrorKind.(*kind.AdditionalProperties); ok && len(additional.Properties) > 0 {
			// An unknown key: point at the key itself.
			key, _ := yamlLookup(root, append(append([]string{}, e.InstanceLocation...), additional.Properties[0]))
			node = key
		} else {
			// Anything else: point at the value.
			_, node = yamlLookup(root, e.InstanceLocation)
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    nodeRange(node, lines),
			Severity: protocol.DiagnosticSeverityError,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(message),
		})
	}
	walk(verr)
	return diags
}
