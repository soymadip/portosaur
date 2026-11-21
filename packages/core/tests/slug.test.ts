import { expect, test, describe } from "bun:test";
import { guessDocPermalink } from "../src/lib/slug.ts";

/**
 * Slug behavior tests. `guessDocPermalink` is the one slug
 * algorithm: the one the Docusaurus build actually used (and
 * therefore the one the golden URLs encode). Same number-prefix
 * stripping (including dotted prefixes like `4.1 - x`), same
 * parent index/README slug inheritance, same index-file
 * handling. It returns `{ slug, fileSlug }` with no leading
 * slash on `slug`, and takes parent index slugs as an explicit
 * lookup instead of reading them from disk.
 */

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
