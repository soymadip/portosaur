import { PAGE_TITLE_ID } from "../../../lib/docPage.ts";

/**
 * The page `<h1>` (id `_top` by default, the scroll-spy's top
 * marker) with the page description under it, Fumadocs-style
 * (their `DocsTitle` + `DocsDescription`). A hoisted content H1
 * passes its heading slug as `id`, so `#slug` anchors still
 * resolve (OG keeps the H1 in the content with the same id). OG
 * colors the page title with the primary. The description
 * renders only when the page has a `desc` — no default text.
 * The title is left-aligned on every page, including topic-list
 * pages; the topic list itself carries no description line.
 */
export function PageTitle({
  title,
  id = PAGE_TITLE_ID,
  desc,
}: {
  title: string;
  id?: string;
  desc?: string;
}) {
  return (
    <>
      <h1 id={id} className="porto-page-title">
        {title}
      </h1>
      {desc ? <p className="porto-page-desc">{desc}</p> : null}
    </>
  );
}
