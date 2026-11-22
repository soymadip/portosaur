/**
 * remarkFileLinks
 *
 * Rewrites relative links to Markdown files to the target page's
 * clean URL — the old Docusaurus behavior. A link written as the
 * file is, `./sibling.mdx` or `../3 - config/1 - dynamic-variables.mdx`,
 * becomes `/docs/config/dynamic-variables/` at build time, so
 * authors link by filename instead of translating to the URL by
 * hand. Absolute page URLs, external URLs, anchors, and
 * non-Markdown targets pass through untouched, so existing links
 * keep working.
 *
 * Covered nodes: Markdown `link` and `definition` nodes, and JSX
 * `<Link>` / `<Btn>` elements whose `to` / `href` is a plain
 * string attribute. The target must exist inside one of the
 * content directories; its slug comes from the same
 * `guessDocPermalink` algorithm the loader uses, including
 * frontmatter `slug:` overrides and parent index slugs. A `#hash`
 * on the link is preserved. Numbered names carry spaces, which the
 * old site wrote as `%20` — the path is decoded before resolving.
 *
 * A link that cannot be resolved (missing file, outside the
 * content directories, undecodable) gets a build warning and is
 * left as-is — a bad link never breaks the build. The current
 * file's directory comes from the vfile path, which fumadocs-mdx
 * sets to the source file; without it the plugin leaves every
 * link untouched.
 *
 * Possible follow-ups, deliberately out of scope here:
 * number-stripped matching (linking `./config/dynamic-variables.mdx`
 * without the `3 - ` prefix), extension-less links, and JSX
 * attributes whose value is an expression rather than a string.
 */

import fs from "node:fs";
import path from "node:path";
import { guessDocPermalink } from "../lib/slug.ts";
import {
  collectParentSlugs,
  parseFileFrontmatter,
} from "../lib/slug-server.ts";

/** A content directory and the URL section its pages live under. */
export interface ContentDir {
  /** Absolute path to the content directory. */
  dir: string;
  /** URL section, e.g. "docs", "notes", "blog". */
  route: string;
}

/** Minimal recursive AST walker (no external dep, matches remarkMermaid pattern). */
function visit(
  tree: any,
  type: string,
  visitor: (node: any, index: number, parent: any) => void,
): void {
  function walk(node: any, index: number | null, parent: any): void {
    if (node.type === type) {
      visitor(node, index as number, parent);
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], i, node);
      }
    }
  }
  walk(tree, null, null);
}

/** File extensions that mark a link as a link to a Markdown file. */
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);

/**
 * Whether a URL could be a link to a Markdown file on disk: a
 * relative path ending in `.md` or `.mdx`. Absolute paths,
 * protocol-relative URLs, schemes (`http:`, `mailto:`, ...),
 * same-page anchors, and anything without a Markdown extension
 * are not file links.
 */
function isRelativeFileLink(url: string): boolean {
  if (typeof url !== "string" || url === "") {
    return false;
  }
  if (url.startsWith("/") || url.startsWith("#")) {
    return false;
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) {
    return false;
  }
  const hashIndex = url.indexOf("#");
  const pathPart = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const dot = pathPart.lastIndexOf(".");
  if (dot === -1) {
    return false;
  }
  return MARKDOWN_EXTENSIONS.has(pathPart.slice(dot).toLowerCase());
}

/** Why a file link could not be resolved. */
type UnresolvedReason = "missing" | "outside" | "decode";

type ResolveResult =
  { ok: true; url: string } | { ok: false; reason: UnresolvedReason };

/**
 * Resolves a relative file link to the target page's URL
 * (`/{route}/{slug}/`, hash preserved), or explains why it cannot
 * be resolved. The target must exist and sit inside one of the
 * content directories.
 */
function resolveFileLink(
  url: string,
  currentDir: string,
  contentDirs: ContentDir[],
): ResolveResult {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const rawPath = hashIndex === -1 ? url : url.slice(0, hashIndex);
  let decoded: string;
  try {
    // Numbered names carry spaces (`1 - getting-started`), which
    // the old site wrote as `%20` — decode before resolving.
    decoded = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, reason: "decode" };
  }
  const target = path.resolve(currentDir, decoded);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(target);
  } catch {
    return { ok: false, reason: "missing" };
  }
  if (!stat.isFile()) {
    return { ok: false, reason: "missing" };
  }
  for (const { dir, route } of contentDirs) {
    const relative = path.relative(dir, target);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      continue;
    }
    const contentPath = relative.split(path.sep).join("/");
    const frontmatter = parseFileFrontmatter(target) ?? {};
    const { slug } = guessDocPermalink(
      contentPath,
      frontmatter,
      collectParentSlugs(target, contentPath),
    );
    const page = slug === "" ? `/${route}/` : `/${route}/${slug}/`;
    return { ok: true, url: `${page}${hash}` };
  }
  return { ok: false, reason: "outside" };
}

/** The build warning for a link that could not be resolved. */
function warningFor(
  url: string,
  reason: UnresolvedReason,
  filePath: string,
): string {
  if (reason === "missing") {
    return (
      `Portosaur: the link to "${url}" in "${filePath}" points at a file that does not exist. ` +
      "The link is left as-is."
    );
  }
  if (reason === "outside") {
    return (
      `Portosaur: the link to "${url}" in "${filePath}" points outside the content directories. ` +
      "The link is left as-is."
    );
  }
  return (
    `Portosaur: the link to "${url}" in "${filePath}" could not be decoded. ` +
    "The link is left as-is."
  );
}

export default function remarkFileLinks(contentDirs: ContentDir[] = []) {
  if (contentDirs.length === 0) {
    return (tree: any) => tree;
  }
  return (tree: any, file: any) => {
    // fumadocs-mdx sets the vfile path to the source file; without
    // it there is nothing to resolve relative links against.
    const currentPath = typeof file?.path === "string" ? file.path : undefined;
    if (!currentPath) {
      return;
    }
    const currentDir = path.dirname(currentPath);
    const rewrite = (url: string, node: any): string => {
      if (!isRelativeFileLink(url)) {
        return url;
      }
      const result = resolveFileLink(url, currentDir, contentDirs);
      if (result.ok) {
        return result.url;
      }
      const message = warningFor(url, result.reason, currentPath);
      file.message(message, node);
      // fumadocs-mdx drops vfile messages, so a file.message
      // alone never reaches the build log — print it too.
      console.warn(message);
      return url;
    };
    visit(tree, "link", (node) => {
      node.url = rewrite(node.url, node);
    });
    visit(tree, "definition", (node) => {
      node.url = rewrite(node.url, node);
    });
    const handleJsx = (node: any): void => {
      if (node.name !== "Link" && node.name !== "Btn") {
        return;
      }
      // Link takes only `href`. Btn keeps its `to`/`href` pair.
      const linkAttrs = node.name === "Link" ? ["href"] : ["to", "href"];
      for (const attr of node.attributes ?? []) {
        // Only plain string attributes (`href="./page.mdx"`) — an
        // expression value (`href={...}`) cannot be resolved at
        // build time.
        if (
          attr.type !== "mdxJsxAttribute" ||
          !linkAttrs.includes(attr.name) ||
          typeof attr.value !== "string"
        ) {
          continue;
        }
        attr.value = rewrite(attr.value, node);
      }
    };
    visit(tree, "mdxJsxFlowElement", handleJsx);
    visit(tree, "mdxJsxTextElement", handleJsx);
  };
}
