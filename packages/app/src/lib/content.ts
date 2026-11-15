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
 * The text a topic-list card renders for a tree node: an emoji icon
 * (a literal emoji, not an `id:` icon reference, which renders as SVG
 * and contributes no text) prepended directly to the label.
 */
export function topicCardTitle(node: PageTree.Node): string {
  const icon = typeof node.icon === "string" ? node.icon : "";
  const prefix = icon && !icon.includes(":") ? icon : "";
  return `${prefix}${nodeName(node)}`;
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
  isCategory?: boolean;
  itemsCount?: number;
  /**
   * The icon as resolved HTML, filled in server-side (the icon packs
   * are megabytes of JSON and must never load client-side). Items
   * passed manually — without a server resolution step — carry no
   * icon HTML and render without an icon.
   */
  iconHtml?: string;
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
    return {
      title: topicCardTitle(node),
      href: pageHref(node.url),
      /* A node description is a ReactNode in Fumadocs' types —
         only a plain string renders as card text. */
      description:
        typeof node.description === "string" ? node.description : undefined,
      icon: typeof node.icon === "string" ? node.icon : undefined,
    };
  }
  if (node.type === "folder" && node.index) {
    return {
      title: topicCardTitle(node),
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
      isCategory: true,
      itemsCount: (node.children ?? []).filter(isCardChild).length,
    };
  }
  return null;
}

/** The topic-list description when no frontmatter provides one. */
export const TOPIC_LIST_DEFAULT_DESC =
  "Click on the links below to explore the topics.";

/**
 * The description line above a topic list (the Docusaurus
 * resolution, minus the component-level props, which the
 * `TopicList` component resolves itself): the frontmatter
 * `topic_list.desc` wins (`null` disables the line entirely), then
 * the page's own `desc`, then the default. A `topic_list` boolean
 * carries no description.
 */
export function topicListDesc(
  topicListConfig: unknown,
  pageDesc?: string,
): string | null {
  if (typeof topicListConfig === "object" && topicListConfig !== null) {
    const desc = (topicListConfig as { desc?: unknown }).desc;
    if (desc === null) {
      return null;
    }
    if (typeof desc === "string" && desc !== "") {
      return desc;
    }
  }
  if (typeof pageDesc === "string" && pageDesc !== "") {
    return pageDesc;
  }
  return TOPIC_LIST_DEFAULT_DESC;
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

/** A heading nested for the table of contents (h3s under their h2). */
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
 * page renders, and a stray H1 must not enter the list.
 */
export function tocToHeadings(toc: TOCItemType[]): TocHeading[] {
  const headings: TocHeading[] = [];
  for (const item of toc) {
    if (item.depth < 2) {
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
 * Whether the automatic topic list renders on a doc page — the
 * `TopicList` component's `shouldRender` rule: explicit frontmatter
 * `topic_list` (false / true / `{ enable }`) wins; otherwise the list
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
 * stripped); otherwise the file base name with a leading `YYYY-MM-DD-`
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
