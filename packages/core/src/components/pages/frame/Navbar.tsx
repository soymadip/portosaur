"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  buildNavEntries,
  isDropdown,
  type NavEntry,
} from "../../../lib/navbar.ts";
import { stripBase } from "../../../lib/pageUrl.ts";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import { Dropdown } from "../../Dropdown.tsx";
import { SearchDialog } from "./SearchDialog.tsx";
import { SiteTitle } from "./SiteTitle.tsx";
import { ThemeSelect } from "./ThemeSelect.tsx";

/**
 * Navbar — ONE navbar on every page (like OG Docusaurus): brand
 * left. Right cluster is the search icon, the theme select
 * (desktop only — on mobile it lives in the menu), the nav links
 * (desktop only), and the menu button (mobile only, right side,
 * VitePress-style). The menu button opens the MobileMenu popover
 * via `popovertarget`.
 *
 * Search shows on every page (a deliberate divergence from OG's
 * `hideSearchBarWithNoSearchContext`, which hid it off the
 * notes/blog routes — a unified navbar can't have a missing
 * button).
 *
 * The visible nav links prefetch on viewport (Next.js `<Link>`
 * default): on a phone there is no hover to trigger anything
 * else, so without it tapping Docs fetched the whole page at tap
 * time. The link to the current page is skipped (via
 * `entry.current`, an exact pathname match — `active` is
 * section-wide, so skipping on it never prefetched Docs from any
 * docs page). Dropdown links keep the default too (they're hidden
 * until the dropdown opens, so viewport prefetch never fires for
 * them until then).
 */

export function Navbar({
  isHome = false,
  isPortfolioHome = false,
}: {
  /** True on any home page (docs or portfolio) — removes the header bottom border. */
  isHome?: boolean;
  /** True on the portfolio home page only — hides the brand in landscape. */
  isPortfolioHome?: boolean;
}) {
  const config = usePortoConfig();
  const rawPathname = usePathname();
  const pathname = stripBase(rawPathname ?? "/", config.site.baseUrl);
  const { leftEntries, rightEntries, moreItems } = buildNavEntries(
    config,
    pathname,
  );
  const theme = config.theme;
  const hideOnScroll = theme.hideNavbarOnScroll;
  const showThemeSwitch = theme.showThemeSwitch;

  const headerRef = useRef<HTMLElement>(null);

  // Hide-on-scroll: slide the navbar away while scrolling down,
  // bring it back on scroll up (or at the top of the page). Two
  // classes are toggled: one on the header itself (the transform)
  // and one on <html> so the mobile TOC bar and the nav progress
  // bar can dock to the top edge when the navbar hides.
  useEffect(() => {
    if (!hideOnScroll) {
      return;
    }
    let lastScrollY = window.scrollY;
    let ticking = false;
    const update = () => {
      const header = headerRef.current;
      const y = window.scrollY;
      const hidden =
        header instanceof HTMLElement &&
        y > header.offsetHeight &&
        y > lastScrollY;
      header?.classList.toggle("porto-navbar--hidden", hidden);
      document.documentElement.classList.toggle("porto-navbar-hidden", hidden);
      lastScrollY = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [hideOnScroll]);

  const renderEntry = (entry: NavEntry, key: string): ReactNode => {
    if (isDropdown(entry)) {
      return (
        <Dropdown
          key={key}
          label={entry.label}
          items={entry.items.map((item) => ({
            label: item.label,
            href: item.href,
            active: item.active,
            prefetch: item.current ? false : undefined,
          }))}
        />
      );
    }
    if (entry.external) {
      return (
        <a
          key={key}
          className={entry.active ? "porto-nav-link active" : "porto-nav-link"}
          href={entry.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {entry.label}
        </a>
      );
    }
    return (
      <Link
        key={key}
        className={entry.active ? "porto-nav-link active" : "porto-nav-link"}
        href={entry.href}
        prefetch={entry.current ? false : undefined}
      >
        {entry.label}
      </Link>
    );
  };

  return (
    <header
      ref={headerRef}
      className={isHome ? "porto-navbar porto-navbar--home" : "porto-navbar"}
      data-navbar
    >
      <div className="porto-navbar__inner">
        <div className="porto-navbar__title-column">
          <div
            className={
              isPortfolioHome
                ? "porto-navbar__title-wrapper porto-navbar__title-wrapper--home"
                : "porto-navbar__title-wrapper"
            }
          >
            <SiteTitle />
          </div>
          {leftEntries.length > 0 && (
            <nav
              className="porto-primary-nav porto-primary-nav--desktop"
              aria-label="Primary"
            >
              {leftEntries.map((entry, index) =>
                renderEntry(entry, `${entry.label}-${index}`),
              )}
            </nav>
          )}
        </div>

        <div className="porto-navbar__right-group print:hidden">
          <div className="porto-navbar__search-group">
            <SearchDialog />
            {showThemeSwitch && (
              <div className="hidden md:flex">
                <ThemeSelect />
              </div>
            )}
          </div>
          <nav
            className="porto-primary-nav porto-primary-nav--desktop"
            aria-label="Primary"
          >
            {rightEntries.map((entry, index) =>
              renderEntry(entry, `${entry.label}-${index}`),
            )}
            <Dropdown
              label="More"
              className="porto-navbar__more-dropdown"
              items={moreItems.map((item) => ({
                label: item.label,
                href: item.href,
                active: item.active,
                prefetch: item.current ? false : undefined,
              }))}
            />
          </nav>
          {/* Mobile menu button (right side) — VitePress's hamburger
              icon: three staggered lines that animate into an X
              while the menu is open. Opens the MobileMenu popover
              via the popover API, no JavaScript needed to open/close.
              MobileMenu's toggle handler syncs `aria-expanded` so
              the open state is announced. */}
          <button
            type="button"
            className="porto-menu-button"
            popoverTarget="porto__sidebar"
            aria-label="Toggle navigation menu"
            aria-expanded="false"
            aria-controls="porto__sidebar"
          >
            <span className="porto-hamburger">
              <span className="porto-hamburger__line--top" />
              <span className="porto-hamburger__line--middle" />
              <span className="porto-hamburger__line--bottom" />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
