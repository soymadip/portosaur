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

// Diagnostics for MDX documents: frontmatter YAML (syntax errors
// always, schema validation only in strict mode) plus component
// checks over the page body. The schema-based component checks
// (unknown components, missing required props) are strict-only
// too — the website's schema is the latest release's, which
// cannot be tied to the project's version. The icon checks are
// static rules, not schema-based, so they run in both modes. An
// unclosed frontmatter block gets no frontmatter diagnostics:
// the YAML cannot be told apart from the prose below it.
// porto.yml is not diagnosed here — the YAML extension handles
// it through the $schema line at the top of the file.
func (s *Server) publishDiagnostics(documentURI uri.URI) {
	text, ok := s.documents.get(documentURI)
	if !ok {
		return
	}
	if !isMDXFile(documentURI) {
		return
	}
	root, ok := s.projectFor(documentURI)
	if !ok {
		s.sendDiagnostics(documentURI, nil)
		return
	}
	var diags []protocol.Diagnostic
	if block, ok := extractFrontmatter(text); ok && block.closed {
		diags = append(diags, s.frontmatterIssues(block, root)...)
	}
	for _, issue := range s.componentIssues(text, root) {
		diags = append(diags, issue.diag)
	}
	s.sendDiagnostics(documentURI, diags)
}

// frontmatterIssues validates one frontmatter block and returns
// its diagnostics, shifted down into the document.
func (s *Server) frontmatterIssues(block frontmatterBlock, root string) []protocol.Diagnostic {
	lines := strings.Split(block.yaml, "\n")
	rootNode, err := parseYAML(block.yaml)
	if err != nil {
		return shiftDiagnostics(yamlParseDiagnostics(err, lines), block.startLine)
	}
	schema := s.resolver.resolve(root, schemaFrontmatter)
	var diags []protocol.Diagnostic
	diags = append(diags, frontmatterIconDiagnostics(rootNode, lines, block.startLine)...)
	if !schema.strict {
		return diags
	}
	var value any
	if rootNode != nil {
		if err := rootNode.Decode(&value); err != nil {
			diags = append(diags, shiftDiagnostics([]protocol.Diagnostic{{
				Range: protocol.Range{
					Start: protocol.Position{Line: 0, Character: 0},
					End:   protocol.Position{Line: 0, Character: 1},
				},
				Severity: protocol.DiagnosticSeverityError,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String(err.Error()),
			}}, block.startLine)...)
			return diags
		}
	}
	// An empty file is all defaults, not an error.
	if value == nil {
		return diags
	}
	if err := schema.compiled.Validate(value); err != nil {
		verr, ok := err.(*jsonschema.ValidationError)
		if !ok {
			return diags
		}
		diags = append(diags, shiftDiagnostics(validationDiagnostics(verr, rootNode, lines), block.startLine)...)
	}
	return diags
}

// frontmatterIconDiagnostics checks the frontmatter `icon` key,
// if it holds a plain string. The check is static, so it runs in
// both modes.
func frontmatterIconDiagnostics(rootNode *yaml.Node, lines []string, lineOffset int) []protocol.Diagnostic {
	_, value := yamlLookup(rootNode, []string{"icon"})
	if value == nil || value.Kind != yaml.ScalarNode {
		return nil
	}
	if message := validateIconID(value.Value); message != "" {
		return shiftDiagnostics([]protocol.Diagnostic{{
			Range:    nodeRange(value, lines),
			Severity: protocol.DiagnosticSeverityWarning,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(message),
		}}, lineOffset)
	}
	return nil
}

// componentIssue is one problem with a component use: the
// diagnostic the editor shows, plus what a quick fix needs (the
// missing prop and where to insert it). Diagnostics publish
// diag; code actions reuse the rest.
type componentIssue struct {
	diag        protocol.Diagnostic
	missingProp string
	insert      protocol.Position
}

// The props that hold icon values, per component.
var iconProps = map[string][]string{
	"Icon":        {"id"},
	"DynamicIcon": {"icon"},
	"Btn":         {"icon"},
}

// componentIssues checks every component use in the document:
// unknown components, missing required props (both strict-only),
// and bad icon values (both modes).
func (s *Server) componentIssues(text string, root string) []componentIssue {
	schema := s.resolver.resolve(root, schemaComponents)
	lines := strings.Split(text, "\n")
	var issues []componentIssue
	for _, tag := range scanAllTags(text) {
		if len(tag.name) == 0 || tag.name[0] < 'A' || tag.name[0] > 'Z' {
			// Lowercase tags are plain HTML.
			continue
		}
		def := componentDef(schema, tag.name)
		if def == nil {
			if schema.strict {
				issues = append(issues, componentIssue{diag: protocol.Diagnostic{
					Range:    tag.nameRange,
					Severity: protocol.DiagnosticSeverityWarning,
					Source:   protocol.NewOptional("porto-lsp"),
					Message:  protocol.String("Unknown component <" + tag.name + ">"),
				}})
			}
			continue
		}
		if schema.strict {
			for _, required := range schemaRequired(def) {
				if !tag.existingProps[required] {
					issues = append(issues, componentIssue{
						diag: protocol.Diagnostic{
							Range:    tag.nameRange,
							Severity: protocol.DiagnosticSeverityWarning,
							Source:   protocol.NewOptional("porto-lsp"),
							Message:  protocol.String("Missing required prop '" + required + "' for <" + tag.name + ">"),
						},
						missingProp: required,
						insert:      tag.nameRange.End,
					})
				}
			}
		}
		for _, propName := range iconProps[tag.name] {
			for _, prop := range tag.props {
				if prop.name != propName || !prop.hasValue || prop.expr {
					continue
				}
				value := text[prop.valueStart:prop.valueEnd]
				if message := validateIconID(value); message != "" {
					issues = append(issues, componentIssue{diag: protocol.Diagnostic{
						Range:    rangeFromOffsets(lines, prop.valueStart, prop.valueEnd),
						Severity: protocol.DiagnosticSeverityWarning,
						Source:   protocol.NewOptional("porto-lsp"),
						Message:  protocol.String(message),
					}})
				}
			}
		}
	}
	return issues
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
