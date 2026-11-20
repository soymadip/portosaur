/**
 * Sidebar tree preparation — server-side.
 *
 * The tree is flattened into plain serializable items the client
 * component can receive as props. Each row carries its raw icon
 * value, its slug, and its fallback icon — the client `Sidebar`
 * renders the icon itself (`SiteIcon`).
 *
 * The row shape mirrors the Astro `porto:sidebar` nodes: doc items
 * with `href`, categories with an optional index `link` + `items`.
 * A folder's index page becomes the category link (index-as-category-
 * link). A folder without an index renders as a plain group label.
 */

import type * as PageTree from "fumadocs-core/page-tree";
import type { DynamicIconValue } from "./site-icons.ts";
import { nodeName } from "./content.ts";

/** One sidebar row, serializable across the server/client boundary. */
export interface SidebarItem {
  /** "doc" for a page row, "category" for a folder row. */
  type: "doc" | "category";
  label: string;
  /** The row's link (docs always. Categories only with an index page). */
  href?: string;
  /** The raw frontmatter `icon` value, when declared. */
  icon?: DynamicIconValue;
  /** The slug the icon guess falls back to (the row's name). */
  slug: string;
  /** The fallback icon id when nothing else resolves. */
  fallbackIcon: string;
  /** The frontmatter `color`, when declared — colors the icon. */
  color?: string;
  /** Category children (categories only). */
  items?: SidebarItem[];
  /** Whether the row's link is the current page (set client-side). */
  active?: boolean;
}

/** The prepared sidebar: its rows plus the state key. */
export interface PreparedSidebar {
  items: SidebarItem[];
  /** A hash of the tree's URLs — the scroll/expand state key. */
  hash: string;
}

/** The icon value of a tree node (a string in practice). */
function nodeIcon(node: PageTree.Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  return typeof node.icon === "string" ? node.icon : undefined;
}

/**
 * The frontmatter `color` of a tree node. The loader's `file`
 * transformer copies `data.color` onto the node as an extra field.
 * It is not part of the Fumadocs node type, so it is read
 * defensively.
 */
function nodeColor(node: PageTree.Node): string | undefined {
  const color = (node as { color?: unknown }).color;
  return typeof color === "string" ? color : undefined;
}

/** Converts one tree node to a serializable sidebar item. */
function toSidebarItem(node: PageTree.Node): SidebarItem | null {
  if (node.type === "separator") {
    return null;
  }
  if (node.type === "page") {
    return {
      type: "doc",
      label: nodeName(node),
      href: node.url,
      icon: nodeIcon(node),
      slug: nodeName(node),
      fallbackIcon: "md:notebook",
      color: nodeColor(node),
    };
  }
  const children: SidebarItem[] = [];
  for (const child of node.children) {
    const item = toSidebarItem(child);
    if (item) {
      children.push(item);
    }
  }
  return {
    type: "category",
    label: nodeName(node),
    href: node.index?.url,
    icon: nodeIcon(node) ?? nodeIcon(node.index),
    slug: nodeName(node),
    fallbackIcon: "md:folder",
    color: nodeColor(node),
    items: children,
  };
}

/**
 * Prepares a Fumadocs page tree for the client sidebar: flattens
 * the tree into serializable items (see `SidebarItem`).
 */
export function prepareSidebar(tree: PageTree.Root): PreparedSidebar {
  const items: SidebarItem[] = [];
  for (const node of tree.children) {
    const item = toSidebarItem(node);
    if (item) {
      items.push(item);
    }
  }
  const urls: string[] = [];
  const collectUrls = (nodes: SidebarItem[]) => {
    for (const node of nodes) {
      if (node.href) {
        urls.push(node.href);
      }
      if (node.items) {
        collectUrls(node.items);
      }
    }
  };
  collectUrls(items);
  return {
    items,
    hash: urls.join("|"),
  };
}
