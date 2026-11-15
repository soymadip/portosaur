import Link from "next/link";
import type { SidebarLink } from "../../../lib/content.ts";
import { PortoIcon } from "../../PortoIcon.tsx";

/**
 * Prev/next cards (grid, arrows, "Previous"/"Next" labels + titles).
 * Links prefetch on viewport (Next.js `<Link>` default) — the
 * destinations are always visible and few, so prefetching them
 * costs little.
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
          <PortoIcon name="left-arrow" size="1.5rem" />
          <span>
            Previous
            <br />
            <span className="porto-pagination__title">{prev.title}</span>
          </span>
        </Link>
      )}
      {next && (
        <Link href={next.href} rel="next">
          <PortoIcon name="right-arrow" size="1.5rem" />
          <span>
            Next
            <br />
            <span className="porto-pagination__title">{next.title}</span>
          </span>
        </Link>
      )}
    </div>
  );
}
