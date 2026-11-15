import Link from "next/link";
import type { SidebarLink } from "../../../lib/content.ts";
import { PortoIcon } from "../../PortoIcon.tsx";

/**
 * Prev/next cards, in Fumadocs' docs-footer design: a bordered
 * card per direction with the page title beside a chevron and a
 * muted "Previous" / "Next" line under it, hovering to the
 * accent surface. Links prefetch on viewport (Next.js `<Link>`
 * default) — the destinations are always visible and few, so
 * prefetching them costs little.
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
    <div className="porto-pagination print:hidden">
      {prev && (
        <Link href={prev.href} rel="prev">
          <span className="porto-pagination__row">
            <PortoIcon name="left-arrow" size="1rem" />
            <span className="porto-pagination__title">{prev.title}</span>
          </span>
          <span className="porto-pagination__label">Previous</span>
        </Link>
      )}
      {next && (
        <Link href={next.href} rel="next">
          <span className="porto-pagination__row">
            <PortoIcon name="right-arrow" size="1rem" />
            <span className="porto-pagination__title">{next.title}</span>
          </span>
          <span className="porto-pagination__label">Next</span>
        </Link>
      )}
    </div>
  );
}
