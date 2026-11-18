/**
 * Canonical slug utilities for Portosaur content.
 *
 * Ported from the Astro app (`packages/app/src/utils/slug.ts`): the
 * algorithm is the one `cleanFrontMatterSlug` used in the Docusaurus
 * build (and therefore the one the golden URLs encode). Both entry
 * points share the internal `computeSlug` core — same number-prefix
 * stripping (including dotted prefixes like `4.1 - x`), same parent
 * index/README slug inheritance, same index-file handling. They
 * differ only in inputs and output shape:
 *
 * - `cleanFrontMatterSlug` (in `slug-server.ts`) takes absolute file
 *   paths, reads parent index frontmatter from disk, mutates +
 *   returns the frontmatter object, and returns slugs with a leading
 *   `/`.
 * - `guessDocPermalink` takes content-relative paths, takes parent
 *   index slugs as an explicit lookup (built from collection entries
 *   at build time), and returns `{ slug, fileSlug }` with no leading
 *   slash on `slug`.
 *
 * This file MUST stay free of Node imports (`node:fs`, `node:path`,
 * …): it is imported by `docPage.ts`, which client components use
 * (`PageTitle`, `TableOfContents`), and Node builtins break the
 * client bundle. The POSIX path helpers below are small local
 * replacements for the `node:path` calls the algorithm needs — the
 * inputs are URL path segments, so `posixResolve`/`posixExtname`/
 * `posixBasename` cover them exactly. Everything that touches disk
 * lives in `slug-server.ts`.
 *
 * Notes on the unified behavior: a file whose name matches its parent
 * directory (e.g. `guide/guide.mdx`) is an ordinary file, not an
 * index — only `index`/`README` files are indexes. A frontmatter `id`
 * is ignored. The filename is always the base. A relative `slug` on
 * an index file resolves against the site root, not its parent
 * directory.
 */

/** Parsed YAML frontmatter — values are genuinely dynamic. */
export type Frontmatter = Record<string, any>;

// Number prefixes stripped from file and directory names: `1 - x`,
// `4.1 - x`, `2. x`, `10_x`. Shared with the sidebar builder.
export const NUMBER_PREFIX_PATTERN = /^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)/;

/**
 * POSIX `path.extname` for a bare file name: the substring from the
 * last `.` (inclusive), or `""` when there is no extension (a leading
 * dot does not start one).
 */
function posixExtname(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return filename.slice(dot);
}

/**
 * POSIX `path.basename` for a bare file name, with an optional
 * extension to strip.
 */
function posixBasename(filename: string, ext = ""): string {
  if (ext && filename.endsWith(ext)) {
    return filename.slice(0, filename.length - ext.length);
  }
  return filename;
}

/**
 * POSIX `path.posix.resolve` for absolute URL-style paths: joins the
 * segments, then normalizes `.` and `..` (a `..` past the root is
 * dropped, as in POSIX).
 */
function posixResolve(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    for (const segment of part.split("/")) {
      if (segment === "" || segment === ".") {
        continue;
      }
      if (segment === "..") {
        out.pop();
      } else {
        out.push(segment);
      }
    }
  }
  return `/${out.join("/")}`;
}

/**
 * Strips a number prefix from one path segment and slugifies it.
 */
export function cleanSegment(segment: string): string {
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
export function isIndexBase(base: string): boolean {
  const lower = base.toLowerCase();
  return lower === "index" || lower === "readme";
}

/**
 * The shared slug algorithm. `segments` are the path parts relative to the
 * content root (last part is the file name with extension).
 * `resolveParentSlug` returns the custom slug of the index file in the
 * directory given by `dirSegments` (relative to the content root), or null.
 * Returns the slug with a leading `/`.
 */
function computeSlug({
  segments,
  frontMatter,
  resolveParentSlug,
}: {
  segments: string[];
  frontMatter?: Frontmatter | null;
  resolveParentSlug: (dirSegments: string[]) => string | null;
}): string {
  const filename = segments[segments.length - 1];
  const ext = posixExtname(filename);
  const base = posixBasename(filename, ext);
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
        currentRoutePath = posixResolve(currentRoutePath, resolvedSlug);
      }
    } else {
      currentRoutePath = posixResolve(
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
        finalSlug = posixResolve(currentRoutePath, userSlug);
      }
    } else if (segments.length === 1) {
      finalSlug = currentRoutePath;
    } else {
      const lastDirSegment = segments[segments.length - 2];
      finalSlug = posixResolve(currentRoutePath, cleanSegment(lastDirSegment));
    }
  } else if (userSlug) {
    if (userSlug.startsWith("/")) {
      finalSlug = userSlug;
    } else {
      finalSlug = posixResolve(currentRoutePath, userSlug);
    }
  } else {
    finalSlug = posixResolve(currentRoutePath, cleanSegment(base));
  }

  return finalSlug;
}

/**
 * Computes a doc permalink from a content-relative file path, using the
 * same algorithm as `cleanFrontMatterSlug`.
 *
 * @param filePath - The file path relative to the content root
 *   (e.g. "python/4 - loops/4.1 - while-loops.mdx").
 * @param frontMatter - The parsed frontmatter of the file
 *   (e.g. { slug: "custom" }).
 * @param parentSlugs - Custom slugs of parent index files, keyed
 *   by directory path relative to the content root (e.g. { guide: "/manual" }).
 * @returns The computed slug with no leading slash (e.g. { slug:
 *   "python/loops/while-loops", fileSlug: "python" }). `fileSlug` is the
 *   cleaned first directory segment, or the cleaned file base name for
 *   root-level files.
 */
export function guessDocPermalink(
  filePath: string,
  frontMatter: Frontmatter = {},
  parentSlugs: Record<string, string> = {},
): { slug: string; fileSlug: string } {
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
      : cleanSegment(posixBasename(segments[0], posixExtname(segments[0])));

  return { slug: slug.replace(/^\//, ""), fileSlug };
}
