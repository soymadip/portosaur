import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

import type { Frontmatter } from "./slug.ts";

/**
 * Server-only slug helpers — everything that touches disk.
 *
 * Split out of `slug.ts` because that module must stay free of Node
 * imports (client components reach it via `docPage.ts`). Nothing in
 * this file may be imported by a client component. The Fumadocs
 * loader (`lib/source.ts`) and build-time code use it.
 */

const frontmatterCache = new Map<string, Frontmatter | null>();

/**
 * Parses YAML frontmatter from a file, cached for performance.
 */
export function parseFileFrontmatter(filePath: string): Frontmatter | null {
  if (frontmatterCache.has(filePath)) {
    return frontmatterCache.get(filePath) ?? null;
  }

  if (!fs.existsSync(filePath)) {
    frontmatterCache.set(filePath, null);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      const parsed = load(match[1]) || {};
      frontmatterCache.set(filePath, parsed);
      return parsed;
    }
  } catch (err) {
    // Ignore parse/read errors
  }

  frontmatterCache.set(filePath, null);
  return null;
}

/** Index file names, in the order their slugs are preferred. */
const INDEX_NAMES = ["index.mdx", "index.md", "README.mdx", "README.md"];

/**
 * Custom slugs of the index files in a file's ancestor directories,
 * keyed by directory path relative to the content root (e.g.
 * `{ guide: "/manual" }`) — the `parentSlugs` map
 * `guessDocPermalink` takes. `contentPath` is the file's
 * content-relative path with `/` separators; `absolutePath` is its
 * path on disk. Shared by the loader's slug function and the
 * file-links plugin so both resolve parent slugs the same way.
 */
export function collectParentSlugs(
  absolutePath: string,
  contentPath: string,
): Record<string, string> {
  const parentSlugs: Record<string, string> = {};
  // Ancestor directories of the file, content-relative, from the
  // content root down to the file's parent directory.
  const dirSegments = contentPath.split("/").filter(Boolean).slice(0, -1);
  const fileDir = path.dirname(absolutePath);
  for (let i = 1; i <= dirSegments.length; i++) {
    const dirKey = dirSegments.slice(0, i).join("/");
    // The directory on disk: walk up from the file's directory.
    const up = dirSegments.length - i;
    const dirPath =
      up === 0 ? fileDir : path.resolve(fileDir, ...Array(up).fill(".."));
    for (const name of INDEX_NAMES) {
      const fm = parseFileFrontmatter(path.join(dirPath, name));
      if (fm && typeof fm.slug === "string" && fm.slug !== "") {
        parentSlugs[dirKey] = fm.slug;
        break;
      }
    }
  }
  return parentSlugs;
}
