package main

import (
	"regexp"
	"strings"
)

// An HTML tag usable as a JSX intrinsic. Void elements take no
// closing tag, which the full-tag insert uses.
type htmlTag struct {
	name string
	void bool
}

// htmlTags is the fixed list of standard HTML tags offered
// after `<`, in one place so the tag insert shares it. Obsolete
// elements (font, center, marquee and friends) are left out.
var htmlTags = []htmlTag{
	{name: "a"},
	{name: "abbr"},
	{name: "address"},
	{name: "area", void: true},
	{name: "article"},
	{name: "aside"},
	{name: "audio"},
	{name: "b"},
	{name: "base", void: true},
	{name: "bdi"},
	{name: "bdo"},
	{name: "blockquote"},
	{name: "body"},
	{name: "br", void: true},
	{name: "button"},
	{name: "canvas"},
	{name: "caption"},
	{name: "cite"},
	{name: "code"},
	{name: "col", void: true},
	{name: "colgroup"},
	{name: "data"},
	{name: "datalist"},
	{name: "dd"},
	{name: "del"},
	{name: "details"},
	{name: "dfn"},
	{name: "dialog"},
	{name: "div"},
	{name: "dl"},
	{name: "dt"},
	{name: "em"},
	{name: "embed", void: true},
	{name: "fieldset"},
	{name: "figcaption"},
	{name: "figure"},
	{name: "footer"},
	{name: "form"},
	{name: "h1"},
	{name: "h2"},
	{name: "h3"},
	{name: "h4"},
	{name: "h5"},
	{name: "h6"},
	{name: "head"},
	{name: "header"},
	{name: "hgroup"},
	{name: "hr", void: true},
	{name: "html"},
	{name: "i"},
	{name: "iframe"},
	{name: "img", void: true},
	{name: "input", void: true},
	{name: "ins"},
	{name: "kbd"},
	{name: "label"},
	{name: "legend"},
	{name: "li"},
	{name: "link", void: true},
	{name: "main"},
	{name: "map"},
	{name: "mark"},
	{name: "menu"},
	{name: "meta", void: true},
	{name: "meter"},
	{name: "nav"},
	{name: "noscript"},
	{name: "object"},
	{name: "ol"},
	{name: "optgroup"},
	{name: "option"},
	{name: "output"},
	{name: "p"},
	{name: "param", void: true},
	{name: "picture"},
	{name: "pre"},
	{name: "progress"},
	{name: "q"},
	{name: "rp"},
	{name: "rt"},
	{name: "ruby"},
	{name: "s"},
	{name: "samp"},
	{name: "script"},
	{name: "search"},
	{name: "section"},
	{name: "select"},
	{name: "slot"},
	{name: "small"},
	{name: "source", void: true},
	{name: "span"},
	{name: "strong"},
	{name: "style"},
	{name: "sub"},
	{name: "summary"},
	{name: "sup"},
	{name: "svg"},
	{name: "table"},
	{name: "tbody"},
	{name: "td"},
	{name: "template"},
	{name: "textarea"},
	{name: "tfoot"},
	{name: "th"},
	{name: "thead"},
	{name: "time"},
	{name: "title"},
	{name: "tr"},
	{name: "track", void: true},
	{name: "u"},
	{name: "ul"},
	{name: "var"},
	{name: "video"},
	{name: "wbr", void: true},
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
