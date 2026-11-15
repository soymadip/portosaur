import Link from "next/link";
import type { Breadcrumb } from "../lib/content.ts";

/**
 * Breadcrumbs: home `⌂` link + section crumb ("Docs"/"Notes") + tree
 * path, `›` separators, last = plain text with `aria-current="page"`.
 * Categories without an index doc (`href: null`) render as plain
 * text, not links.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Breadcrumb[] }) {
  if (crumbs.length === 0) {
    return null;
  }
  return (
    <nav className="porto-breadcrumbs" aria-label="Breadcrumbs">
      <ol>
        <li>
          <Link href="/" aria-label="Home">
            ⌂
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.title}-${index}`}>
              {isLast || !crumb.href ? (
                <span
                  className={isLast ? "porto-breadcrumbs__current" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.title}
                </span>
              ) : (
                <Link href={crumb.href}>{crumb.title}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
