/**
 * Shared helpers for the injected routes (Phase 2 stubs).
 *
 * Slug resolution mirrors the integration's `porto:sidebar` virtual module
 * (same canonical slug util), so routes and the sidebar always agree.
 * Topic-list rules mirror the Docusaurus `TopicList` component
 * (`shouldRender` + `filterDocCardListItems` semantics, verified against
 * the golden snapshots).
 */

import {
  guessDocPermalink,
  isIndexBase,
  NUMBER_PREFIX_PATTERN,
} from "../utils/slug.mjs";

/** Docusaurus-style page title: `{page} | {site}`. */
export function pageTitle(page, siteTitle) {
  return `${page} | ${siteTitle}`;
}

/** Whether a collection entry is an index/README file. */
export function isIndexEntry(entry) {
  const segments = entry.id.split("/");
  return isIndexBase(segments[segments.length - 1]);
}

/**
 * Resolves canonical slugs for a list of collection entries.
 * Returns `[{ entry, id, slug, data }]` — `slug` has no leading slash.
 */
export function withSlugs(entries) {
  const parentSlugs = {};
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
export function topicListShouldRender(entry, options) {
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

/**
 * Finds a category node in the sidebar tree by its link href (trailing
 * slashes ignored). Returns the category's `items` (docs + subcategories,
 * in sidebar order) or an empty array.
 */
export function findCategoryItems(tree, href) {
  const normalized = href.replace(/\/+$/, "") || "/";
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop();
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
export function topicCardTitle(item) {
  const icon = item.icon;
  const prefix = icon && !icon.includes(":") ? icon : "";
  return `${prefix}${item.label}`;
}

/** Humanizes a raw file or directory name into a label. */
export function humanizeName(name) {
  const stripped = name.replace(NUMBER_PREFIX_PATTERN, "");
  return stripped
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** A doc's display title: frontmatter title, else the humanized file base. */
export function docTitle(entry) {
  if (entry.data?.title) {
    return entry.data.title;
  }
  const segments = entry.id.split("/");
  return humanizeName(segments[segments.length - 1]);
}

/**
 * A blog post's slug: the frontmatter `slug` wins (leading slash
 * stripped); otherwise the file base name with a leading `YYYY-MM-DD-`
 * date prefix stripped (the Docusaurus blog rule). Blog posts are flat —
 * subdirectories do not appear in the slug.
 */
export function blogSlug(entry) {
  if (entry.data?.slug) {
    return String(entry.data.slug).replace(/^\//, "");
  }
  const segments = entry.id.split("/");
  const base = segments[segments.length - 1];
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

/** A blog post's date (frontmatter `date`, coerced by the schema) or null. */
export function postDate(entry) {
  const date = entry.data?.date;
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date;
  }
  return null;
}

/** Blog posts newest first; undated posts sort last, by id. */
export function sortPostsByDateDesc(posts) {
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
