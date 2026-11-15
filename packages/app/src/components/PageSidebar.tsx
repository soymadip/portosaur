import type { TocHeading } from "../lib/content.ts";
import { MobileTableOfContents } from "./MobileTableOfContents.tsx";
import { TableOfContents } from "./TableOfContents.tsx";

/**
 * The doc page's sidebar: the mobile TOC below the `lg`
 * breakpoint and the desktop right sidebar above it.
 *
 * `pageTitleId` is `PAGE_TITLE_ID` from `lib/docPage.ts`,
 * passed down by the server page (client components can't import
 * `lib/docPage.ts` — see `TableOfContents`).
 */
export function PageSidebar({
  headings,
  pageTitleId,
}: {
  headings: TocHeading[];
  pageTitleId: string;
}) {
  if (headings.length === 0) {
    return null;
  }
  return (
    <>
      <div className="lg:hidden">
        <MobileTableOfContents headings={headings} pageTitleId={pageTitleId} />
      </div>
      <div className="porto-toc-panel hidden lg:block">
        <div className="porto-toc-container">
          <TableOfContents headings={headings} pageTitleId={pageTitleId} />
        </div>
      </div>
    </>
  );
}
