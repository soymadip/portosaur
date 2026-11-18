/**
 * Doc page title resolution, ported from the Astro app
 * (`packages/app/src/utils/content.ts`: `docPageTitles`,
 * `docFileTitle`, `humanizeName`, `pageTitle`).
 *
 * Docusaurus title rules: the metadata title is the frontmatter
 * title, else the content H1, else the file base. The page `<h1>` is
 * the hoisted content H1 when the content has one, else the synthetic
 * title (unless `hide_title` is set) — otherwise the page would show
 * two. The hoisted title comes from the remark plugin's export
 * (`page.data._exports.__portoContentTitle`), NOT the TOC: the H1 is
 * gone from the TOC by the time the page renders.
 */
import type { ContentTitle } from "../plugins/remarkContentTitle.ts";
import { isIndexBase, NUMBER_PREFIX_PATTERN } from "./slug.ts";
import type { PortoDocData } from "./source.ts";

/** The default `id` of a synthetic page `<h1>` (a hoisted H1 keeps its own slug). */
export const PAGE_TITLE_ID = "_top";

/** Docusaurus-style page title: `{page} | {site}`. */
export function pageTitle(page: string, siteTitle: string): string {
  return `${page} | ${siteTitle}`;
}

/** Humanizes a raw file or directory name into a label. */
export function humanizeName(name: string): string {
  const stripped = name.replace(NUMBER_PREFIX_PATTERN, "");
  return stripped
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * A doc's file-base title: the humanized last path segment. For an
 * index file the parent directory's name is used instead (`README`
 * is not a title).
 */
export function docFileTitle(contentPath: string): string {
  const segments = contentPath.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const base = last.replace(/\.[^.]+$/, "");
  if (isIndexBase(base) && segments.length > 1) {
    return humanizeName(segments[segments.length - 2]);
  }
  return humanizeName(base);
}

/** A doc page's `<h1>`: its text, and its `id` when it is a hoisted
 * content H1 (a synthetic title keeps the default `_top` id). */
export interface PageHeading {
  text: string;
  id?: string;
}

/**
 * A doc page's heading and metadata title, mirroring Docusaurus.
 *
 * @param data - The page's validated frontmatter.
 * @param contentTitle - The hoisted content H1 from
 *   `page.data._exports.__portoContentTitle`, or null when the page
 *   has no content H1.
 * @param fallback - The file-base title (`docFileTitle`).
 */
export function docPageTitles(
  data: PortoDocData | undefined,
  contentTitle: ContentTitle | null,
  fallback: string,
): { heading: PageHeading | null; metaTitle: string } {
  const hideTitle = data?.hide_title === true;
  const frontmatterTitle = data?.title;
  const metaTitle = frontmatterTitle ?? contentTitle?.text ?? fallback;
  if (contentTitle) {
    return {
      heading: { text: contentTitle.text, id: contentTitle.slug },
      metaTitle,
    };
  }
  const heading = !hideTitle ? { text: frontmatterTitle ?? fallback } : null;
  return { heading, metaTitle };
}
