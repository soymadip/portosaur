"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEventHandler, ReactNode } from "react";
import { isSamePage, stripBase } from "../lib/pageUrl.ts";
import { usePortoConfig } from "../lib/porto-context.tsx";

/**
 * HashLink — a nav link that goes around the router for a hash
 * on the page the reader is already on. A same-page hash through
 * Next.js `<Link>` fetches the page's RSC payload before
 * scrolling, which stalls the jump for seconds on a slow
 * connection; a plain anchor scrolls at once (and glides, via
 * the smooth scroll on `html`). Anything else — another page,
 * or a hash on another page — still goes through `<Link>`,
 * where the fetch is real work.
 */
export function HashLink({
  href,
  className,
  prefetch,
  title,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  prefetch?: boolean;
  title?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
}) {
  const config = usePortoConfig();
  const rawPathname = usePathname();
  const pathname = stripBase(rawPathname ?? "/", config.site.baseUrl);
  const fragment = href.split("#")[1] ?? "";
  if (fragment !== "" && isSamePage(href, pathname)) {
    return (
      <a
        href={`#${fragment}`}
        className={className}
        title={title}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      title={title}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
