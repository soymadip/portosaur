package main

import (
	"strings"

	"go.lsp.dev/protocol"
)

// Frontmatter: the YAML block at the top of an MDX document. The
// YAML engine works on the block's slice of the document, and
// every position it returns is shifted down by the block's start
// line to land back in the document.

type frontmatterBlock struct {
	yaml      string // the YAML text between the fences
	startLine int    // document line of the first YAML line
	endLine   int    // document line of the closing fence (or the line count, unclosed)
	closed    bool   // a closing fence was found
}

// extractFrontmatter finds the `---` block at the top of an MDX
// document. The first line must be the opening fence; the block
// ends at the next line that is only `---`. ok is false when the
// document has no frontmatter at all. A block with no closing
// fence yet (the user is still typing) runs to the end of the
// file: completion works on what is there, diagnostics stay off
// because the YAML cannot be told apart from the prose below it.
func extractFrontmatter(text string) (frontmatterBlock, bool) {
	lines := strings.Split(text, "\n")
	if len(lines) == 0 || !isFence(lines[0]) {
		return frontmatterBlock{}, false
	}
	block := frontmatterBlock{startLine: 1, endLine: len(lines)}
	for i := 1; i < len(lines); i++ {
		if isFence(lines[i]) {
			block.endLine = i
			block.closed = true
			break
		}
	}
	block.yaml = strings.Join(lines[1:block.endLine], "\n")
	return block, true
}

// isFence reports whether the line is a `---` fence: exactly
// three dashes, trailing whitespace allowed, nothing before
// them.
func isFence(line string) bool {
	return strings.TrimRight(line, " \t\r") == "---"
}

// contains reports whether the cursor line falls inside the
// block's YAML lines.
func (b frontmatterBlock) contains(line uint32) bool {
	return int(line) >= b.startLine && int(line) < b.endLine
}

// shiftRange moves a range down by the given number of lines:
// positions computed on the YAML slice, whose line 0 is the
// document's line 1, land back in the document.
func shiftRange(r protocol.Range, lines int) protocol.Range {
	return protocol.Range{
		Start: protocol.Position{Line: r.Start.Line + uint32(lines), Character: r.Start.Character},
		End:   protocol.Position{Line: r.End.Line + uint32(lines), Character: r.End.Character},
	}
}

// shiftDiagnostics moves every diagnostic in the list down by
// the given number of lines.
func shiftDiagnostics(diags []protocol.Diagnostic, lines int) []protocol.Diagnostic {
	for i := range diags {
		diags[i].Range = shiftRange(diags[i].Range, lines)
	}
	return diags
}

// shiftCompletionList moves every text edit in the list down by
// the given number of lines.
func shiftCompletionList(list *protocol.CompletionList, lines int) *protocol.CompletionList {
	for i := range list.Items {
		if edit, ok := list.Items[i].TextEdit.(*protocol.TextEdit); ok {
			edit.Range = shiftRange(edit.Range, lines)
		}
	}
	return list
}
