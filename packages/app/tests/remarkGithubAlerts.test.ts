import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkGithubAlerts from "../src/plugins/remarkGithubAlerts.ts";

/**
 * `remarkGithubAlerts` turns a blockquote whose first line is a
 * GitHub alert marker (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`,
 * `[!WARNING]`, `[!CAUTION]`) into the same admonition `<div>`s the
 * Docusaurus admonitions plugin emits. Text after the marker on the
 * same line becomes the alert's title; with no text, the type's
 * default title is used.
 *
 * These tests parse real MDX (not hand-built trees): the marker line
 * and the body share one text node with `\n` soft breaks, and a
 * hand-built tree would get that shape wrong.
 */

function parse(mdx: string): any {
  return unified().use(remarkParse).use(remarkMdx).parse(mdx);
}

function transform(mdx: string): string {
  const tree = parse(mdx);
  remarkGithubAlerts()(tree);
  return String(unified().use(remarkStringify).use(remarkMdx).stringify(tree));
}

function findAdmonition(tree: any): any {
  return (tree.children ?? []).find(
    (node: any) =>
      node.type === "mdxJsxFlowElement" &&
      node.name === "div" &&
      node.attributes?.some(
        (attr: any) =>
          attr.name === "className" &&
          typeof attr.value === "string" &&
          attr.value.startsWith("admonition "),
      ),
  );
}

function classOf(admonition: any): string {
  return admonition.attributes.find((attr: any) => attr.name === "className")
    .value;
}

function headingOf(admonition: any): string {
  const heading = admonition.children[0];
  return heading.children.map((child: any) => child.value ?? "").join("");
}

describe("remarkGithubAlerts", () => {
  test("converts [!NOTE] to an info admonition with the default title", () => {
    const out = transform("> [!NOTE]\n> Something to know.\n");
    expect(out).toContain('className="admonition admonition-info"');
    expect(out).toContain("Note");
    expect(out).toContain("Something to know.");
    expect(out).not.toContain("[!NOTE]");
  });

  test("maps each keyword to its GitHub-coloured type", () => {
    const cases: Array<[string, string, string]> = [
      ["NOTE", "admonition-info", "Note"],
      ["TIP", "admonition-tip", "Tip"],
      ["IMPORTANT", "admonition-important", "Important"],
      ["WARNING", "admonition-warning", "Warning"],
      ["CAUTION", "admonition-danger", "Caution"],
    ];
    for (const [keyword, className, title] of cases) {
      const tree = parse(`> [!${keyword}]\n> Body.\n`);
      remarkGithubAlerts()(tree);
      const admonition = findAdmonition(tree);
      expect(admonition).toBeDefined();
      expect(classOf(admonition)).toBe(`admonition ${className}`);
      expect(headingOf(admonition)).toBe(title);
    }
  });

  test("text after the marker becomes the title", () => {
    const tree = parse("> [!NOTE] Custom Title Here\n> Body line.\n");
    remarkGithubAlerts()(tree);
    const admonition = findAdmonition(tree);
    expect(headingOf(admonition)).toBe("Custom Title Here");
    const out = String(
      unified().use(remarkStringify).use(remarkMdx).stringify(tree),
    );
    expect(out).toContain("Body line.");
    expect(out).not.toContain("[!NOTE]");
  });

  test("a formatted title is flattened to plain text", () => {
    const tree = parse("> [!WARNING] A **bold** title\n> Body.\n");
    remarkGithubAlerts()(tree);
    const admonition = findAdmonition(tree);
    expect(headingOf(admonition)).toBe("A bold title");
  });

  test("a marker-only blockquote keeps the default title", () => {
    const tree = parse("> [!TIP]\n");
    remarkGithubAlerts()(tree);
    const admonition = findAdmonition(tree);
    expect(admonition).toBeDefined();
    expect(headingOf(admonition)).toBe("Tip");
  });

  test("keeps a multi-paragraph body", () => {
    const out = transform("> [!CAUTION]\n> First paragraph.\n>\n> Second paragraph.\n");
    expect(out).toContain('className="admonition admonition-danger"');
    expect(out).toContain("First paragraph.");
    expect(out).toContain("Second paragraph.");
  });

  test("leaves a marker that is not on the first line alone", () => {
    const out = transform("> Some text first.\n> [!NOTE]\n");
    expect(out).not.toContain("admonition");
    expect(out).toContain("[!NOTE]");
  });

  test("leaves a lowercase marker alone (GitHub requires uppercase)", () => {
    const out = transform("> [!note]\n> Body.\n");
    expect(out).not.toContain("admonition");
    expect(out).toContain("[!note]");
  });

  test("leaves an unknown marker alone", () => {
    const out = transform("> [!FOO]\n> Body.\n");
    expect(out).not.toContain("admonition");
    expect(out).toContain("[!FOO]");
  });

  test("leaves a plain blockquote alone", () => {
    const out = transform("> Just a quote.\n");
    expect(out).not.toContain("admonition");
    expect(out).toContain("Just a quote.");
  });
});
