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
// checks and `{vars.}` and `{env.}` reference checks over the
// page body. The schema-based component checks
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
		for _, issue := range s.frontmatterIssues(block, root) {
			diags = append(diags, issue.diag)
		}
	}
	for _, issue := range s.componentIssues(text, root) {
		diags = append(diags, issue.diag)
	}
	for _, diag := range s.varsIssues(text, root) {
		diags = append(diags, diag)
	}
	for _, diag := range s.envIssues(text, root) {
		diags = append(diags, diag)
	}
	s.sendDiagnostics(documentURI, diags)
}

// frontmatterIssue is one frontmatter problem: the diagnostic
// plus what a quick fix needs. enum holds the valid values when
// the problem is an enum mismatch; unknownKey names the key when
// the problem is an unknown key, and unknownScalar reports
// whether its value is a single-line scalar, so the whole line
// can be deleted safely. Diagnostics publish diag; code actions
// reuse the rest.
type frontmatterIssue struct {
	diag          protocol.Diagnostic
	enum          []string
	unknownKey    string
	unknownScalar bool
}

// frontmatterIssues validates one frontmatter block and returns
// its issues, shifted down into the document.
func (s *Server) frontmatterIssues(block frontmatterBlock, root string) []frontmatterIssue {
	lines := strings.Split(block.yaml, "\n")
	rootNode, err := parseYAML(block.yaml)
	if err != nil {
		return wrapIssues(shiftDiagnostics(yamlParseDiagnostics(err, lines), block.startLine))
	}
	schema := s.resolver.resolve(root, schemaFrontmatter)
	var issues []frontmatterIssue
	for _, diag := range frontmatterIconDiagnostics(rootNode, lines, block.startLine) {
		issues = append(issues, frontmatterIssue{diag: diag})
	}
	if !schema.strict {
		return issues
	}
	var value any
	if rootNode != nil {
		if err := rootNode.Decode(&value); err != nil {
			issues = append(issues, frontmatterIssue{diag: shiftDiagnostics([]protocol.Diagnostic{{
				Range: protocol.Range{
					Start: protocol.Position{Line: 0, Character: 0},
					End:   protocol.Position{Line: 0, Character: 1},
				},
				Severity: protocol.DiagnosticSeverityError,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String(err.Error()),
			}}, block.startLine)[0]})
			return issues
		}
	}
	// An empty file is all defaults, not an error.
	if value == nil {
		return issues
	}
	if err := schema.compiled.Validate(value); err != nil {
		verr, ok := err.(*jsonschema.ValidationError)
		if !ok {
			return issues
		}
		for _, issue := range validationIssues(verr, rootNode, lines) {
			issue.diag = shiftDiagnostics([]protocol.Diagnostic{issue.diag}, block.startLine)[0]
			issues = append(issues, issue)
		}
	}
	return issues
}

func wrapIssues(diags []protocol.Diagnostic) []frontmatterIssue {
	issues := make([]frontmatterIssue, 0, len(diags))
	for _, diag := range diags {
		issues = append(issues, frontmatterIssue{diag: diag})
	}
	return issues
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
// missing prop and where to insert it, or the valid values for a
// bad enum value). Diagnostics publish diag; code actions reuse
// the rest.
type componentIssue struct {
	diag        protocol.Diagnostic
	missingProp string
	insert      protocol.Position
	enum        []string
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
			for _, prop := range tag.props {
				if !prop.hasValue || prop.expr {
					continue
				}
				propSchema, ok := asMap(schemaProperties(def)[prop.name])
				if !ok {
					continue
				}
				enums := schemaEnum(propSchema)
				if enums == nil {
					continue
				}
				value := text[prop.valueStart:prop.valueEnd]
				valid := false
				for _, allowed := range enums {
					if value == allowed {
						valid = true
						break
					}
				}
				if !valid {
					issues = append(issues, componentIssue{
						diag: protocol.Diagnostic{
							Range:    rangeFromOffsets(lines, prop.valueStart, prop.valueEnd),
							Severity: protocol.DiagnosticSeverityWarning,
							Source:   protocol.NewOptional("porto-lsp"),
							Message:  protocol.String("Invalid value '" + value + "' for prop '" + prop.name + "' of <" + tag.name + ">: expected one of " + strings.Join(enums, ", ")),
						},
						enum: enums,
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

// varsIssues checks every `{vars.key}` reference in the
// document body against the project's `vars:` map. The severity
// follows site.content.on_missing_var: throw is an error, warn
// is a warning, ignore reports nothing. The default is throw,
// and an unrecognized value falls back to it. The check reads
// porto.yml directly, not a schema, so it runs in both modes.
func (s *Server) varsIssues(text string, root string) []protocol.Diagnostic {
	cfg := loadProjectConfig(root)
	behavior := configString(cfg, []string{"site", "content", "on_missing_var"}, "throw")
	if behavior == "ignore" {
		return nil
	}
	severity := protocol.DiagnosticSeverityError
	if behavior == "warn" {
		severity = protocol.DiagnosticSeverityWarning
	}
	vars, _ := cfg["vars"].(map[string]any)
	lines := strings.Split(text, "\n")
	var diags []protocol.Diagnostic
	for _, ref := range scanVarsRefs(text) {
		if resolveVarsPath(vars, ref.path) {
			continue
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, ref.start, ref.end),
			Severity: severity,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String("Unknown vars key \"{vars." + ref.path + "}\" (not defined under 'vars:' in porto.yml)"),
		})
	}
	return diags
}

// envIssues checks every `{env.VAR}` reference in the document
// body against the environment the build can see: the server
// process environment plus the project's `.env` files. The
// severity follows site.content.on_missing_env: throw is an
// error, warn is a warning, ignore reports nothing. The default
// is warn, and an unrecognized value falls back to it. The check
// reads porto.yml directly, not a schema, so it runs in both
// modes.
func (s *Server) envIssues(text string, root string) []protocol.Diagnostic {
	cfg := loadProjectConfig(root)
	behavior := configString(cfg, []string{"site", "content", "on_missing_env"}, "warn")
	if behavior == "ignore" {
		return nil
	}
	severity := protocol.DiagnosticSeverityWarning
	if behavior == "throw" {
		severity = protocol.DiagnosticSeverityError
	}
	defined := definedEnvNames(root)
	lines := strings.Split(text, "\n")
	var diags []protocol.Diagnostic
	for _, ref := range scanEnvRefs(text) {
		if defined[ref.name] {
			continue
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, ref.start, ref.end),
			Severity: severity,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String("Unset env var \"{env." + ref.name + "}\" (not set in the environment or the project's .env files)"),
		})
	}
	return diags
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

// validationIssues turns a schema validation failure into
// structured issues: the diagnostic, plus the valid values for
// an enum mismatch and the unknown key for an unknown key. The
// ranges are in frontmatter-slice coordinates; the caller shifts
// them into the document.
func validationIssues(verr *jsonschema.ValidationError, root *yaml.Node, lines []string) []frontmatterIssue {
	var issues []frontmatterIssue
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
		issue := frontmatterIssue{}
		var node *yaml.Node
		if additional, ok := e.ErrorKind.(*kind.AdditionalProperties); ok && len(additional.Properties) > 0 {
			// An unknown key: point at the key itself.
			key, value := yamlLookup(root, append(append([]string{}, e.InstanceLocation...), additional.Properties[0]))
			node = key
			issue.unknownKey = additional.Properties[0]
			issue.unknownScalar = value == nil || value.Kind == yaml.ScalarNode
		} else {
			// Anything else: point at the value.
			_, node = yamlLookup(root, e.InstanceLocation)
			if enumErr, ok := e.ErrorKind.(*kind.Enum); ok {
				for _, want := range enumErr.Want {
					if s, ok := want.(string); ok {
						issue.enum = append(issue.enum, s)
					}
				}
			}
		}
		issue.diag = protocol.Diagnostic{
			Range:    nodeRange(node, lines),
			Severity: protocol.DiagnosticSeverityError,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(message),
		}
		issues = append(issues, issue)
	}
	walk(verr)
	return issues
}
