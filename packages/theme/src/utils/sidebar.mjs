import { NUMBER_PREFIX_PATTERN, isIndexBase } from "./slug.mjs";

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
 *   link and is removed from the list (the root index becomes the root
 *   category's link, so it never appears as a list item).
 * - Category labels come from the linked index doc's `sidebar_label` or
 *   `title` when one exists (verified against the Docusaurus build: the
 *   sidebar shows "Configuration Guide", the index doc's title, not
 *   "Config", the humanized dirname) and fall back to the humanized
 *   directory name for categories without an index doc.
 * - Frontmatter enrichment: `icon`, `color`, `description` from the linked
 *   index doc's frontmatter on categories, and from a doc's own
 *   frontmatter on doc items — only when present.
 * - `Docs` root fallback: when no root index exists, the root category
 *   links to the collection home (`routeBase`, or `/`).
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
 * Return shape: a one-element array holding the root category:
 *   [{
 *     type: "category", label: "Docs",
 *     link: { href: "/notes" },          // root index href, or the fallback
 *     icon, color, description,          // from the root index, when present
 *     items: [
 *       { type: "category", label: "Guide",
 *         link: { href: "/notes/guide" }, // only when an index doc exists
 *         icon, color, description, items: [...] },
 *       { type: "doc", label: "Intro", href: "/notes/intro", id: "intro",
 *         icon, color, description },
 *     ],
 *   }]
 */

const NUMBER_PATTERN = /^(\d+(?:\.\d+)*)/;

/**
 * Humanizes a raw file or directory name into a label: strips the number
 * prefix, turns separators into spaces, capitalizes each word.
 * ("4 - getting-started" -> "Getting Started")
 */
function humanizeName(name) {
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
function sortKey(name, frontMatter) {
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

function compareSortKeys(a, b) {
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
function addEnrichment(item, data) {
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

function createDirNode(name) {
  return { name, dirs: new Map(), docs: [], indexEntry: null };
}

/**
 * Builds one doc link item from a collection entry.
 */
function docToItem({ entry, fileBase }, hrefFor) {
  const data = entry.data ?? {};
  const item = {
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
function buildItems(node, hrefFor) {
  const siblings = [];

  for (const dir of node.dirs.values()) {
    // A category's label is its index doc's sidebar_label/title when one
    // exists, else the humanized directory name.
    const indexData = dir.indexEntry?.data ?? {};
    const label =
      indexData.sidebar_label ?? indexData.title ?? humanizeName(dir.name);
    siblings.push({
      key: sortKey(dir.name, dir.indexEntry?.data),
      label,
      item: dirToCategory(dir, label, hrefFor, false),
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
 * from its index doc — except the root, which falls back to the collection
 * home when no root index exists.
 */
function dirToCategory(node, label, hrefFor, isRoot) {
  const category = { type: "category", label };

  if (node.indexEntry) {
    category.link = {
      href: hrefFor(node.indexEntry.slug ?? node.indexEntry.id),
    };
    addEnrichment(category, node.indexEntry.data);
  } else if (isRoot) {
    category.link = { href: hrefFor("") };
  }

  category.items = buildItems(node, hrefFor);
  return category;
}

/**
 * Builds the sidebar tree for a content collection.
 *
 * @param {Array<{ id: string, slug: string, data: object }>} entries -
 *   Collection entries, each with its `id`, its resolved `slug` (from the
 *   canonical slug util, no leading slash), and its frontmatter `data`.
 * @param {object} [options]
 * @param {string} [options.rootLabel] - Label of the root category
 *   ("Docs" in docs mode, "Notes" in notes mode). Default: "Docs".
 * @param {string} [options.routeBase] - The collection's route prefix
 *   (e.g. "/notes"); prepended to every href. Default: "".
 * @returns {Array} A one-element array holding the root category (see the
 *   module doc comment for the full shape).
 */
export function buildSidebar(entries, options = {}) {
  const { rootLabel = "Docs", routeBase = "" } = options;
  const base = routeBase.replace(/\/+$/, "");
  const hrefFor = (slug) => {
    if (slug) {
      return `${base}/${slug}`;
    }
    return base || "/";
  };

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
      if (!node.dirs.has(segment)) {
        node.dirs.set(segment, createDirNode(segment));
      }
      node = node.dirs.get(segment);
    }

    const fileBase = segments[segments.length - 1];
    if (isIndexBase(fileBase)) {
      node.indexEntry = entry;
    } else {
      node.docs.push({ entry, fileBase });
    }
  }

  return [dirToCategory(root, rootLabel, hrefFor, true)];
}
