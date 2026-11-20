/**
 * Sidebar tree preparation — server-side.
 *
 * The client `Sidebar` component cannot import `lib/icons.ts` (the
 * Iconify packs are megabytes of JSON), so the tree is prepared on
 * the server: each row's icon is pre-rendered to an HTML string
 * (with the deduplicated sprite, see `collectSidebarSprite`) and the
 * Fumadocs tree is flattened into plain serializable items the
 * client component can receive as props.
 *
 * The row shape mirrors the Astro `porto:sidebar` nodes: doc items
 * with `href`, categories with an optional index `link` + `items`.
 * A folder's index page becomes the category link (index-as-category-
 * link). A folder without an index renders as a plain group label.
 */

import type * as PageTree from "fumadocs-core/page-tree";
import {
  collectSidebarSprite,
  renderSidebarIcon,
  type SidebarSpriteItem,
} from "./icons.ts";
import { nodeName } from "./content.ts";

/** One sidebar row, serializable across the server/client boundary. */
export interface SidebarItem {
  /** "doc" for a page row, "category" for a folder row. */
  type: "doc" | "category";
  label: string;
  /** The row's link (docs always. Categories only with an index page). */
  href?: string;
  /** Pre-rendered icon HTML (empty string when nothing resolves). */
  iconHtml: string;
  /** The frontmatter `color`, when declared — colors the icon. */
  color?: string;
  /** Category children (categories only). */
  items?: SidebarItem[];
  /** Whether the row's link is the current page (set client-side). */
  active?: boolean;
}

/** The prepared sidebar: its rows plus the icon sprite markup. */
export interface PreparedSidebar {
  items: SidebarItem[];
  /** The sprite markup (`""` when no sprite is worthwhile). */
  spriteHtml: string;
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

/** Adapts a Fumadocs tree to the sprite collector's shape. */
function toSpriteItems(nodes: PageTree.Node[]): SidebarSpriteItem[] {
  const items: SidebarSpriteItem[] = [];
  for (const node of nodes) {
    if (node.type === "separator") {
      continue;
    }
    if (node.type === "page") {
      items.push({ icon: nodeIcon(node), label: nodeName(node) });
      continue;
    }
    items.push({
      icon: nodeIcon(node) ?? nodeIcon(node.index),
      label: nodeName(node),
      type: "category",
      items: toSpriteItems(node.children),
    });
  }
  return items;
}

/** Converts one tree node to a serializable sidebar item. */
function toSidebarItem(
  node: PageTree.Node,
  spriteIds: Set<string>,
): SidebarItem | null {
  if (node.type === "separator") {
    return null;
  }
  if (node.type === "page") {
    return {
      type: "doc",
      label: nodeName(node),
      href: node.url,
      iconHtml: renderSidebarIcon(
        nodeIcon(node),
        { slug: nodeName(node), fallbackIcon: "md:notebook" },
        spriteIds,
      ),
      color: nodeColor(node),
    };
  }
  const children: SidebarItem[] = [];
  for (const child of node.children) {
    const item = toSidebarItem(child, spriteIds);
    if (item) {
      children.push(item);
    }
  }
  return {
    type: "category",
    label: nodeName(node),
    href: node.index?.url,
    iconHtml: renderSidebarIcon(
      nodeIcon(node) ?? nodeIcon(node.index),
      { slug: nodeName(node), fallbackIcon: "md:folder" },
      spriteIds,
    ),
    color: nodeColor(node),
    items: children,
  };
}

/**
 * Prepares a Fumadocs page tree for the client sidebar: collects
 * the icon sprite once from the whole tree (so an icon repeated
 * across branches is still deduped), renders every row's icon, and
 * flattens the tree into serializable items.
 */
export function prepareSidebar(tree: PageTree.Root): PreparedSidebar {
  const sprite = collectSidebarSprite(toSpriteItems(tree.children));
  const items: SidebarItem[] = [];
  for (const node of tree.children) {
    const item = toSidebarItem(node, sprite.ids);
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
    spriteHtml: sprite.html,
    hash: urls.join("|"),
  };
}
