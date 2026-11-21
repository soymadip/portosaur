package main

import (
	"regexp"
	"strings"
)

// An HTML tag usable as a JSX intrinsic. Void elements take no
// closing tag, which the full-tag insert uses. desc is the short
// description the editor shows beside the tag in the suggestion
// list, a few words on what the tag does.
type htmlTag struct {
	name string
	void bool
	desc string
}

// htmlTags is the fixed list of HTML tags offered after `<`,
// in one place so the tag insert shares it. Only tags that make
// sense inside an MDX page are here: document-shell tags (html,
// head, body, title, base, meta, link, style, script), obsolete
// elements (font, center, marquee and friends), and tags with no
// use inside page content (noscript, template, slot, object,
// embed, param, area, map) are left out.
var htmlTags = []htmlTag{
	{name: "a", desc: "Link"},
	{name: "abbr", desc: "Abbreviation"},
	{name: "address", desc: "Contact info"},
	{name: "article", desc: "Self-contained article"},
	{name: "aside", desc: "Side content"},
	{name: "audio", desc: "Audio player"},
	{name: "b", desc: "Bold text"},
	{name: "bdi", desc: "Isolated text direction"},
	{name: "bdo", desc: "Text direction override"},
	{name: "blockquote", desc: "Quoted block"},
	{name: "br", void: true, desc: "Line break"},
	{name: "button", desc: "Clickable button"},
	{name: "canvas", desc: "Drawing canvas"},
	{name: "caption", desc: "Table caption"},
	{name: "cite", desc: "Cited work title"},
	{name: "code", desc: "Inline code"},
	{name: "col", void: true, desc: "Table column"},
	{name: "colgroup", desc: "Table column group"},
	{name: "data", desc: "Machine-readable value"},
	{name: "datalist", desc: "Input suggestions"},
	{name: "dd", desc: "Definition description"},
	{name: "del", desc: "Deleted text"},
	{name: "details", desc: "Disclosure widget"},
	{name: "dfn", desc: "Term definition"},
	{name: "dialog", desc: "Dialog box"},
	{name: "div", desc: "Generic container"},
	{name: "dl", desc: "Description list"},
	{name: "dt", desc: "Definition term"},
	{name: "em", desc: "Emphasized text"},
	{name: "fieldset", desc: "Form field group"},
	{name: "figcaption", desc: "Figure caption"},
	{name: "figure", desc: "Figure with caption"},
	{name: "footer", desc: "Page footer"},
	{name: "form", desc: "Form"},
	{name: "h1", desc: "Top-level heading"},
	{name: "h2", desc: "Second-level heading"},
	{name: "h3", desc: "Third-level heading"},
	{name: "h4", desc: "Fourth-level heading"},
	{name: "h5", desc: "Fifth-level heading"},
	{name: "h6", desc: "Sixth-level heading"},
	{name: "header", desc: "Page header"},
	{name: "hgroup", desc: "Heading group"},
	{name: "hr", void: true, desc: "Horizontal rule"},
	{name: "i", desc: "Italic text"},
	{name: "iframe", desc: "Embedded page"},
	{name: "img", void: true, desc: "Image"},
	{name: "input", void: true, desc: "Form input"},
	{name: "ins", desc: "Inserted text"},
	{name: "kbd", desc: "Keyboard input"},
	{name: "label", desc: "Form label"},
	{name: "legend", desc: "Fieldset caption"},
	{name: "li", desc: "List item"},
	{name: "main", desc: "Main content"},
	{name: "mark", desc: "Highlighted text"},
	{name: "menu", desc: "Menu list"},
	{name: "meter", desc: "Gauge value"},
	{name: "nav", desc: "Navigation links"},
	{name: "ol", desc: "Ordered list"},
	{name: "optgroup", desc: "Option group"},
	{name: "option", desc: "Dropdown option"},
	{name: "output", desc: "Calculation result"},
	{name: "p", desc: "Paragraph"},
	{name: "picture", desc: "Responsive image"},
	{name: "pre", desc: "Preformatted text"},
	{name: "progress", desc: "Progress bar"},
	{name: "q", desc: "Inline quote"},
	{name: "rp", desc: "Ruby fallback"},
	{name: "rt", desc: "Ruby annotation"},
	{name: "ruby", desc: "Ruby annotation"},
	{name: "s", desc: "Struck-through text"},
	{name: "samp", desc: "Sample output"},
	{name: "search", desc: "Search section"},
	{name: "section", desc: "Page section"},
	{name: "select", desc: "Dropdown list"},
	{name: "small", desc: "Small text"},
	{name: "source", void: true, desc: "Media source"},
	{name: "span", desc: "Inline container"},
	{name: "strong", desc: "Important text"},
	{name: "sub", desc: "Subscript"},
	{name: "summary", desc: "Details summary"},
	{name: "sup", desc: "Superscript"},
	{name: "svg", desc: "Vector graphic"},
	{name: "table", desc: "Table"},
	{name: "tbody", desc: "Table body"},
	{name: "td", desc: "Table cell"},
	{name: "textarea", desc: "Multi-line input"},
	{name: "tfoot", desc: "Table footer"},
	{name: "th", desc: "Table header cell"},
	{name: "thead", desc: "Table header"},
	{name: "time", desc: "Date or time"},
	{name: "tr", desc: "Table row"},
	{name: "track", void: true, desc: "Media text track"},
	{name: "u", desc: "Underlined text"},
	{name: "ul", desc: "Unordered list"},
	{name: "var", desc: "Variable name"},
	{name: "video", desc: "Video player"},
	{name: "wbr", void: true, desc: "Line-break opportunity"},
}

// importedComponent is one name the document imports: the name
// usable as a tag, and the module it comes from.
type importedComponent struct {
	name   string
	source string
}

// importStmtRe matches one import statement, possibly spanning
// lines: the bindings between `import` and `from`, and the
// module specifier in quotes.
var importStmtRe = regexp.MustCompile(`(?s)^import\s*(.+?)\s+from\s+['"]([^'"]+)['"]`)

// scanImports parses the document's import statements and
// returns the imported component names, in document order.
// Type-only imports and namespace imports offer no tag names.
// Imports inside the frontmatter or a fenced code block are
// examples, not real imports, and are skipped.
func scanImports(text string) []importedComponent {
	lines := strings.Split(text, "\n")
	contentStart := 0
	if block, ok := extractFrontmatter(text); ok {
		if !block.closed {
			return nil
		}
		contentStart = block.endLine + 1
	}
	fences := fenceLines(lines, contentStart)

	var imports []importedComponent
	for i := contentStart; i < len(lines); {
		if fences[i] {
			i++
			continue
		}
		trimmed := strings.TrimSpace(lines[i])
		if !strings.HasPrefix(trimmed, "import") {
			i++
			continue
		}
		rest := trimmed[len("import"):]
		if rest == "" || (rest[0] != ' ' && rest[0] != '\t' && rest[0] != '{' && rest[0] != '*') {
			// `important` and friends are prose, not
			// imports, and `import './x'` has no bindings.
			i++
			continue
		}
		// An import statement may span lines: gather lines
		// until the `from '...'` clause, a `;`, a blank
		// line, or a fence. A malformed import just yields
		// no bindings.
		stmt := trimmed
		j := i
		for !importStmtRe.MatchString(stmt) && !strings.Contains(stmt, ";") && j-i < 30 && j+1 < len(lines) && !fences[j+1] && strings.TrimSpace(lines[j+1]) != "" {
			j++
			stmt += "\n" + lines[j]
		}
		i = j + 1
		imports = append(imports, parseImportBindings(stmt)...)
	}
	return imports
}

// parseImportBindings turns one import statement into its
// usable tag names. The bindings between `import` and `from`
// hold a default name, a `{...}` list of named imports, or
// both. `import type` and `import * as` offer nothing, and
// neither do `type` specifiers inside the braces. An aliased
// import (`Orig as Alias`) offers the alias, the name the
// document can actually use as a tag.
func parseImportBindings(stmt string) []importedComponent {
	match := importStmtRe.FindStringSubmatch(stmt)
	if match == nil {
		return nil
	}
	bindings := strings.TrimSpace(match[1])
	source := match[2]
	if strings.HasPrefix(bindings, "type ") || strings.HasPrefix(bindings, "type\t") || strings.HasPrefix(bindings, "type\n") || strings.HasPrefix(bindings, "type{") {
		return nil
	}
	var names []string
	if open := strings.Index(bindings, "{"); open >= 0 {
		// The default name is the part before the brace.
		if def := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(bindings[:open]), ",")); def != "" && !strings.HasPrefix(def, "*") && isIdent(def) {
			names = append(names, def)
		}
		close := strings.Index(bindings[open:], "}")
		if close < 0 {
			return nil
		}
		for _, spec := range strings.Split(bindings[open+1:open+close], ",") {
			spec = strings.TrimSpace(spec)
			if spec == "" || strings.HasPrefix(spec, "type ") || strings.HasPrefix(spec, "type\t") {
				continue
			}
			if as := strings.Index(spec, " as "); as >= 0 {
				spec = strings.TrimSpace(spec[as+len(" as "):])
			}
			if isIdent(spec) {
				names = append(names, spec)
			}
		}
	} else {
		// No braces: a default name, a namespace import, or
		// a default plus a namespace import.
		if comma := strings.Index(bindings, ","); comma >= 0 {
			bindings = strings.TrimSpace(bindings[:comma])
		}
		if strings.HasPrefix(bindings, "*") {
			return nil
		}
		if isIdent(bindings) {
			names = append(names, bindings)
		}
	}
	var imports []importedComponent
	for _, name := range names {
		imports = append(imports, importedComponent{name: name, source: source})
	}
	return imports
}

// isIdent reports whether s is a plain JS identifier.
func isIdent(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c == '_' || c == '$' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (i > 0 && c >= '0' && c <= '9') {
			continue
		}
		return false
	}
	return true
}
