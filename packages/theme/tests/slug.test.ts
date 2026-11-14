import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cleanFrontMatterSlug, guessDocPermalink } from "../src/utils/slug.ts";

/**
 * Slug behavior tests. Phase 2 unified both functions onto one algorithm:
 * `cleanFrontMatterSlug`'s, the one the Docusaurus build actually used (and
 * therefore the one the golden URLs encode). `guessDocPermalink` is a thin
 * wrapper over the same core — same number-prefix stripping (including
 * dotted prefixes like `4.1 - x`), same parent index/README slug
 * inheritance, same index-file handling — differing only in that it returns
 * `{ slug, fileSlug }` with no leading slash on `slug`, and takes parent
 * index slugs as an explicit lookup instead of reading them from disk.
 */

describe("cleanFrontMatterSlug", () => {
  let projectDir!: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-slug-"));
    const notesDir = path.join(projectDir, "notes");
    fs.mkdirSync(path.join(notesDir, "guide"), { recursive: true });
    fs.mkdirSync(path.join(notesDir, "python"), { recursive: true });
    // Parent index with a custom slug, for the inheritance case.
    fs.writeFileSync(
      path.join(notesDir, "guide", "index.mdx"),
      "---\nslug: /manual\n---\n# Guide\n",
    );
    fs.writeFileSync(path.join(notesDir, "guide", "setup.mdx"), "# Setup\n");
    fs.writeFileSync(
      path.join(notesDir, "getting-started.mdx"),
      "# Getting Started\n",
    );
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test("cleans a plain file name", () => {
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "notes", "getting-started.mdx"),
      frontMatter: {},
      projectDir,
    });
    expect(fm.slug).toBe("/getting-started");
  });

  test("strips number prefixes", () => {
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "notes", "1 - intro.mdx"),
      frontMatter: {},
      projectDir,
    });
    expect(fm.slug).toBe("/intro");
  });

  test("strips dotted number prefixes", () => {
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "notes", "4.1 - while-loops.mdx"),
      frontMatter: {},
      projectDir,
    });
    expect(fm.slug).toBe("/while-loops");
  });

  test("inherits slugs from parent index files", () => {
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "notes", "guide", "setup.mdx"),
      frontMatter: {},
      projectDir,
    });
    expect(fm.slug).toBe("/manual/setup");
  });

  test("resolves index files to their directory", () => {
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "notes", "python", "index.mdx"),
      frontMatter: {},
      projectDir,
    });
    expect(fm.slug).toBe("/python");
  });

  test("honors an explicit user slug", () => {
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "notes", "getting-started.mdx"),
      frontMatter: { slug: "/custom" },
      projectDir,
    });
    expect(fm.slug).toBe("/custom");
  });

  test("leaves files outside the content dir untouched", () => {
    const frontMatter = {};
    const fm = cleanFrontMatterSlug({
      filePath: path.join(projectDir, "blog", "post.mdx"),
      frontMatter,
      projectDir,
    });
    expect(fm.slug).toBeUndefined();
  });
});

describe("guessDocPermalink", () => {
  test("computes a plain slug", () => {
    expect(guessDocPermalink("getting-started.mdx")).toEqual({
      slug: "getting-started",
      fileSlug: "getting-started",
    });
  });

  test("strips number prefixes from file and directory names", () => {
    const { slug } = guessDocPermalink("python/4 - loops/loops.mdx");
    expect(slug).toBe("python/loops/loops");
  });

  test("strips dotted number prefixes like 4.1", () => {
    const { slug } = guessDocPermalink(
      "python/4 - loops/4.1 - while-loops.mdx",
    );
    expect(slug).toBe("python/loops/while-loops");
  });

  test("resolves index files to their directory", () => {
    const { slug } = guessDocPermalink("guide/index.mdx");
    expect(slug).toBe("guide");
  });

  test("treats same-name-as-directory files as regular files", () => {
    const { slug } = guessDocPermalink("guide/guide.mdx");
    expect(slug).toBe("guide/guide");
  });

  test("honors an explicit slug", () => {
    const { slug } = guessDocPermalink("guide/setup.mdx", {
      slug: "custom",
    });
    expect(slug).toBe("guide/custom");
  });

  test("resolves a relative slug on an index file against the root", () => {
    const { slug } = guessDocPermalink("guide/index.mdx", {
      slug: "custom",
    });
    expect(slug).toBe("custom");
  });

  test("ignores frontmatter id (the filename is the base)", () => {
    const { slug } = guessDocPermalink("1 - intro.mdx", { id: "my-id" });
    expect(slug).toBe("intro");
  });

  test("inherits slugs from parent index files", () => {
    const { slug } = guessDocPermalink(
      "guide/setup.mdx",
      {},
      { guide: "/manual" },
    );
    expect(slug).toBe("manual/setup");
  });
});
