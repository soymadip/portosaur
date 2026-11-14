import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkContentTitle, {
  CONTENT_TITLE_KEY,
} from "../src/plugins/remarkContentTitle.ts";

/**
 * `remarkContentTitle` hoists a page's first H1 out of the content
 * and into the page title slot: the first heading, when it is depth
 * 1, is removed from the tree and its plain text + heading slug are
 * stashed at `file.data.astro.frontmatter[CONTENT_TITLE_KEY]` for
 * the page (via `remarkPluginFrontmatter`).
 *
 * These tests parse real MDX (not hand-built trees): the heading
 * nodes, expression estrees and frontmatter all come from the
 * parser, the way Astro sees them.
 */

function parse(mdx: string): any {
  return unified().use(remarkParse).use(remarkMdx).parse(mdx);
}

function fakeFile(
  frontmatter: Record<string, unknown> = {},
  path = "test.mdx",
): any {
  return { data: { astro: { frontmatter } }, history: [path] };
}

function transform(
  mdx: string,
  frontmatter: Record<string, unknown> = {},
  path = "test.mdx",
): { out: string; file: any } {
  const tree = parse(mdx);
  const file = fakeFile(frontmatter, path);
  remarkContentTitle()(tree, file);
  return {
    out: String(unified().use(remarkStringify).use(remarkMdx).stringify(tree)),
    file,
  };
}

function stashed(file: any): any {
  return file.data.astro.frontmatter[CONTENT_TITLE_KEY];
}

describe("remarkContentTitle", () => {
  test("removes the first H1 and stashes its text and slug", () => {
    const { out, file } = transform("# Callouts\n\nSome text.\n");
    expect(out).not.toContain("Callouts");
    expect(out).toContain("Some text.");
    expect(stashed(file)).toEqual({ text: "Callouts", slug: "callouts" });
  });

  test("leaves the tree alone when the first heading is an H2", () => {
    const { out, file } = transform("## Section\n\nSome text.\n");
    expect(out).toContain("## Section");
    expect(stashed(file)).toBeUndefined();
  });

  test("leaves the tree alone with no headings", () => {
    const { out, file } = transform("Just a paragraph.\n");
    expect(out).toContain("Just a paragraph.");
    expect(stashed(file)).toBeUndefined();
  });

  test("removes only the first H1; later H1s stay in the content", () => {
    const { out, file } = transform("# First\n\n# Second\n\nText.\n");
    expect(out).not.toContain("# First");
    expect(out).toContain("# Second");
    expect(stashed(file)).toEqual({ text: "First", slug: "first" });
  });

  test("extracts plain text from code spans and links", () => {
    const { file } = transform("# Using `bun` with [docs](/docs)\n");
    expect(stashed(file)).toEqual({
      text: "Using bun with docs",
      slug: "using-bun-with-docs",
    });
  });

  test("slugs a punctuated title like Astro's collector", () => {
    const { file } = transform("# Hello, World! (Again)\n");
    expect(stashed(file)).toEqual({
      text: "Hello, World! (Again)",
      slug: "hello-world-again",
    });
  });

  test("resolves a frontmatter expression in the H1", () => {
    const { file } = transform("# {frontmatter.title}\n", {
      title: "Resolved Title",
    });
    expect(stashed(file)).toEqual({
      text: "Resolved Title",
      slug: "resolved-title",
    });
  });

  test("a non-frontmatter expression contributes its source", () => {
    const { file } = transform("# Hello {name}\n");
    expect(stashed(file)).toEqual({ text: "Hello name", slug: "hello-name" });
  });

  test("a thematic break before the H1 does not stop the hoist", () => {
    // Deliberate divergence from Docusaurus's contentTitle plugin:
    // Portosaur's title rule is "first heading iff depth 1", and a
    // leading rule should not change the page's title.
    const { out, file } = transform("---\n\n# Title\n\nText.\n");
    expect(out).not.toContain("# Title");
    expect(stashed(file)).toEqual({ text: "Title", slug: "title" });
  });

  test("an H1 nested in a blockquote is not the title", () => {
    const { out, file } = transform("> # Quoted\n\nText.\n");
    expect(out).toContain("# Quoted");
    expect(stashed(file)).toBeUndefined();
  });

  test("an empty H1 is removed without a stash", () => {
    const { out, file } = transform("#\n\nText.\n");
    expect(out).not.toContain("#");
    expect(out).toContain("Text.");
    expect(stashed(file)).toBeUndefined();
  });

  test("without a file the tree is left untouched", () => {
    const tree = parse("# Title\n\nText.\n");
    remarkContentTitle()(tree, undefined);
    const out = String(
      unified().use(remarkStringify).use(remarkMdx).stringify(tree),
    );
    expect(out).toContain("# Title");
  });

  test("a non-MDX file escapes braces in the stashed text", () => {
    // Parsed without remark-mdx, so `{B}` stays literal text (with
    // the MDX parser it would be an expression node instead).
    const tree = unified().use(remarkParse).parse("# A {B} title\n");
    const file = fakeFile({}, "test.md");
    remarkContentTitle()(tree, file);
    expect(stashed(file).text).toBe("A ${B} title");
  });

  test("the stash does not clobber the existing frontmatter", () => {
    const frontmatter = { title: "FM Title", custom: 1 };
    const { file } = transform("# Content Title\n", frontmatter);
    expect(file.data.astro.frontmatter.title).toBe("FM Title");
    expect(file.data.astro.frontmatter.custom).toBe(1);
    expect(stashed(file)).toEqual({
      text: "Content Title",
      slug: "content-title",
    });
  });
});
