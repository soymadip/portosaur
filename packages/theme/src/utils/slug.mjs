import fs from "fs";
import path from "path";
import { load } from "js-yaml";

/**
 * Canonical slug utilities for Portosaur content.
 *
 * Phase 2 unified `cleanFrontMatterSlug` and `guessDocPermalink` onto one
 * algorithm: the one `cleanFrontMatterSlug` used in the Docusaurus build
 * (and therefore the one the golden URLs encode). Both functions share the
 * internal `computeSlug` core — same number-prefix stripping (including
 * dotted prefixes like `4.1 - x`), same parent index/README slug
 * inheritance, same index-file handling. They differ only in inputs and
 * output shape:
 *
 * - `cleanFrontMatterSlug` takes absolute file paths, reads parent index
 *   frontmatter from disk, mutates + returns the frontmatter object, and
 *   returns slugs with a leading `/`.
 * - `guessDocPermalink` takes content-relative paths, takes parent index
 *   slugs as an explicit lookup (built from collection entries at build
 *   time), and returns `{ slug, fileSlug }` with no leading slash on
 *   `slug`.
 *
 * Notes on the unified behavior: a file whose name matches its parent
 * directory (e.g. `guide/guide.mdx`) is an ordinary file, not an index —
 * only `index`/`README` files are indexes. A frontmatter `id` is ignored;
 * the filename is always the base. A relative `slug` on an index file
 * resolves against the site root, not its parent directory.
 */

// Number prefixes stripped from file and directory names: `1 - x`,
// `4.1 - x`, `2. x`, `10_x`. Shared with the sidebar builder.
export const NUMBER_PREFIX_PATTERN = /^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)/;

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

const frontmatterCache = new Map();

/**
 * Strips a number prefix from one path segment and slugifies it.
 */
function cleanSegment(segment) {
  const stripped = segment.replace(NUMBER_PREFIX_PATTERN, "");
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Whether a file base name (no extension) marks an index file.
 * Shared with the sidebar builder so both agree on what an index is.
 */
export function isIndexBase(base) {
  const lower = base.toLowerCase();
  return lower === "index" || lower === "readme";
}

/**
 * Parses YAML frontmatter from a file, cached for performance.
 */
export function parseFileFrontmatter(filePath) {
  if (frontmatterCache.has(filePath)) {
    return frontmatterCache.get(filePath);
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
 * The shared slug algorithm. `segments` are the path parts relative to the
 * content root (last part is the file name with extension).
 * `resolveParentSlug` returns the custom slug of the index file in the
 * directory given by `dirSegments` (relative to the content root), or null.
 * Returns the slug with a leading `/`.
 */
function computeSlug({ segments, frontMatter, resolveParentSlug }) {
  const filename = segments[segments.length - 1];
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const isIndexFile = isIndexBase(base);

  let currentRoutePath = "/";

  // Resolve directories up to grandparent for index files, otherwise parent
  const dirLimit = isIndexFile ? segments.length - 2 : segments.length - 1;

  for (let i = 0; i < dirLimit; i++) {
    const dirSegments = segments.slice(0, i + 1);
    const resolvedSlug = resolveParentSlug(dirSegments);

    if (resolvedSlug) {
      if (resolvedSlug.startsWith("/")) {
        currentRoutePath = resolvedSlug;
      } else {
        currentRoutePath = path.posix.resolve(currentRoutePath, resolvedSlug);
      }
    } else {
      currentRoutePath = path.posix.resolve(
        currentRoutePath,
        cleanSegment(segments[i]),
      );
    }
  }

  let finalSlug = "";
  const userSlug = frontMatter?.slug;

  if (isIndexFile) {
    if (userSlug) {
      if (userSlug.startsWith("/")) {
        finalSlug = userSlug;
      } else {
        finalSlug = path.posix.resolve(currentRoutePath, userSlug);
      }
    } else if (segments.length === 1) {
      finalSlug = currentRoutePath;
    } else {
      const lastDirSegment = segments[segments.length - 2];
      finalSlug = path.posix.resolve(
        currentRoutePath,
        cleanSegment(lastDirSegment),
      );
    }
  } else if (userSlug) {
    if (userSlug.startsWith("/")) {
      finalSlug = userSlug;
    } else {
      finalSlug = path.posix.resolve(currentRoutePath, userSlug);
    }
  } else {
    finalSlug = path.posix.resolve(currentRoutePath, cleanSegment(base));
  }

  return finalSlug;
}

/**
 * Automatically cleans slugs and strips numeric sorting prefixes from document metadata.
 * Also inherits custom slugs from parent index files to route siblings consistently.
 */
export function cleanFrontMatterSlug({
  filePath,
  frontMatter,
  projectDir,
  contentDirName = "notes",
}) {
  const contentDir = path.resolve(projectDir, contentDirName);

  if (filePath.startsWith(contentDir)) {
    const relativePath = path.relative(contentDir, filePath);
    const pathParts = relativePath.split(path.sep);

    frontMatter.slug = computeSlug({
      segments: pathParts,
      frontMatter,
      resolveParentSlug: (dirSegments) => {
        const dirPath = path.join(contentDir, ...dirSegments);
        for (const name of INDEX_FILE_NAMES) {
          const fm = parseFileFrontmatter(path.join(dirPath, name));
          if (fm && fm.slug) {
            return fm.slug;
          }
        }
        return null;
      },
    });
  }

  return frontMatter;
}

/**
 * Computes a doc permalink from a content-relative file path, using the
 * same algorithm as `cleanFrontMatterSlug`.
 *
 * @param {string} filePath - The file path relative to the content root
 *   (e.g. "python/4 - loops/4.1 - while-loops.mdx").
 * @param {object} [frontMatter] - The parsed frontmatter of the file
 *   (e.g. { slug: "custom" }).
 * @param {object} [parentSlugs] - Custom slugs of parent index files, keyed
 *   by directory path relative to the content root (e.g. { guide: "/manual" }).
 * @returns {{ slug: string, fileSlug: string }} The computed slug with no
 *   leading slash (e.g. { slug: "python/loops/while-loops",
 *   fileSlug: "python" }). `fileSlug` is the cleaned first directory
 *   segment, or the cleaned file base name for root-level files.
 */
export function guessDocPermalink(
  filePath,
  frontMatter = {},
  parentSlugs = {},
) {
  const cleanPath = filePath.replace(/^\.\//, "");
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { slug: "", fileSlug: "" };
  }

  const slug = computeSlug({
    segments,
    frontMatter,
    resolveParentSlug: (dirSegments) => {
      return parentSlugs[dirSegments.join("/")] ?? null;
    },
  });

  const fileSlug =
    segments.length > 1
      ? cleanSegment(segments[0])
      : cleanSegment(path.basename(segments[0], path.extname(segments[0])));

  return { slug: slug.replace(/^\//, ""), fileSlug };
}
