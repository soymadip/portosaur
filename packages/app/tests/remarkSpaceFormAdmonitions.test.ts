import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import remarkStringify from "remark-stringify";
import remarkSpaceFormAdmonitions from "../src/plugins/remarkSpaceFormAdmonitions.ts";

/**
 * `remarkSpaceFormAdmonitions` turns the MDX v1-style space-form
 * fence (`:::note Title` … `:::`) into the same callout `<div>`s
 * `remarkAdmonitions` emits for the bracket form. Docusaurus
 * supports this form through a string preprocessor
 * (`admonitionTitleToDirectiveLabel`, rewriting the opener to
 * `:::note[Title]` before parsing); Astro has no such hook, so this
 * plugin converts the plain paragraphs remark-directive leaves
 * behind (its tokenizer requires a line ending after the fence).
 *
 * These tests parse real MDX (not hand-built trees): the paragraph
 * shape — soft breaks as `\n` inside text values, formatting split
 * across inline nodes — is exactly what the plugin reads.
 */

function parse(mdx: string): any {
  return unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkDirective)
    .parse(mdx);
}

function transform(mdx: string): any {
  const tree = parse(mdx);
  remarkSpaceFormAdmonitions()(tree);
  return tree;
}

function stringify(tree: any): string {
  return String(unified().use(remarkStringify).use(remarkMdx).stringify(tree));
}

function findAdmonitions(tree: any): any[] {
  const found: any[] = [];
  function walk(node: any): void {
    if (
      node.type === "mdxJsxFlowElement" &&
      node.name === "div" &&
      node.attributes?.some(
        (attr: any) =>
          attr.name === "className" &&
          typeof attr.value === "string" &&
          attr.value.startsWith("admonition "),
      )
    ) {
      found.push(node);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(tree);
  return found;
}

function classOf(admonition: any): string {
  return admonition.attributes.find((attr: any) => attr.name === "className")
    .value;
}

function headingText(admonition: any): string {
  const heading = admonition.children[0];
  const texts: string[] = [];
  function walk(node: any): void {
    if (node.type === "text") {
      texts.push(node.value);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(heading);
  return texts.join("");
}

function contentText(admonition: any): string {
  const content = admonition.children[1];
  const texts: string[] = [];
  function walk(node: any): void {
    if (node.type === "text") {
      texts.push(node.value);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  walk(content);
  return texts.join("");
}

describe("remarkSpaceFormAdmonitions", () => {
  test("converts a single-paragraph space-form fence", () => {
    const tree = transform(
      ":::note References\nPython variables are **references** to objects.\n:::\n",
    );
    const [admonition] = findAdmonitions(tree);
    expect(admonition).toBeDefined();
    expect(classOf(admonition)).toBe("admonition admonition-note");
    expect(headingText(admonition)).toBe("References");
    expect(contentText(admonition)).toContain("Python variables are");
    expect(contentText(admonition)).toContain("to objects.");
    expect(stringify(tree)).not.toContain(":::note");
    expect(stringify(tree)).not.toContain(":::");
  });

  test("keeps inline formatting in the body", () => {
    const tree = transform(":::tip Title\nUse **bun** instead.\n:::\n");
    const [admonition] = findAdmonitions(tree);
    const content = admonition.children[1];
    const paragraph = content.children[0];
    expect(paragraph.type).toBe("paragraph");
    expect(paragraph.children.some((c: any) => c.type === "strong")).toBe(
      true,
    );
  });

  test("keeps formatting in the title", () => {
    const tree = transform(":::tip A **bold** title\nBody.\n:::\n");
    const [admonition] = findAdmonitions(tree);
    const heading = admonition.children[0];
    expect(heading.children.some((c: any) => c.type === "strong")).toBe(true);
    expect(headingText(admonition)).toBe("A bold title");
  });

  test("converts a multi-paragraph body", () => {
    const tree = transform(
      ":::warning Careful\nFirst paragraph.\n\nSecond paragraph.\n:::\n",
    );
    const [admonition] = findAdmonitions(tree);
    expect(classOf(admonition)).toBe("admonition admonition-warning");
    expect(headingText(admonition)).toBe("Careful");
    const content = admonition.children[1];
    expect(content.children.length).toBe(2);
    expect(contentText(admonition)).toContain("First paragraph.");
    expect(contentText(admonition)).toContain("Second paragraph.");
  });

  test("converts when a blank line follows the fence", () => {
    const tree = transform(":::note Title\n\nBody paragraph.\n:::\n");
    const [admonition] = findAdmonitions(tree);
    expect(admonition).toBeDefined();
    expect(headingText(admonition)).toBe("Title");
    expect(contentText(admonition)).toContain("Body paragraph.");
  });

  test("converts every Docusaurus keyword", () => {
    for (const keyword of [
      "secondary",
      "info",
      "success",
      "danger",
      "note",
      "tip",
      "warning",
      "important",
      "caution",
    ]) {
      const tree = transform(`:::${keyword} Title\nBody.\n:::\n`);
      const [admonition] = findAdmonitions(tree);
      expect(admonition).toBeDefined();
      expect(classOf(admonition)).toBe(`admonition admonition-${keyword}`);
    }
  });

  test("leaves a non-keyword fence alone", () => {
    const tree = transform(":::foo Title\nBody.\n:::\n");
    expect(findAdmonitions(tree)).toHaveLength(0);
    expect(stringify(tree)).toContain(":::foo Title");
  });

  test("leaves a fence without a closing line alone", () => {
    const tree = transform(":::note Title\nBody without a closer.\n");
    expect(findAdmonitions(tree)).toHaveLength(0);
    expect(stringify(tree)).toContain(":::note Title");
  });

  test("converts a fence inside a blockquote", () => {
    const tree = transform("> :::note Title\n> Body.\n> :::\n");
    const [admonition] = findAdmonitions(tree);
    expect(admonition).toBeDefined();
    expect(headingText(admonition)).toBe("Title");
    expect(tree.children[0].type).toBe("blockquote");
  });

  test("leaves fences inside code blocks alone", () => {
    const tree = transform("```\n:::note Title\nBody.\n:::\n```\n");
    expect(findAdmonitions(tree)).toHaveLength(0);
    expect(tree.children[0].type).toBe("code");
  });

  test("leaves a bare directive to remarkAdmonitions", () => {
    const tree = parse(":::note\nBody.\n:::\n");
    remarkSpaceFormAdmonitions()(tree);
    expect(findAdmonitions(tree)).toHaveLength(0);
    expect(tree.children[0].type).toBe("containerDirective");
  });

  test("requires the closer to be at least as long as the opener", () => {
    const tooShort = transform("::::note Title\nBody.\n:::\n");
    expect(findAdmonitions(tooShort)).toHaveLength(0);
    const matching = transform("::::note Title\nBody.\n::::\n");
    expect(findAdmonitions(matching)).toHaveLength(1);
  });

  test("accepts a title containing a bracket", () => {
    const tree = transform(":::note A]B\nBody.\n:::\n");
    const [admonition] = findAdmonitions(tree);
    expect(admonition).toBeDefined();
    expect(headingText(admonition)).toBe("A]B");
  });

  test("converts a fence closed by an indented line after a list", () => {
    const tree = transform(
      ":::note Sets vs. Dicts\nBoth use curly braces.\n\n- `{x}` produces a **set**.\n- `{k: v}` produces a **dictionary**.\n  :::\n",
    );
    const [admonition] = findAdmonitions(tree);
    expect(admonition).toBeDefined();
    expect(classOf(admonition)).toBe("admonition admonition-note");
    expect(headingText(admonition)).toBe("Sets vs. Dicts");
    const content = admonition.children[1];
    expect(content.children.some((c: any) => c.type === "list")).toBe(true);
    expect(stringify(tree)).not.toContain(":::");
  });

  test("leaves a fence closed mid-list alone", () => {
    const tree = transform(
      ":::note Title\nBody.\n\n- First item.\n  :::\n- Second item.\n",
    );
    expect(findAdmonitions(tree)).toHaveLength(0);
  });
});
