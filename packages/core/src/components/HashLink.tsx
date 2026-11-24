"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEventHandler, ReactNode } from "react";
import { isSamePage, stripBase } from "../lib/pageUrl.ts";
import { usePortoConfig } from "../lib/porto-context.tsx";
import { scrollToSection } from "../lib/section-scroll.ts";

/**
 * HashLink — a nav link that goes around the router for a hash
 * on the page the reader is already on. A same-page hash through
 * Next.js `<Link>` fetches the page's RSC payload before
 * scrolling, which stalls the jump for seconds on a slow
 * connection; rendering a plain anchor instead scrolls at once.
 * Anything else — another page, or a hash on another page —
 * still goes through `<Link>`, where the fetch is real work.
 *
 * Same-page hashes scroll through `scrollToSection`, which
 * measures the navbar and lands the target just below it when
 * the navbar will be showing, or flush at the viewport top
 * when it will be hidden. The URL hash still updates, via
 * `history.pushState` (which, unlike setting `location.hash`,
 * does not trigger a second native jump).
 */
export function HashLink({
  href,
  className,
  prefetch,
  title,
  ariaLabel,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  prefetch?: boolean;
  title?: string;
  ariaLabel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
}) {
  const config = usePortoConfig();
  const rawPathname = usePathname();
  const pathname = stripBase(rawPathname ?? "/", config.site.baseUrl);
  const fragment = href.split("#")[1] ?? "";
  if (fragment !== "" && isSamePage(href, pathname)) {
    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      if (
        !event.defaultPrevented &&
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        scrollToSection(fragment, {
          hideOnScroll: config.theme.hideNavbarOnScroll,
        })
      ) {
        event.preventDefault();
        window.history.pushState(null, "", `#${fragment}`);
      }
      onClick?.(event);
    };
    return (
      <a
        href={`#${fragment}`}
        className={className}
        title={title}
        aria-label={ariaLabel}
        onClick={handleClick}
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
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
