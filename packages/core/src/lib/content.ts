/**
 * Shared helpers for the doc routes — prev/next, TOC nesting,
 * and the Docusaurus page-title rules.
 *
 * Ported from the Astro app (`packages/app/src/utils/content.ts`),
 * adapted to the Fumadocs page tree (`PageTree.Root` from
 * `fumadocs-core/page-tree`) instead of the Astro `porto:sidebar`
 * tree. The node shapes differ — a Fumadocs `Folder` carries its
 * index page as `index?: Item`, a category without an index has no
 * link — but the behaviors are the same.
 */

import type { TOCItemType } from "fumadocs-core/toc";
import type * as PageTree from "fumadocs-core/page-tree";
import type { ReactNode } from "react";
import { pageHref } from "./pageUrl.ts";

/** One `{ title, href }` prev-next link. */
export interface SidebarLink {
  title: string;
  href: string;
}

/** Normalizes an href for comparison (trailing slashes ignored). */
function normalizeHref(href: string | null | undefined): string {
  return (href ?? "").replace(/\/+$/, "") || "/";
}

/** The display name of a tree node (always a string in practice). */
export function nodeName(node: PageTree.Node): string {
  return typeof node.name === "string" ? node.name : String(node.name ?? "");
}

/**
 * Flattens the page tree into its doc-link order: every page plus
 * every folder that has an index page, depth-first, in tree order.
 * The collection home is not in the tree — callers prepend it (see
 * `findPrevNext`).
 */
function flattenTreeLinks(tree: PageTree.Node[] | undefined): SidebarLink[] {
  const links: SidebarLink[] = [];
  function walk(nodes: PageTree.Node[]): void {
    for (const node of nodes) {
      if (node.type === "separator") {
        continue;
      }
      if (node.type === "page") {
        links.push({ title: nodeName(node), href: node.url });
      } else if (node.type === "folder") {
        if (node.index) {
          // A folder link carries its index page's title when one
          // exists (the paginator uses the doc title, not the
          // folder label — e.g. "Portosaur Docs", not "Docs").
          links.push({
            title: nodeName(node.index),
            href: node.index.url,
          });
        }
        walk(node.children);
      }
    }
  }
  walk(tree ?? []);
  return links;
}

/**
 * The previous/next doc links around `href` in flattened tree
 * doc-link order (trailing slashes ignored). The collection home
 * (`home`) is prepended first — it is a real page too, and the first
 * doc's "Previous" link points at it. Returns `{ prev, next }` where
 * each side is `{ title, href }` or `null` at the ends — or when
 * `href` is not in the tree at all.
 */
export function findPrevNext(
  tree: PageTree.Node[] | undefined,
  href: string,
  home?: SidebarLink | null,
): { prev: SidebarLink | null; next: SidebarLink | null } {
  const normalized = normalizeHref(href);
  const links = flattenTreeLinks(tree);
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
 * Finds a folder node in the page tree by its index href (trailing
 * slashes ignored). Returns the folder's `children` (pages +
 * subfolders, in tree order) or an empty array. The collection home
 * has no folder in the tree (there is no root category) — when `href`
 * matches `homeHref`, the top-level items are returned instead.
 */
export function findCategoryItems(
  tree: PageTree.Node[],
  href: string,
  homeHref?: string,
): PageTree.Node[] {
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
    if (node.type !== "folder") {
      continue;
    }
    const linkHref = (node.index?.url ?? "").replace(/\/+$/, "") || "/";
    if (linkHref === normalized) {
      return node.children ?? [];
    }
    stack.push(...(node.children ?? []));
  }
  return [];
}

/**
 * Whether an `icon` value is a literal emoji rather than an `id:`
 * icon reference: emoji has no colon, so it renders as text in the
 * card's icon span instead of an SVG.
 */
export function isEmojiIcon(icon: unknown): icon is string {
  return typeof icon === "string" && icon !== "" && !icon.includes(":");
}

/**
 * One topic-list card: the title and the page it links to, plus the
 * description and icon the card renders (the Docusaurus `TopicCard`
 * shape). Categories also carry their linkable child count, so the
 * card can prefix the description with it ("3 items • ...").
 */
export interface TopicListItem {
  title: string;
  href: string;
  description?: string;
  icon?: string;
  color?: string;
  isCategory?: boolean;
  itemsCount?: number;
}

function nodeColor(node: PageTree.Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  const color = (node as { color?: unknown }).color;
  return typeof color === "string" && color !== "" ? color : undefined;
}

/* A child that would itself render as a card: a page, or a folder
 * with an index page to link to. Separators and index-less folders
 * are not counted. */
function isCardChild(node: PageTree.Node): boolean {
  if (node.type === "page") {
    return true;
  }
  if (node.type === "folder") {
    return node.index !== undefined;
  }
  return false;
}

function nodeToCard(node: PageTree.Node): TopicListItem | null {
  if (node.type === "page") {
    const color = nodeColor(node);
    return {
      title: nodeName(node),
      href: pageHref(node.url),
      /* A node description is a ReactNode in Fumadocs' types —
         only a plain string renders as card text. */
      description:
        typeof node.description === "string" ? node.description : undefined,
      icon: typeof node.icon === "string" ? node.icon : undefined,
      ...(color ? { color } : {}),
    };
  }
  if (node.type === "folder" && node.index) {
    const color = nodeColor(node) ?? nodeColor(node.index);
    return {
      title: nodeName(node),
      href: pageHref(node.index.url),
      /* A folder description is a ReactNode in Fumadocs' types —
         only a plain string renders as card text. */
      description:
        typeof node.description === "string"
          ? node.description
          : typeof node.index.description === "string"
            ? node.index.description
            : undefined,
      icon:
        typeof node.icon === "string"
          ? node.icon
          : typeof node.index.icon === "string"
            ? node.index.icon
            : undefined,
      ...(color ? { color } : {}),
      isCategory: true,
      itemsCount: (node.children ?? []).filter(isCardChild).length,
    };
  }
  return null;
}

/**
 * Maps tree nodes to topic-list cards (folders without an index
 * page are skipped — a card linking nowhere is worse than no
 * card). Lives here, not in the `TopicList` component file, so
 * server components can call it: the component file is a client
 * module (`"use client"` for its context), and server code cannot
 * call functions from a client module.
 */
export function topicListCards(nodes: PageTree.Node[]): TopicListItem[] {
  return nodes
    .map(nodeToCard)
    .filter((card): card is TopicListItem => card !== null);
}

/* Doc-page title rules (`docPageTitles`, `docFileTitle`,
 * `humanizeName`, `pageTitle`, `PAGE_TITLE_ID`) live in
 * `lib/docPage.ts` (coordinator-owned) — the single source of truth
 * for heading + metadata title resolution. This module holds the
 * tree/TOC helpers only. */

/** A flat heading from the page TOC (depth 2–3 after filtering). */
export interface TocHeading {
  depth: number;
  slug: string;
  text: string;
}

/** A heading nested for the table of contents (each heading under
 * the nearest shallower heading before it). */
export interface TocItem {
  depth: number;
  slug: string;
  text: string;
  children: TocItem[];
}

/**
 * Extracts plain text from a TOC title. Fumadocs' `TOCItemType.title`
 * is a `ReactNode`, and rehypeToc always emits it as a JSX element
 * (a fragment wrapping the heading's children) — never a bare string.
 * A naive `typeof title === "string"` check drops every heading, so
 * the TOC renders empty. This walks the node tree (strings, numbers,
 * arrays, elements' children) and concatenates the text parts.
 */
function tocTitleText(title: ReactNode): string {
  if (typeof title === "string" || typeof title === "number") {
    return String(title);
  }
  if (Array.isArray(title)) {
    return title.map(tocTitleText).join("");
  }
  if (
    title &&
    typeof title === "object" &&
    "props" in title &&
    title.props &&
    typeof title.props === "object" &&
    "children" in title.props
  ) {
    return tocTitleText((title.props as { children?: ReactNode }).children);
  }
  return "";
}

/**
 * Converts Fumadocs TOC items to flat headings: the URL fragment
 * becomes the slug, the title's text becomes the text. H1s are
 * dropped — the hoisted H1 is gone from the TOC by the time the
 * page renders, and a stray H1 must not enter the list. `options`
 * narrows the levels shown (the `site.content.toc` min/max levels,
 * overridden per page): headings shallower than `minLevel` or
 * deeper than `maxLevel` are dropped. The floor stays 2 even when
 * `minLevel` is lower — the TOC never shows an H1.
 */
export function tocToHeadings(
  toc: TOCItemType[],
  options: { minLevel?: number; maxLevel?: number } = {},
): TocHeading[] {
  const minLevel = Math.max(2, options.minLevel ?? 2);
  const maxLevel = options.maxLevel ?? 6;
  const headings: TocHeading[] = [];
  for (const item of toc) {
    if (item.depth < minLevel || item.depth > maxLevel) {
      continue;
    }
    const hashIndex = item.url.indexOf("#");
    const slug =
      hashIndex === -1 ? "" : decodeURIComponent(item.url.slice(hashIndex + 1));
    const text = tocTitleText(item.title);
    if (slug && text) {
      headings.push({ depth: item.depth, slug, text });
    }
  }
  return headings;
}

/** The effective table of contents settings for one page. */
export interface TocSettings {
  enable: boolean;
  minLevel: number;
  maxLevel: number;
}

/**
 * The table of contents settings for one page: the global
 * `site.content.toc` values, overridden field by field by the
 * page's `toc` frontmatter. An unset frontmatter
 * field falls back to the global value.
 */
export function resolveTocSettings(
  global: TocSettings,
  frontmatter?: {
    enable?: boolean;
    min_level?: number;
    max_level?: number;
  },
): TocSettings {
  return {
    enable: frontmatter?.enable ?? global.enable,
    minLevel: frontmatter?.min_level ?? global.minLevel,
    maxLevel: frontmatter?.max_level ?? global.maxLevel,
  };
}

/**
 * Nests a flat heading list into a TOC tree: each heading nests
 * under the nearest preceding heading shallower than it, so h3s
 * sit under their h2 and h4s under their h3. A heading with no
 * shallower heading before it (an orphan h3, a leading h4)
 * promotes to top-level. The tree shape is what
 * `TableOfContentsList` renders.
 */
export function nestHeadings(headings: TocHeading[]): TocItem[] {
  const tree: TocItem[] = [];
  const stack: TocItem[] = [];
  for (const heading of headings) {
    const item: TocItem = { ...heading, children: [] };
    // Pop headings as deep as this one or deeper — the heading
    // nests under the nearest preceding heading shallower than it.
    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(item);
    } else {
      tree.push(item);
    }
    stack.push(item);
  }
  return tree;
}

/**
 * Whether the automatic topic list renders on a doc page — the
 * `TopicList` component's `shouldRender` rule: explicit frontmatter
 * `topic_list` (false / true / `{ enable }`) wins. Otherwise the list
 * renders on index/README pages when globally enabled.
 */
export function topicListShouldRender(
  topicListConfig: unknown,
  isIndexPage: boolean,
  enableByDefaults: boolean,
): boolean {
  if (topicListConfig === false) {
    return false;
  }
  if (topicListConfig === true) {
    return true;
  }
  if (typeof topicListConfig === "object" && topicListConfig !== null) {
    const enable = (topicListConfig as { enable?: unknown }).enable;
    if (enable === false) {
      return false;
    }
    if (enable === true) {
      return true;
    }
  }

  return enableByDefaults && isIndexPage;
}

/**
 * A blog post's slug: the frontmatter `slug` wins (leading slash
 * stripped). Otherwise the file base name with a leading `YYYY-MM-DD-`
 * date prefix stripped (the Docusaurus blog rule). Blog posts are flat —
 * subdirectories do not appear in the slug.
 */
export function blogSlug(id: string, slug?: string): string {
  if (slug) {
    return String(slug).replace(/^\//, "");
  }
  const segments = id.split("/");
  const base = segments[segments.length - 1];
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}
