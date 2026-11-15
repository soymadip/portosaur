import Link from "next/link";
import type { SidebarLink } from "../../../lib/content.ts";

/**
 * Prev/next navigation — Docusaurus `PaginationNav` (`DocPaginator` +
 * `PaginatorNavLink`), ported 1:1: a `<nav>` with one link per side,
 * each a "Previous"/"Next" sublabel over the page title. OG removes
 * Infima's `«`/`»` label arrows (`overrides/pagination.css`), so
 * there are no arrow icons here. Links prefetch on viewport
 * (Next.js `<Link>` default) — the destinations are always visible
 * and few, so prefetching them costs little.
 */
export function Pagination({
  prev,
  next,
}: {
  prev?: SidebarLink | null;
  next?: SidebarLink | null;
}) {
  if (!prev && !next) {
    return null;
  }
  return (
    <nav className="porto-pagination print:hidden" aria-label="Docs pages">
      {prev && (
        <Link
          href={prev.href}
          rel="prev"
          className="porto-pagination__link porto-pagination__link--prev"
        >
          <div className="porto-pagination__sublabel">Previous</div>
          <div className="porto-pagination__label">{prev.title}</div>
        </Link>
      )}
      {next && (
        <Link
          href={next.href}
          rel="next"
          className="porto-pagination__link porto-pagination__link--next"
        >
          <div className="porto-pagination__sublabel">Next</div>
          <div className="porto-pagination__label">{next.title}</div>
        </Link>
      )}
    </nav>
  );
}
