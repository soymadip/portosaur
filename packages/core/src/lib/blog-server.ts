import fs from "node:fs";
import { load } from "js-yaml";

import type { BlogAuthor } from "./blog.ts";

/**
 * Server-only blog helpers — everything that touches disk.
 *
 * `blog/authors.yml` has no Fumadocs collection (it is not MDX), so
 * Portosaur reads it directly. Split out of `blog.ts` for the same
 * reason as `slug-server.ts`: `blog.ts` is imported by components,
 * and Node builtins break the client bundle.
 */

/**
 * Loads the blog authors from `authors.yml` (a map of author key to
 * `{ name, title?, url?, image_url?, page? }`). Returns `[]` when the
 * file is absent (a blog without authors) or unparseable.
 */
export function loadBlogAuthors(authorsPath: string): BlogAuthor[] {
  if (!fs.existsSync(authorsPath)) {
    return [];
  }
  try {
    const parsed = load(fs.readFileSync(authorsPath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return [];
    }
    return Object.entries(parsed as Record<string, any>).map(
      ([key, value]) => ({
        key,
        name: value?.name ?? key,
        title: value?.title,
        url: value?.url,
        image_url: value?.image_url,
        hasPage: value?.page === true,
      }),
    );
  } catch (error) {
    console.warn(
      `Failed to parse blog authors file "${authorsPath}": ${(error as Error).message}`,
    );
    return [];
  }
}
