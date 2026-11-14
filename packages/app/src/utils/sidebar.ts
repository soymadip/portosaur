import { NUMBER_PREFIX_PATTERN, isIndexBase } from "./slug.ts";
import type { Frontmatter } from "./slug.ts";

/**
 * Sidebar builder for Portosaur content collections.
 *
 * Phase 2 rewrite of the old Docusaurus-plugin-coupled
 * `createSidebarItemsGenerator` (which took `defaultSidebarItemsGenerator`,
 * `numberPrefixParser`, `args.docs`). The new builder takes a plain array
 * of collection entries and returns a plain sidebar tree, with the same
 * semantics:
 *
 * - Index-as-category-link: an `index`/`README` doc becomes its category's
 *   link and is removed from the list. The root index is hidden the same
 *   way — it never appears as a list item, and there is no root category
 *   wrapping the tree (the old Docusaurus "Docs"/"Notes" root is gone).
 * - Category labels come from the linked index doc's `sidebar_label` or
 *   `title` when one exists (verified against the Docusaurus build: the
 *   sidebar shows "Configuration Guide", the index doc's title, not
 *   "Config", the humanized dirname) and fall back to the humanized
 *   directory name for categories without an index doc.
 * - Frontmatter enrichment: `icon`, `color`, `description` from the linked
 *   index doc's frontmatter on categories, and from a doc's own
 *   frontmatter on doc items — only when present.
 * - Ordering: siblings sort by `sidebar_position` frontmatter, then by
 *   number prefix (`1 - x` < `4.1 - x` < `10 - x`, compared numerically),
 *   then alphabetically by label. Categories and docs sort together.
 *
 * Entry shape (from `getCollection`, with the slug resolved by the
 * canonical slug util):
 *   { id: "guide/setup", slug: "guide/setup", data: { title, icon, ... } }
 * `id` is the collection entry id (path without extension); the tree
 * follows the `id` directory structure, while hrefs come from `slug`.
 *
 * Return shape: the root's children — the top-level items, no wrapper:
 *   [
 *     { type: "category", label: "Guide",
 *       link: { href: "/notes/guide", title: "Guide" }, // only when an
 *         // index doc exists; title omitted when the doc has none
 *       icon, color, description, items: [...] },
 *     { type: "doc", label: "Intro", href: "/notes/intro", id: "intro",
 *       icon, color, description },
 *   ]
 *
 * The collection home link (root index title + href, for pagination)
 * lives outside the tree — see `buildSidebarHome`. Both modes render
 * the tree as-is, categories and all, so breadcrumbs and pagination
 * keep their category structure.
 */

/** A collection entry, with its slug resolved by the canonical slug util. */
export interface SidebarEntry {
  id: string;
  slug: string;
  data?: Frontmatter | null;
}

/** One doc link in the sidebar tree. */
export interface SidebarDocItem {
  type: "doc";
  label: string;
  href: string;
  id: string;
  icon?: string;
  color?: string;
  description?: string;
}

/** One category in the sidebar tree. */
export interface SidebarCategoryItem {
  type: "category";
  label: string;
  link?: { href: string; title?: string };
  icon?: string;
  color?: string;
  description?: string;
  items: SidebarItem[];
}

export type SidebarItem = SidebarDocItem | SidebarCategoryItem;

export interface BuildSidebarOptions {
  /** Label of the collection ("Docs" in docs mode, "Notes" in notes mode)
   * — the home link's fallback title when no root index doc exists.
   * Default: "Docs". */
  sectionLabel?: string;
  /** The collection's route prefix (e.g. "/notes"); prepended to every
   * href. Default: "". */
  routeBase?: string;
}

/** The collection home link, for pagination (see `buildSidebarHome`). */
export interface SidebarHomeLink {
  title: string;
  href: string;
}

/** One directory node while the entry list is grouped into a tree. */
interface DirNode {
  name: string;
  dirs: Map<string, DirNode>;
  docs: { entry: SidebarEntry; fileBase: string }[];
  indexEntry: SidebarEntry | null;
}

const NUMBER_PATTERN = /^(\d+(?:\.\d+)*)/;

/**
 * Humanizes a raw file or directory name into a label: strips the number
 * prefix, turns separators into spaces, capitalizes each word.
 * ("4 - getting-started" -> "Getting Started")
 */
function humanizeName(name: string): string {
  const stripped = name.replace(NUMBER_PREFIX_PATTERN, "");
  return stripped
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Sort key for a sibling: `sidebar_position` first, then the number
 * prefix as a numeric array (`4.1` -> [4, 1]), else null (sorts last,
 * alphabetically). `sidebar_position` is normalized to a one-element
 * array so it compares with number prefixes.
 */
function sortKey(
  name: string,
  frontMatter?: Frontmatter | null,
): number[] | null {
  const position = frontMatter?.sidebar_position;
  if (typeof position === "number") {
    return [position];
  }
  const match = NUMBER_PATTERN.exec(name);
  if (match) {
    return match[1].split(".").map(Number);
  }
  return null;
}

function compareSortKeys(a: number[] | null, b: number[] | null): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) {
      return x - y;
    }
  }
  return 0;
}

/**
 * Copies frontmatter enrichment onto a sidebar item, only when present.
 */
function addEnrichment(
  item: SidebarDocItem | SidebarCategoryItem,
  data?: Frontmatter | null,
): void {
  if (!data) {
    return;
  }
  if (data.icon !== undefined) {
    item.icon = data.icon;
  }
  if (data.color !== undefined) {
    item.color = data.color;
  }
  if (data.description !== undefined) {
    item.description = data.description;
  }
}

function createDirNode(name: string): DirNode {
  return { name, dirs: new Map(), docs: [], indexEntry: null };
}

/**
 * Builds one doc link item from a collection entry.
 */
function docToItem(
  { entry, fileBase }: { entry: SidebarEntry; fileBase: string },
  hrefFor: (slug: string) => string,
): SidebarDocItem {
  const data = entry.data ?? {};
  const item: SidebarDocItem = {
    type: "doc",
    label: data.sidebar_label ?? data.title ?? humanizeName(fileBase),
    href: hrefFor(entry.slug ?? entry.id),
    id: entry.id,
  };
  addEnrichment(item, data);
  return item;
}

/**
 * Builds the sorted child items of one directory: subcategories and docs
 * together, ordered by position, then number prefix, then label.
 */
function buildItems(
  node: DirNode,
  hrefFor: (slug: string) => string,
): SidebarItem[] {
  const siblings: {
    key: number[] | null;
    label: string;
    item: SidebarItem;
  }[] = [];

  for (const dir of node.dirs.values()) {
    // A category's label is its index doc's sidebar_label/title when one
    // exists, else the humanized directory name.
    const indexData = dir.indexEntry?.data ?? {};
    const label =
      indexData.sidebar_label ?? indexData.title ?? humanizeName(dir.name);
    siblings.push({
      key: sortKey(dir.name, dir.indexEntry?.data),
      label,
      item: dirToCategory(dir, label, hrefFor),
    });
  }

  for (const doc of node.docs) {
    const data = doc.entry.data ?? {};
    siblings.push({
      key: sortKey(doc.fileBase, data),
      label: data.sidebar_label ?? data.title ?? humanizeName(doc.fileBase),
      item: docToItem(doc, hrefFor),
    });
  }

  siblings.sort((a, b) => {
    const byKey = compareSortKeys(a.key, b.key);
    if (byKey !== 0) {
      return byKey;
    }
    return a.label.localeCompare(b.label);
  });

  return siblings.map((sibling) => sibling.item);
}

/**
 * Builds one category from a directory node. A category gets a link only
 * from its index doc — categories without one have no link. The link
 * carries the index doc's title (not the sidebar label): the paginator
 * shows the doc title.
 */
function dirToCategory(
  node: DirNode,
  label: string,
  hrefFor: (slug: string) => string,
): SidebarCategoryItem {
  const category: SidebarCategoryItem = { type: "category", label, items: [] };

  if (node.indexEntry) {
    const link: { href: string; title?: string } = {
      href: hrefFor(node.indexEntry.slug ?? node.indexEntry.id),
    };
    const indexTitle = node.indexEntry.data?.title;
    if (indexTitle !== undefined) {
      link.title = indexTitle;
    }
    category.link = link;
    addEnrichment(category, node.indexEntry.data);
  }

  category.items = buildItems(node, hrefFor);
  return category;
}

/** An href for a resolved slug under a route base ("" -> the base, or "/"). */
function hrefForSlug(base: string, slug: string): string {
  if (slug) {
    return `${base}/${slug}`;
  }
  return base || "/";
}

/**
 * Builds the sidebar tree for a content collection.
 *
 * @param entries - Collection entries, each with its `id`, its resolved
 *   `slug` (from the canonical slug util, no leading slash), and its
 *   frontmatter `data`.
 * @param options.routeBase - The collection's route prefix (e.g.
 *   "/notes"); prepended to every href. Default: "".
 * @returns The root's children — the top-level sidebar items, with no
 *   root wrapper (see the module doc comment for the full shape). The
 *   root index doc is hidden: it becomes neither an item nor a
 *   category — see `buildSidebarHome` for the home link it feeds.
 */
export function buildSidebar(
  entries: SidebarEntry[],
  options: BuildSidebarOptions = {},
): SidebarItem[] {
  const { routeBase = "" } = options;
  const base = routeBase.replace(/\/+$/, "");
  const hrefFor = (slug: string): string => hrefForSlug(base, slug);

  // Group entries into a directory tree by id segments
  const root = createDirNode("");

  for (const entry of entries) {
    const segments = entry.id.split("/").filter(Boolean);
    if (segments.length === 0) {
      continue;
    }

    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let dir = node.dirs.get(segment);
      if (!dir) {
        dir = createDirNode(segment);
        node.dirs.set(segment, dir);
      }
      node = dir;
    }

    const fileBase = segments[segments.length - 1];
    if (isIndexBase(fileBase)) {
      node.indexEntry = entry;
    } else {
      node.docs.push({ entry, fileBase });
    }
  }

  return buildItems(root, hrefFor);
}

/**
 * The collection home link, for pagination: the root index doc's title
 * and href when a root index exists, else the section label
 * ("Docs"/"Notes") and the collection home. The paginator shows the
 * doc title, not the sidebar label ("Portosaur Docs", not "Docs").
 *
 * The last root index wins on duplicates, mirroring the tree builder,
 * which overwrites the root index entry as it groups.
 */
export function buildSidebarHome(
  entries: SidebarEntry[],
  options: BuildSidebarOptions = {},
): SidebarHomeLink {
  const { routeBase = "", sectionLabel = "Docs" } = options;
  const base = routeBase.replace(/\/+$/, "");

  let rootIndex: SidebarEntry | null = null;
  for (const entry of entries) {
    if (!entry.id.includes("/") && isIndexBase(entry.id)) {
      rootIndex = entry;
    }
  }

  return {
    title: rootIndex?.data?.title ?? sectionLabel,
    href: hrefForSlug(base, rootIndex?.slug ?? ""),
  };
}
