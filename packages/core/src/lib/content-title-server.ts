// Server-only content-title lookup: reads a page file from disk and
// returns its content H1 text, for the page-tree transformer. The
// Fumadocs tree builder only sees frontmatter + filenames, so the
// transformer reaches the H1 this way instead.
//
// The parse mirrors the MDX pipeline's view of the file: the leading
// frontmatter block is stripped first (a `#` comment inside it is
// YAML, not a heading), then the rest is parsed with the same
// unified + remark-parse + remark-mdx setup the pipeline uses, and
// the title is extracted with the shared rule from
// `content-title.ts` — so the sidebar label and the hoisted page
// title always agree.
//
// Nothing in this file may be imported by a client component.
import fs from "node:fs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { extractContentTitle } from "./content-title.ts";

// The frontmatter block: `---` on the first line, closed by a later
// `---` line (same shape `parseFileFrontmatter` matches in
// `slug-server.ts`). A lone leading `---` with no closing fence is
// a thematic break, not frontmatter, and is left alone.
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

const parser = unified().use(remarkParse).use(remarkMdx);

// Cached titles, keyed by absolute path and validated against the
// file's size + mtime so an edited H1 shows up in dev without a
// restart (a plain Map would go stale the way the frontmatter
// cache does).
const titleCache = new Map<
  string,
  { mtimeMs: number; size: number; title: string | null }
>();

/**
 * The content H1 text of the page at `absolutePath`, or null when
 * the page has no title H1. `frontmatter` is the page's parsed
 * frontmatter, used to resolve `{frontmatter.x}` expressions in the
 * H1 the same way the hoisting plugin does. Any failure (missing
 * file, unreadable file, unparseable MDX) returns null so the
 * caller falls back to the frontmatter title.
 */
export function readContentTitle(
  absolutePath: string | undefined,
  frontmatter: unknown,
): string | null {
  if (!absolutePath) {
    return null;
  }
  try {
    const stat = fs.statSync(absolutePath);
    const cached = titleCache.get(absolutePath);
    if (
      cached &&
      cached.mtimeMs === stat.mtimeMs &&
      cached.size === stat.size
    ) {
      return cached.title;
    }
    const text = fs.readFileSync(absolutePath, "utf8");
    const body = text.replace(FRONTMATTER_RE, "");
    const tree = parser.parse(body);
    const title = extractContentTitle(
      tree,
      frontmatter,
      absolutePath.endsWith(".mdx"),
    );
    const result = title ? title.text : null;
    titleCache.set(absolutePath, {
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      title: result,
    });
    return result;
  } catch {
    return null;
  }
}
