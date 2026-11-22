import NextLink from "next/link";
import { pageHref } from "../../lib/pageUrl.ts";

/**
 * Link — the explicit `<Link href="…">` MDX tag (distinct from
 * Markdown `[text](href)` links, which the route's `a` override
 * handles). The component resolves the destination itself.
 * Internal links render through Next.js `<Link>`
 * (trailing-slashed), external ones as plain anchors opening
 * in a new tab.
 */
export function Link({
  href,
  children,
  ...props
}: {
  /** The link destination. An internal page path, a full URL, or a `#section` anchor. */
  href: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  const target = href;
  const external =
    /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//");
  if (external) {
    return (
      <a href={target} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }
  if (target.startsWith("#")) {
    return (
      <a href={target} {...props}>
        {children}
      </a>
    );
  }
  return (
    <NextLink href={pageHref(target)} {...props}>
      {children}
    </NextLink>
  );
}
