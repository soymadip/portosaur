import fs from "node:fs";
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
