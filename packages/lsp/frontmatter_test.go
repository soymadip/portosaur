package main

import (
	"testing"
)

func TestExtractFrontmatterClosed(t *testing.T) {
	block, ok := extractFrontmatter("---\ntitle: Hello\n---\n# Hello\n")
	if !ok {
		t.Fatal("no frontmatter found")
	}
	if !block.closed {
		t.Fatal("block is not closed")
	}
	if block.yaml != "title: Hello" {
		t.Fatalf("yaml = %q, want %q", block.yaml, "title: Hello")
	}
	if block.startLine != 1 || block.endLine != 2 {
		t.Fatalf("startLine = %d, endLine = %d, want 1 and 2", block.startLine, block.endLine)
	}
	if !block.contains(1) || block.contains(0) || block.contains(2) {
		t.Fatal("contains() is wrong about the block's lines")
	}
}

func TestExtractFrontmatterUnclosed(t *testing.T) {
	block, ok := extractFrontmatter("---\ntitle: Hello\n# Hello\n")
	if !ok {
		t.Fatal("no frontmatter found")
	}
	if block.closed {
		t.Fatal("block is closed, want unclosed")
	}
	if block.yaml != "title: Hello\n# Hello\n" {
		t.Fatalf("yaml = %q, want the rest of the file", block.yaml)
	}
	if block.endLine != 4 {
		t.Fatalf("endLine = %d, want 4 (the line count)", block.endLine)
	}
	if !block.contains(2) {
		t.Fatal("line 2 is not in the unclosed block")
	}
}

func TestExtractFrontmatterNone(t *testing.T) {
	for _, text := range []string{
		"",
		"# Hello\n",
		"title: Hello\n---\n",
		" ---\ntitle: Hello\n---\n",
	} {
		if _, ok := extractFrontmatter(text); ok {
			t.Fatalf("extractFrontmatter(%q) found a block, want none", text)
		}
	}
}

func TestExtractFrontmatterEmpty(t *testing.T) {
	block, ok := extractFrontmatter("---\n---\n# Hello\n")
	if !ok || !block.closed {
		t.Fatal("no closed empty block found")
	}
	if block.yaml != "" {
		t.Fatalf("yaml = %q, want empty", block.yaml)
	}
}

func TestExtractFrontmatterFenceWhitespace(t *testing.T) {
	block, ok := extractFrontmatter("---\ntitle: x\n---  \n# Hello\n")
	if !ok || !block.closed {
		t.Fatal("a closing fence with trailing spaces was not found")
	}
	if block.yaml != "title: x" {
		t.Fatalf("yaml = %q, want %q", block.yaml, "title: x")
	}
}
