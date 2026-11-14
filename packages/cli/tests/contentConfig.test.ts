import { expect, test, describe } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildContentConfigContent } from "../src/engine/generators/astroConfig.ts";
import type { PortosaurOptions } from "../src/engine/generators/siteConfig.ts";

/** Minimal options — the content config only reads the two dir names. */
function options(notesDir = "notes", blogDir = "blog"): PortosaurOptions {
  return {
    site: { notesDir, blogDir },
  } as PortosaurOptions;
}

describe("buildContentConfigContent", () => {
  test("forces path-based entry IDs so frontmatter slugs cannot collide", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-content-"));
    try {
      const content = buildContentConfigContent(options(), 0, projectDir);

      // Both collections override generateId: Astro's default uses a
      // frontmatter `slug` as the entry ID, so two files with the same
      // slug in different directories collide and one is dropped from
      // the collection. Portosaur resolves its own slugs from file
      // paths and requires entry IDs to be paths.
      const matches = content.match(
        /generateId: \(\{\s*entry\s*\}\) => entry\.replace\(\/\\\.mdx\$\/, ""\)/g,
      );
      expect(matches).toHaveLength(2);
      expect(content).toContain('base: "../notes"');
      expect(content).toContain('base: "../blog"');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
