import { PAGE_TITLE_ID } from "../../../lib/docPage.ts";

/**
 * The page `<h1>` (id `_top` by default, the scroll-spy's top
 * marker). A hoisted content H1 passes its heading slug as `id`, so
 * `#slug` anchors still resolve (OG keeps the H1 in the content
 * with the same id). OG colors the page title with the primary.
 */
export function PageTitle({
  title,
  id = PAGE_TITLE_ID,
}: {
  title: string;
  id?: string;
}) {
  return (
    <h1 id={id} className="porto-page-title">
      {title}
    </h1>
  );
}
