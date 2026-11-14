import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import remarkStringify from "remark-stringify";
import remarkAdmonitions from "../src/plugins/remarkAdmonitions.ts";

/**
 * `remarkAdmonitions` turns Docusaurus-style admonition directives
 * (`:::tip[Title]` … `:::`) into callout `<div>`s. The bracketed
 * title arrives as a leading paragraph with `data.directiveLabel`
 * (remark-directive has no `node.label` property) — it becomes the
 * heading and is removed from the body.
 *
 * These tests parse real MDX (not hand-built trees): the label
 * shape matters, and reading `node.label` silently fell back to
 * the default title while leaving the intended title as the
 * body's first line.
 */

function parse(mdx: string): any {
  return unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkDirective)
    .parse(mdx);
}

function transform(mdx: string): string {
  const tree = parse(mdx);
  remarkAdmonitions()(tree);
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

function headingText(admonition: any): string {
  const heading = admonition.children[0];
  return heading.children.map((child: any) => child.value ?? "").join("");
}

describe("remarkAdmonitions", () => {
  test("uses the bracketed label as the heading, not the body", () => {
    const tree = parse(":::tip[Pro tip]\nUse bun instead.\n:::\n");
    remarkAdmonitions()(tree);
    const admonition = findAdmonition(tree);
    expect(admonition).toBeDefined();
    expect(classOf(admonition)).toBe("admonition admonition-tip");
    expect(headingText(admonition)).toBe("Pro tip");
    const out = String(
      unified().use(remarkStringify).use(remarkMdx).stringify(tree),
    );
    expect(out).toContain("Use bun instead.");
    // The label appears once (as the heading), not again in the body.
    expect(out.split("Pro tip").length - 1).toBe(1);
  });

  test("falls back to the type's default title without a label", () => {
    const tree = parse(":::warning\nCareful now.\n:::\n");
    remarkAdmonitions()(tree);
    const admonition = findAdmonition(tree);
    expect(headingText(admonition)).toBe("Warning");
  });

  test("keeps formatting inside the label", () => {
    const tree = parse(":::tip[A **bold** title]\nBody.\n:::\n");
    remarkAdmonitions()(tree);
    const heading = findAdmonition(tree).children[0];
    expect(heading.children.some((c: any) => c.type === "strong")).toBe(true);
  });

  test("capitalizes an unknown type for the default title", () => {
    const tree = parse(":::foo\nBody.\n:::\n");
    remarkAdmonitions()(tree);
    const admonition = findAdmonition(tree);
    expect(classOf(admonition)).toBe("admonition admonition-foo");
    expect(headingText(admonition)).toBe("Foo");
  });
});
