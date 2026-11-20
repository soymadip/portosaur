/**
 * Blog helpers shared by the blog pages — author resolution and
 * post dates. Ported from the Astro app (`pages/blog-index.astro`
 * + `utils/content.ts`).
 *
 * Dates resolve frontmatter `date` first. The Astro fallback chain
 * (git commit date, then file mtime) is not ported — the generated
 * blog routes pass resolved dates in as props, and the CLI owns
 * file access. Undated posts sort last, by id.
 */

/** An author as listed in `blog/authors.yml`. */
export interface BlogAuthor {
  key: string;
  name: string;
  title?: string;
  url?: string;
  image_url?: string;
  /** Whether the author has an archive page (`page: true`). */
  hasPage?: boolean;
  /** Number of posts by this author (authors page only). */
  count?: number;
}

/** An author reference in a post's frontmatter. */
export type AuthorRef =
  | string
  | {
      key?: string;
      name?: string;
      title?: string;
      url?: string;
      image_url?: string;
    };

/**
 * Resolves an author ref (a string key into `authors.yml`, or an
 * inline `{ key?, name?, title?, url? }` object) to a display author.
 */
export function resolveAuthor(
  ref: AuthorRef,
  authors: BlogAuthor[],
): BlogAuthor {
  if (typeof ref === "string") {
    const found = authors.find((author) => author.key === ref);
    if (found) {
      return found;
    }
    return { key: ref, name: ref, hasPage: false };
  }
  const key = ref?.key;
  const found = key ? authors.find((author) => author.key === key) : undefined;
  if (found) {
    return {
      key: found.key,
      name: ref.name ?? found.name ?? found.key,
      title: ref.title ?? found.title,
      url: ref.url ?? found.url,
      image_url: ref.image_url ?? found.image_url,
      hasPage: found.hasPage,
    };
  }
  return {
    key: key ?? ref?.name ?? "",
    name: ref?.name ?? key ?? "",
    title: ref?.title,
    url: ref?.url,
    image_url: ref?.image_url,
    hasPage: false,
  };
}

/** Formats a post date the Docusaurus way ("November 14, 2026"). */
export function formatPostDate(date: Date | string): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A blog post, as far as the index page needs to see it. */
export interface BlogPostSummary {
  id: string;
  title: string;
  href: string;
  date?: Date | string | null;
  description?: string;
  authors?: AuthorRef[];
  tags?: string[];
}

/** Blog posts newest first. Undated posts sort last, by id. */
export function sortPostsByDateDesc<T extends BlogPostSummary>(
  posts: T[],
): T[] {
  const timeOf = (post: T): number | null => {
    if (!post.date) {
      return null;
    }
    const parsed = post.date instanceof Date ? post.date : new Date(post.date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };
  return [...posts].sort((a, b) => {
    const timeA = timeOf(a);
    const timeB = timeOf(b);
    if (timeA !== null && timeB !== null) {
      return timeB - timeA;
    }
    if (timeA !== null) {
      return -1;
    }
    if (timeB !== null) {
      return 1;
    }
    return a.id.localeCompare(b.id);
  });
}
