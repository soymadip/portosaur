/**
 * Shared helpers for the injected routes.
 *
 * Slug resolution mirrors the integration's `porto:sidebar` virtual module
 * (same canonical slug util), so routes and the sidebar always agree.
 * Topic-list rules mirror the Docusaurus `TopicList` component
 * (`shouldRender` + `filterDocCardListItems` semantics, verified against
 * the golden snapshots).
 */

import path from "node:path";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import {
  guessDocPermalink,
  isIndexBase,
  NUMBER_PREFIX_PATTERN,
} from "./slug.ts";
import type { Frontmatter } from "./slug.ts";
import type { PortosaurOptions } from "../integration.ts";
import type { SidebarItem } from "./sidebar.ts";

/** A content collection entry (Astro `getCollection` shape, frontmatter untyped). */
export interface ContentEntry {
  id: string;
  data?: Frontmatter | null;
  filePath?: string;
}

/** A collection entry with its canonical slug resolved. */
export interface SluggedEntry {
  entry: ContentEntry;
  id: string;
  slug: string;
  data: Frontmatter;
}

/** One `{ title, href }` breadcrumb / prev-next link. */
export interface SidebarLink {
  title: string;
  href: string;
}

/**
 * The project-relative path of a content file, from an Astro glob-loader
 * `filePath` — the root-relative form (`../docs/guide/setup.mdx`, relative
 * to the generated `.portosaur/` project) or an absolute path. Leading
 * `..` segments are stripped; absolute paths resolve against the build
 * working directory first, then get the same treatment, so both shapes
 * come back as e.g. `docs/guide/setup.mdx`. Returns `null` when no path
 * is given or nothing remains after unwrapping.
 *
 * Callers strip their own content-dir prefix (e.g. the notes dir) when
 * they need a content-relative path for edit URLs.
 */
export function contentRelativePath(filePath?: string | null): string | null {
  if (!filePath) {
    return null;
  }
  let relative: string;
  if (path.isAbsolute(filePath)) {
    relative = path.relative(process.cwd(), filePath);
  } else {
    relative = filePath;
  }
  const segments = relative.split(path.sep).join("/").split("/");
  let index = 0;
  while (segments[index] === "..") {
    index += 1;
  }
  const rest = segments.slice(index).filter(Boolean);
  return rest.join("/") || null;
}

/** Docusaurus-style page title: `{page} | {site}`. */
export function pageTitle(page: string, siteTitle: string): string {
  return `${page} | ${siteTitle}`;
}

/** Whether a collection entry is an index/README file. */
export function isIndexEntry(entry: ContentEntry): boolean {
  const segments = entry.id.split("/");
  return isIndexBase(segments[segments.length - 1]);
}

/**
 * Resolves canonical slugs for a list of collection entries.
 * Returns `[{ entry, id, slug, data }]` — `slug` has no leading slash.
 */
export function withSlugs(entries: ContentEntry[]): SluggedEntry[] {
  const parentSlugs: Record<string, string> = {};
  for (const entry of entries) {
    const segments = entry.id.split("/");
    const base = segments[segments.length - 1];
    if (isIndexBase(base) && entry.data?.slug) {
      parentSlugs[segments.slice(0, -1).join("/")] = entry.data.slug;
    }
  }

  return entries.map((entry) => ({
    entry,
    id: entry.id,
    slug: guessDocPermalink(`${entry.id}.mdx`, entry.data ?? {}, parentSlugs)
      .slug,
    data: entry.data ?? {},
  }));
}

/**
 * Whether the automatic topic list renders on a doc page — the
 * `TopicList` component's `shouldRender` rule: explicit frontmatter
 * `topic_list` (false / true / `{ enable }`) wins; otherwise the list
 * renders on index/README pages when globally enabled.
 */
export function topicListShouldRender(
  entry: ContentEntry,
  options: PortosaurOptions,
): boolean {
  const topicListConfig = entry.data?.topic_list;
  const enableByDefaults = options.topicList?.enableByDefaults !== false;

  if (topicListConfig === false) {
    return false;
  }
  if (topicListConfig === true) {
    return true;
  }
  if (typeof topicListConfig === "object" && topicListConfig !== null) {
    if (topicListConfig.enable === false) {
      return false;
    }
    if (topicListConfig.enable === true) {
      return true;
    }
  }

  return enableByDefaults && isIndexEntry(entry);
}

/** Normalizes an href for comparison (trailing slashes ignored). */
function normalizeHref(href: string | null | undefined): string {
  return (href ?? "").replace(/\/+$/, "") || "/";
}

/**
 * The breadcrumb path for a sidebar href: the `{ title, href }` items
 * from the top-level item down to the item matching `href` (trailing
 * slashes ignored), or `[]` when no item matches. Categories without a
 * link (no index doc) appear with `href: null` — the layout renders
 * them as plain text, not links.
 *
 * The path has no section crumb — the tree carries no root category,
 * so the "Docs"/"Notes" crumb comes from the mode/route instead (see
 * `findBreadcrumbs`).
 */
export function findSidebarPath(
  tree: SidebarItem[] | undefined,
  href: string,
): { title: string; href: string | null }[] {
  const normalized = normalizeHref(href);
  const path: { title: string; href: string | null }[] = [];

  function walk(nodes: SidebarItem[]): boolean {
    for (const node of nodes) {
      const nodeHref =
        node.type === "doc" ? node.href : (node.link?.href ?? null);
      if (nodeHref && normalizeHref(nodeHref) === normalized) {
        path.push({ title: node.label, href: nodeHref });
        return true;
      }
      if (node.type === "category" && node.items) {
        path.push({ title: node.label, href: nodeHref });
        if (walk(node.items)) {
          return true;
        }
        path.pop();
      }
    }
    return false;
  }

  if (walk(tree ?? [])) {
    return path;
  }
  return [];
}

/**
 * The breadcrumb path for a sidebar href, with the section crumb
 * ("Docs"/"Notes" → the collection home) prepended: the tree carries
 * no root category, so the section crumb comes from the mode/route
 * instead of the tree. On the collection home itself the path is just
 * the section crumb; `[]` when the href is not in the tree at all.
 */
export function findBreadcrumbs(
  tree: SidebarItem[] | undefined,
  href: string,
  section: SidebarLink,
): { title: string; href: string | null }[] {
  const path = findSidebarPath(tree, href);
  if (path.length > 0) {
    return [section, ...path];
  }
  if (normalizeHref(href) === normalizeHref(section.href)) {
    return [{ title: section.title, href: section.href }];
  }
  return [];
}

/**
 * Flattens the sidebar tree into its doc-link order: every doc item plus
 * every category that has a link (its index doc), depth-first, in
 * sidebar order. The collection home is not in the tree — callers
 * prepend it (see `findPrevNext`).
 */
function flattenSidebarLinks(tree: SidebarItem[] | undefined): SidebarLink[] {
  const links: SidebarLink[] = [];
  function walk(nodes: SidebarItem[]): void {
    for (const node of nodes) {
      if (node.type === "doc") {
        links.push({ title: node.label, href: node.href });
      } else if (node.type === "category") {
        if (node.link?.href) {
          // A category link carries its index doc's title when one
          // exists (the paginator uses the doc title, not the sidebar
          // label — e.g. "Portosaur Docs", not "Docs").
          links.push({
            title: node.link.title ?? node.label,
            href: node.link.href,
          });
        }
        walk(node.items ?? []);
      }
    }
  }
  walk(tree ?? []);
  return links;
}

/**
 * The previous/next doc links around `href` in flattened sidebar
 * doc-link order (trailing slashes ignored). The collection home
 * (`home`) is prepended first — it is a real page too, and the first
 * doc's "Previous" link points at it. Returns `{ prev, next }` where
 * each side is `{ title, href }` or `null` at the ends — or when
 * `href` is not in the tree at all.
 */
export function findPrevNext(
  tree: SidebarItem[] | undefined,
  href: string,
  home?: SidebarLink | null,
): { prev: SidebarLink | null; next: SidebarLink | null } {
  const normalized = normalizeHref(href);
  const links = flattenSidebarLinks(tree);
  if (home) {
    links.unshift(home);
  }
  const index = links.findIndex(
    (link) => normalizeHref(link.href) === normalized,
  );
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? links[index - 1] : null,
    next: index < links.length - 1 ? links[index + 1] : null,
  };
}

/**
 * Finds a category node in the sidebar tree by its link href (trailing
 * slashes ignored). Returns the category's `items` (docs + subcategories,
 * in sidebar order) or an empty array. The collection home has no
 * category in the tree (there is no root category) — when `href`
 * matches `homeHref`, the top-level items are returned instead.
 */
export function findCategoryItems(
  tree: SidebarItem[],
  href: string,
  homeHref?: string,
): SidebarItem[] {
  const normalized = href.replace(/\/+$/, "") || "/";
  if (homeHref && normalized === (homeHref.replace(/\/+$/, "") || "/")) {
    return tree;
  }
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.type !== "category") {
      continue;
    }
    const linkHref = (node.link?.href ?? "").replace(/\/+$/, "") || "/";
    if (linkHref === normalized) {
      return node.items ?? [];
    }
    stack.push(...(node.items ?? []));
  }
  return [];
}

/**
 * The text a topic-list card renders for a sidebar item: an emoji icon
 * (a literal emoji, not an `id:` icon reference, which renders as SVG
 * and contributes no text) prepended directly to the label.
 */
export function topicCardTitle(item: SidebarItem): string {
  const icon = item.icon;
  const prefix = icon && !icon.includes(":") ? icon : "";
  return `${prefix}${item.label}`;
}

/** Humanizes a raw file or directory name into a label. */
export function humanizeName(name: string): string {
  const stripped = name.replace(NUMBER_PREFIX_PATTERN, "");
  return stripped
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** A doc's file-base title: the humanized last path segment. */
export function docFileTitle(entry: ContentEntry): string {
  const segments = entry.id.split("/");
  return humanizeName(segments[segments.length - 1]);
}

/** A doc's display title: frontmatter title, else the humanized file base. */
export function docTitle(entry: ContentEntry): string {
  if (entry.data?.title) {
    return entry.data.title;
  }
  return docFileTitle(entry);
}

/**
 * The content title heading: the first heading in Astro's `render()`
 * headings array, when it is an H1. Mirrors Docusaurus's
 * `contentTitle` remark plugin, which takes the first heading if it
 * is depth 1 (and stops at the first thematic break — Astro's
 * headings carry no thematic breaks, so that condition cannot be
 * checked here; a break before the first H1 is vanishingly rare).
 */
export function contentTitleHeading(headings: TocHeading[]): TocHeading | null {
  const first = headings[0];
  if (first && first.depth === 1) {
    return first;
  }
  return null;
}

/**
 * A doc page's heading and metadata title, mirroring Docusaurus
 * exactly (verified against `@docusaurus/plugin-content-docs` and
 * Portosaur's own `DocItem/Content` on main):
 *
 * - Metadata title: frontmatter title, else the content H1, else
 *   the caller-provided fallback (the humanized file base for doc
 *   pages, "Docs" for the notes index) — Docusaurus's
 *   `frontMatter.title ?? contentTitle ?? baseID`.
 * - Page heading: the synthetic `<h1>` renders ONLY when the content
 *   has no H1 of its own and `hide_title` is not set — OG renders
 *   `metadata.title` as an h1 only when `contentTitle` is undefined,
 *   so the content H1 is the page's one title when present and the
 *   page never shows two.
 */
export function docPageTitles(
  entry: ContentEntry | undefined,
  headings: TocHeading[],
  fallback: string,
): { heading: string | null; metaTitle: string } {
  const h1 = contentTitleHeading(headings);
  const hideTitle = entry?.data?.hide_title === true;
  const frontmatterTitle = entry?.data?.title;
  const metaTitle = frontmatterTitle ?? h1?.text ?? fallback;
  const heading = !h1 && !hideTitle ? (frontmatterTitle ?? fallback) : null;
  return { heading, metaTitle };
}

/** A flat heading from Astro's `render()` (depth 2–3 after filtering). */
export interface TocHeading {
  depth: number;
  slug: string;
  text: string;
}

/** A heading nested for the table of contents (h3s under their h2). */
export interface TocItem {
  depth: number;
  slug: string;
  text: string;
  children: TocItem[];
}

/**
 * Nests a flat heading list into a TOC tree: depth-2 headings are
 * top-level, depth-3 headings become children of the preceding depth-2
 * heading (an orphan h3 — no preceding h2 — promotes to top-level).
 * The tree shape is what `TableOfContentsList` renders.
 */
export function nestHeadings(headings: TocHeading[]): TocItem[] {
  const tree: TocItem[] = [];
  let currentParent: TocItem | null = null;
  for (const heading of headings) {
    const item: TocItem = { ...heading, children: [] };
    if (heading.depth === 2 || !currentParent) {
      tree.push(item);
      currentParent = item;
    } else {
      currentParent.children.push(item);
    }
  }
  return tree;
}

/**
 * A blog post's slug: the frontmatter `slug` wins (leading slash
 * stripped); otherwise the file base name with a leading `YYYY-MM-DD-`
 * date prefix stripped (the Docusaurus blog rule). Blog posts are flat —
 * subdirectories do not appear in the slug.
 */
export function blogSlug(entry: ContentEntry): string {
  if (entry.data?.slug) {
    return String(entry.data.slug).replace(/^\//, "");
  }
  const segments = entry.id.split("/");
  const base = segments[segments.length - 1];
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

/** Resolved post dates, keyed by file path — `postDate` shells out to
 * git, so sorting must not re-resolve the same file on every compare. */
const postDateCache = new Map<string, Date | null>();

/**
 * A blog post's date: frontmatter `date` (coerced by the schema) →
 * the file's last git commit date (`git log -1`, the Docusaurus
 * fallback) → the file's mtime. Null only when the source file
 * cannot be found. File-derived dates are memoized per file for
 * the build.
 */
export function postDate(entry: ContentEntry): Date | null {
  const date = entry.data?.date;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date;
  }
  const key = entry.filePath ?? entry.id;
  if (postDateCache.has(key)) {
    return postDateCache.get(key) ?? null;
  }
  const resolved = resolveFileDate(entry.filePath);
  postDateCache.set(key, resolved);
  return resolved;
}

/**
 * Git commit date, else mtime, for a content file — null when the
 * file cannot be found. `filePath` is an Astro glob-loader path
 * (see `contentRelativePath`); resolution runs against the build
 * working directory, which is the site root.
 */
function resolveFileDate(filePath?: string): Date | null {
  const relativePath = contentRelativePath(filePath);
  if (!relativePath) {
    return null;
  }
  const absolutePath = path.join(process.cwd(), relativePath);
  try {
    const gitDate = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", absolutePath],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    if (gitDate) {
      const parsed = new Date(gitDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  } catch {
    // Not a repo, untracked file, or git missing — fall to mtime.
  }
  try {
    return statSync(absolutePath).mtime;
  } catch {
    return null;
  }
}

/** Blog posts newest first; undated posts sort last, by id. */
export function sortPostsByDateDesc(posts: ContentEntry[]): ContentEntry[] {
  return [...posts].sort((a, b) => {
    const dateA = postDate(a);
    const dateB = postDate(b);
    if (dateA && dateB) {
      return dateB.getTime() - dateA.getTime();
    }
    if (dateA) {
      return -1;
    }
    if (dateB) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });
}
