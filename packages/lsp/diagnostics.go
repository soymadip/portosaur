package main

import (
	"context"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/santhosh-tekuri/jsonschema/v6/kind"
	"go.lsp.dev/protocol"
	"go.lsp.dev/uri"
	"gopkg.in/yaml.v3"
)

// Diagnostics for MDX documents: frontmatter YAML (syntax errors
// always, schema validation only in strict mode) plus component
// checks, `{vars.}` and `{env.}` reference checks, broken-link
// and broken-image checks over the page body, undefined
// reference-style link warnings, duplicate-slug checks against
// the project's pages, and H1/title interaction checks. The
// schema-based component checks (unknown components, missing
// required props) are strict-only too — the website's schema is
// the latest release's, which cannot be tied to the project's
// version. The icon, slug, and duplicate-slug checks are static
// rules, not schema-based, so they run in both modes. An unclosed
// frontmatter block gets no frontmatter diagnostics:
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
	for _, diag := range s.linkIssues(text, root, uriPath(documentURI)) {
		diags = append(diags, diag)
	}
	for _, diag := range s.refIssues(text) {
		diags = append(diags, diag)
	}
	for _, diag := range s.imageIssues(text, root, uriPath(documentURI)) {
		diags = append(diags, diag)
	}
	for _, diag := range s.duplicateSlugIssues(text, root, uriPath(documentURI)) {
		diags = append(diags, diag)
	}
	for _, issue := range s.duplicateHeadingIssues(text, root) {
		diags = append(diags, issue.diag)
	}
	for _, issue := range s.h1TitleIssues(text) {
		diags = append(diags, issue.diag)
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
	for _, diag := range frontmatterSlugDiagnostics(rootNode, lines, block.startLine) {
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

// frontmatterSlugDiagnostics checks the frontmatter `slug` key,
// if it holds a plain string. A slug only renames the file's own
// segment, so a value containing a slash fails the build. The
// check is static, so it runs in both modes; the schema's own
// pattern error for the same value is skipped in
// validationIssues, so the slug is flagged exactly once.
func frontmatterSlugDiagnostics(rootNode *yaml.Node, lines []string, lineOffset int) []protocol.Diagnostic {
	_, value := yamlLookup(rootNode, []string{"slug"})
	if value == nil || value.Kind != yaml.ScalarNode {
		return nil
	}
	if !strings.Contains(value.Value, "/") {
		return nil
	}
	return shiftDiagnostics([]protocol.Diagnostic{{
		Range:    nodeRange(value, lines),
		Severity: protocol.DiagnosticSeverityError,
		Source:   protocol.NewOptional("porto-lsp"),
		Message:  protocol.String("Slug \"" + value.Value + "\" must be a single segment with no \"/\": it only renames the file"),
	}}, lineOffset)
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

// linkIssues checks every internal link in the document body:
// markdown links, reference-definition destinations, and
// Link/Btn link prop values. A clean URL no page serves, or a
// relative path with no file behind it, is broken. The
// severity follows site.content.on_broken_links: throw is an
// error, warn is a warning, ignore reports nothing. The
// default is throw, and an unrecognized value falls back to
// it. The check reads porto.yml directly, not a schema, so it
// runs in both modes. A definition feeding image uses only is
// an image src, not a link — the image check covers it.
func (s *Server) linkIssues(text string, root string, currentFile string) []protocol.Diagnostic {
	cfg := loadProjectConfig(root)
	behavior := configString(cfg, []string{"site", "content", "on_broken_links"}, "throw")
	if behavior == "ignore" {
		return nil
	}
	severity := protocol.DiagnosticSeverityError
	if behavior == "warn" {
		severity = protocol.DiagnosticSeverityWarning
	}
	lines := strings.Split(text, "\n")
	var diags []protocol.Diagnostic
	for _, dest := range scanMarkdownLinks(text) {
		if !s.linkBroken(root, currentFile, dest.value) {
			continue
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, dest.start, dest.end),
			Severity: severity,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(linkBrokenMessage(dest.value)),
		})
	}
	defs := scanRefDefinitions(text)
	uses := scanRefUses(text, defs)
	for _, def := range defs {
		if refDefImageOnly(def, uses) {
			continue
		}
		if !s.linkBroken(root, currentFile, def.dest) {
			continue
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, def.destStart, def.destEnd),
			Severity: severity,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(linkBrokenMessage(def.dest)),
		})
	}
	for _, tag := range scanAllTags(text) {
		if tag.name != "Link" && tag.name != "Btn" {
			continue
		}
		for _, prop := range tag.props {
			if !linkProps[tag.name][prop.name] || !prop.hasValue || prop.expr {
				continue
			}
			value := text[prop.valueStart:prop.valueEnd]
			if !s.linkBroken(root, currentFile, value) {
				continue
			}
			diags = append(diags, protocol.Diagnostic{
				Range:    rangeFromOffsets(lines, prop.valueStart, prop.valueEnd),
				Severity: severity,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String(linkBrokenMessage(value)),
			})
		}
	}
	return diags
}

// linkBrokenMessage names the destination and says why it is
// broken: a clean URL no page serves, or a relative path with
// no file behind it.
func linkBrokenMessage(value string) string {
	path, _, _ := strings.Cut(value, "#")
	if strings.HasPrefix(path, "/") {
		return "Broken link \"" + value + "\" (no page serves this URL)"
	}
	return "Broken link \"" + value + "\" (no such file)"
}

// refIssues warns about reference-style link and image uses
// with no matching `[ref]:` definition: the build renders the
// brackets as plain text. Always a warning — an undefined ref
// is not a broken link, so on_broken_links does not govern it.
// The check reads the document directly, not a schema, so it
// runs in both modes.
func (s *Server) refIssues(text string) []protocol.Diagnostic {
	defs := scanRefDefinitions(text)
	defined := map[string]bool{}
	for _, def := range defs {
		defined[normalizeRefLabel(def.label)] = true
	}
	lines := strings.Split(text, "\n")
	var diags []protocol.Diagnostic
	for _, use := range scanRefUses(text, defs) {
		if defined[normalizeRefLabel(use.label)] {
			continue
		}
		kind := "link"
		if use.image {
			kind = "image"
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, use.labelStart, use.labelEnd),
			Severity: protocol.DiagnosticSeverityWarning,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String("Undefined " + kind + " reference \"[" + use.label + "]\" (no matching definition)"),
		})
	}
	return diags
}

// imageIssues checks every image in the document body:
// markdown images, reference-definition destinations feeding
// image uses only, and `<img src="...">` tags. A relative src
// with no file behind it, or an absolute src with no file under
// the project's `static/` directory, is broken. The severity
// follows site.content.on_broken_images: throw is an error, warn
// is a warning, ignore reports nothing. The default is throw,
// and an unrecognized value falls back to it. The check reads
// porto.yml directly, not a schema, so it runs in both modes.
func (s *Server) imageIssues(text string, root string, currentFile string) []protocol.Diagnostic {
	cfg := loadProjectConfig(root)
	behavior := configString(cfg, []string{"site", "content", "on_broken_images"}, "throw")
	if behavior == "ignore" {
		return nil
	}
	severity := protocol.DiagnosticSeverityError
	if behavior == "warn" {
		severity = protocol.DiagnosticSeverityWarning
	}
	lines := strings.Split(text, "\n")
	var diags []protocol.Diagnostic
	for _, dest := range scanMarkdownImages(text) {
		if !imageBroken(root, currentFile, dest.value) {
			continue
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, dest.start, dest.end),
			Severity: severity,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(imageBrokenMessage(dest.value)),
		})
	}
	defs := scanRefDefinitions(text)
	uses := scanRefUses(text, defs)
	for _, def := range defs {
		if !refDefImageOnly(def, uses) {
			continue
		}
		if !imageBroken(root, currentFile, def.dest) {
			continue
		}
		diags = append(diags, protocol.Diagnostic{
			Range:    rangeFromOffsets(lines, def.destStart, def.destEnd),
			Severity: severity,
			Source:   protocol.NewOptional("porto-lsp"),
			Message:  protocol.String(imageBrokenMessage(def.dest)),
		})
	}
	for _, tag := range scanAllTags(text) {
		if tag.name != "img" {
			continue
		}
		for _, prop := range tag.props {
			if prop.name != "src" || !prop.hasValue || prop.expr {
				continue
			}
			value := text[prop.valueStart:prop.valueEnd]
			if !imageBroken(root, currentFile, value) {
				continue
			}
			diags = append(diags, protocol.Diagnostic{
				Range:    rangeFromOffsets(lines, prop.valueStart, prop.valueEnd),
				Severity: severity,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String(imageBrokenMessage(value)),
			})
		}
	}
	return diags
}

// imageBrokenMessage names the src and says the file is
// missing.
func imageBrokenMessage(value string) string {
	return "Broken image \"" + value + "\" (no such file)"
}

// duplicateSlugIssues warns when another page in the project
// serves the same URL as this document. The build throws on
// duplicate slugs, so this is early editor feedback, always a
// warning — no porto.yml setting governs it. The check reads
// the project files directly, not a schema, so it runs in both
// modes. The page index is built from disk, so an unsaved
// change to another file's slug does not show up until that
// file is saved.
func (s *Server) duplicateSlugIssues(text string, root string, currentFile string) []protocol.Diagnostic {
	index := s.pages.forRoot(root)
	url, ok := index.urlFor(currentFile)
	if !ok {
		return nil
	}
	var other string
	for _, file := range index.filesAt(url) {
		if file != currentFile {
			other = file
			break
		}
	}
	if other == "" {
		return nil
	}
	rel, err := filepath.Rel(root, other)
	if err != nil {
		rel = other
	}
	return []protocol.Diagnostic{{
		Range:    duplicateSlugRange(text),
		Severity: protocol.DiagnosticSeverityWarning,
		Source:   protocol.NewOptional("porto-lsp"),
		Message:  protocol.String("Duplicate slug: this page and " + filepath.ToSlash(rel) + " both serve " + url),
	}}
}

// duplicateHeadingIssue is one duplicate heading: the
// diagnostic plus the id a quick fix inserts as a custom id.
// fixID is empty for a shared custom id, where no fix is
// offered — the user picks a new id themselves.
type duplicateHeadingIssue struct {
	diag  protocol.Diagnostic
	fixID string
}

// duplicateHeadingIssues warns on a heading whose id repeats an
// earlier heading's id in the same document, at any level. The
// site dedups plain repeats with a `-1` suffix, so a link to
// the plain id reaches the first heading, not this one; custom
// ids are not deduped at all, so two headings share the id
// outright. The LSP checks every level, unlike the build (h2
// only): in the editor a duplicate is one click from fixed, so
// flagging more is useful rather than noise. The severity
// follows site.content.on_duplicate_h2: throw is an error, warn
// is a warning, ignore reports nothing. The default is warn,
// and an unrecognized value falls back to it. The check reads
// porto.yml directly, not a schema, so it runs in both modes.
func (s *Server) duplicateHeadingIssues(text string, root string) []duplicateHeadingIssue {
	cfg := loadProjectConfig(root)
	behavior := configString(cfg, []string{"site", "content", "on_duplicate_h2"}, "warn")
	if behavior == "ignore" {
		return nil
	}
	severity := protocol.DiagnosticSeverityWarning
	if behavior == "throw" {
		severity = protocol.DiagnosticSeverityError
	}
	lines := strings.Split(text, "\n")
	firstSeen := map[string]int{}
	var issues []duplicateHeadingIssue
	for _, h := range extractHeadings(text) {
		firstLine, ok := firstSeen[h.baseID]
		if !ok {
			firstSeen[h.baseID] = h.line
			continue
		}
		var msg string
		var fixID string
		if h.id == h.baseID {
			msg = "Duplicate heading id \"" + h.baseID + "\": two headings share it (first on line " + strconv.Itoa(firstLine+1) + ")"
		} else {
			msg = "Duplicate heading \"" + h.text + "\": this one gets the id \"" + h.id + "\" (first on line " + strconv.Itoa(firstLine+1) + ")"
			fixID = h.id
		}
		issues = append(issues, duplicateHeadingIssue{
			diag: protocol.Diagnostic{
				Range:    headingTextRange(lines, h),
				Severity: severity,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String(msg),
			},
			fixID: fixID,
		})
	}
	return issues
}

// h1TitleIssue is one H1/title problem: the diagnostic plus
// the hoisted H1's plain text, which the "Move to frontmatter
// title" quick fix needs. Only the hint carries it — the
// warning and the error have no fix.
type h1TitleIssue struct {
	diag      protocol.Diagnostic
	titleText string
}

// h1TitleIssues checks the H1s of a document against the
// frontmatter title, following the build's title rule: the
// first top-level heading, when it is depth 1, leaves the body
// and becomes the page title H1. Three fixed-severity rules: a
// frontmatter title plus a hoisted H1 warns that the H1
// overrides the title for the visible heading; an H1 that
// renders in place while another H1 is visible is an error; a
// hoisted H1 with no frontmatter title is a hint suggesting the
// title key instead, with a quick fix that moves it there.
// hide_title hides the visible title, so the warning and the
// hint stay quiet, and a lone in-place H1 is the only visible
// H1. The check reads the document directly, not a schema, so
// it runs in both modes. An empty H1 (no plain text) hoists no
// title and renders nowhere, so it is neither the hoisted H1
// nor an in-place one.
func (s *Server) h1TitleIssues(text string) []h1TitleIssue {
	headings := extractHeadings(text)
	if len(headings) == 0 {
		return nil
	}
	hasTitle, hideTitle := frontmatterTitleState(text)
	lines := strings.Split(text, "\n")
	var issues []h1TitleIssue
	firstIsH1 := headings[0].level == 1
	var hoisted *heading
	if firstIsH1 && strings.TrimSpace(headings[0].text) != "" {
		hoisted = &headings[0]
	}
	if hoisted != nil && !hideTitle {
		issue := h1TitleIssue{diag: protocol.Diagnostic{
			Range:  headingTextRange(lines, *hoisted),
			Source: protocol.NewOptional("porto-lsp"),
		}}
		if hasTitle {
			issue.diag.Severity = protocol.DiagnosticSeverityWarning
			issue.diag.Message = protocol.String("This H1 overrides the frontmatter title (the page heading shows this text, not the title)")
		} else {
			issue.diag.Severity = protocol.DiagnosticSeverityHint
			issue.diag.Message = protocol.String("Consider using the `title` frontmatter key instead of an H1 for the page title")
			issue.titleText = hoisted.text
		}
		issues = append(issues, issue)
	}
	inPlace := 0
	for i, h := range headings {
		if h.level != 1 || (firstIsH1 && i == 0) {
			continue
		}
		if !hideTitle || inPlace > 0 {
			issues = append(issues, h1TitleIssue{diag: protocol.Diagnostic{
				Range:    headingTextRange(lines, h),
				Severity: protocol.DiagnosticSeverityError,
				Source:   protocol.NewOptional("porto-lsp"),
				Message:  protocol.String("This page already has an H1"),
			}})
		}
		inPlace++
	}
	return issues
}

// frontmatterTitleState reads the `title` and `hide_title`
// keys from a closed frontmatter block: whether a non-empty
// title is set, and whether the title is hidden. An unclosed
// block, a missing block, or unparsable YAML reports neither.
func frontmatterTitleState(text string) (hasTitle, hideTitle bool) {
	block, ok := extractFrontmatter(text)
	if !ok || !block.closed {
		return false, false
	}
	rootNode, err := parseYAML(block.yaml)
	if err != nil || rootNode == nil {
		return false, false
	}
	if _, value := yamlLookup(rootNode, []string{"title"}); value != nil && value.Kind == yaml.ScalarNode && strings.TrimSpace(value.Value) != "" {
		hasTitle = true
	}
	if _, value := yamlLookup(rootNode, []string{"hide_title"}); value != nil && value.Tag == "!!bool" && value.Value == "true" {
		hideTitle = true
	}
	return hasTitle, hideTitle
}

// duplicateSlugRange points at the frontmatter `slug:` value
// when the document has one — that is what the user changes to
// fix the collision — and at the first line otherwise.
func duplicateSlugRange(text string) protocol.Range {
	lines := strings.Split(text, "\n")
	firstLine := protocol.Range{
		Start: protocol.Position{Line: 0, Character: 0},
		End:   protocol.Position{Line: 0, Character: utf16Len(lines[0])},
	}
	block, ok := extractFrontmatter(text)
	if !ok || !block.closed {
		return firstLine
	}
	rootNode, err := parseYAML(block.yaml)
	if err != nil || rootNode == nil {
		return firstLine
	}
	_, value := yamlLookup(rootNode, []string{"slug"})
	if value == nil || value.Kind != yaml.ScalarNode {
		return firstLine
	}
	return shiftRange(nodeRange(value, strings.Split(block.yaml, "\n")), block.startLine)
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
		if _, ok := e.ErrorKind.(*kind.Pattern); ok && len(e.InstanceLocation) == 1 && e.InstanceLocation[0] == "slug" {
			// A slug with a slash is already flagged by
			// frontmatterSlugDiagnostics with a clearer
			// message, in both modes, so the schema's
			// pattern error for the same value is skipped.
			// Other pattern failures (a slug with no letter
			// or digit) still come through here.
			if _, value := yamlLookup(root, e.InstanceLocation); value != nil && strings.Contains(value.Value, "/") {
				return
			}
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
