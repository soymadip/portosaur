import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

import { guessDocPermalink, type Frontmatter } from "./slug.ts";

/**
 * Server-only slug helpers — everything that touches disk.
 *
 * Split out of `slug.ts` because that module must stay free of Node
 * imports (client components reach it via `docPage.ts`). Nothing in
 * this file may be imported by a client component; the Fumadocs
 * loader (`lib/source.ts`) and build-time code use it.
 */

const INDEX_FILE_NAMES = [
  "index.mdx",
  "index.md",
  "Index.mdx",
  "Index.md",
  "README.mdx",
  "README.md",
  "Readme.mdx",
  "Readme.md",
  "readme.mdx",
  "readme.md",
];

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

/**
 * Automatically cleans slugs and strips numeric sorting prefixes from document metadata.
 * Also inherits custom slugs from parent index files to route siblings consistently.
 *
 * Reads the parent index slugs from disk, then delegates to the pure
 * `guessDocPermalink` — the slug algorithm lives in exactly one place
 * (`slug.ts`). Returns the frontmatter object with `slug` set (leading
 * `/`, as the Docusaurus-era entry point did).
 */
export function cleanFrontMatterSlug({
  filePath,
  frontMatter,
  projectDir,
  contentDirName = "notes",
}: {
  filePath: string;
  frontMatter: Frontmatter;
  projectDir: string;
  contentDirName?: string;
}): Frontmatter {
  const contentDir = path.resolve(projectDir, contentDirName);

  if (filePath.startsWith(contentDir)) {
    const relativePath = path.relative(contentDir, filePath);
    const pathParts = relativePath.split(path.sep);

    // Custom slugs of the ancestor index files, keyed by directory
    // path relative to the content root (the lookup
    // `guessDocPermalink` takes).
    const parentSlugs: Record<string, string> = {};
    for (let i = 0; i < pathParts.length - 1; i++) {
      const dirSegments = pathParts.slice(0, i + 1);
      const dirPath = path.join(contentDir, ...dirSegments);
      for (const name of INDEX_FILE_NAMES) {
        const fm = parseFileFrontmatter(path.join(dirPath, name));
        if (fm && fm.slug) {
          parentSlugs[dirSegments.join("/")] = fm.slug;
          break;
        }
      }
    }

    const { slug } = guessDocPermalink(
      pathParts.join("/"),
      frontMatter,
      parentSlugs,
    );
    frontMatter.slug = slug ? `/${slug}` : "/";
  }

  return frontMatter;
}
