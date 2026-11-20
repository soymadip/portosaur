"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import {
  buildNavEntries,
  isDropdown,
  PORTO_HOMEPAGE,
  type NavEntry,
} from "../../../lib/navbar.ts";
import { stripBase } from "../../../lib/pageUrl.ts";
import { PortoIcon } from "../../PortoIcon.tsx";
import { ThemeSelect } from "./ThemeSelect.tsx";

/**
 * The mobile menu footer — the navbar links (which live outside the
 * sidebar tree on desktop) and the theme select, so mobile readers
 * can reach every nav destination from the popover, plus the
 * Portosaur version link.
 */
export function MobileMenuFooter() {
  const config = usePortoConfig();
  const rawPathname = usePathname();
  const pathname = stripBase(rawPathname ?? "/", config.site.baseUrl);
  const {
    leftEntries,
    rightEntries,
    moreItems,
    showProjectLink,
    versionLabel,
  } = buildNavEntries(config, pathname);
  const entries = [...leftEntries, ...rightEntries];

  const renderEntry = (entry: NavEntry, key: string): ReactNode => {
    if (isDropdown(entry)) {
      return (
        <details key={key} className="porto-navbar__dropdown">
          <summary>
            {entry.label}
            <PortoIcon
              name="chevron-down"
              size="0.875rem"
              className="porto-mobile-nav__chevron"
            />
          </summary>
          <ul>
            {entry.items.map((item) => (
              <li key={item.label}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={item.active ? "active" : undefined}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className={item.active ? "active" : undefined}
                    prefetch={item.current ? false : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      );
    }
    if (entry.external) {
      return (
        <a
          key={key}
          href={entry.href}
          target="_blank"
          rel="noopener noreferrer"
          className={entry.active ? "active" : undefined}
        >
          {entry.label}
        </a>
      );
    }
    return (
      <Link
        key={key}
        href={entry.href}
        className={entry.active ? "active" : undefined}
        prefetch={entry.current ? false : undefined}
      >
        {entry.label}
      </Link>
    );
  };

  return (
    <div className="porto-mobile-preferences">
      <nav className="porto-mobile-nav" aria-label="Mobile">
        {entries.map((entry, index) =>
          renderEntry(entry, `${entry.label}-${index}`),
        )}
        <details className="porto-navbar__dropdown">
          <summary>
            More
            <PortoIcon
              name="chevron-down"
              size="0.875rem"
              className="porto-mobile-nav__chevron"
            />
          </summary>
          <ul>
            {moreItems.map((item) => (
              <li key={item.label}>
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={item.active ? "active" : undefined}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className={item.active ? "active" : undefined}
                    prefetch={item.current ? false : undefined}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      </nav>
      {config.theme.showThemeSwitch && (
        <div className="porto-mobile-preferences__theme-row">
          <ThemeSelect />
        </div>
      )}
      {showProjectLink && (
        <a
          className="porto-mobile-preferences__version-link"
          href={PORTO_HOMEPAGE}
          target="_blank"
          rel="noopener noreferrer"
        >
          {versionLabel}
        </a>
      )}
    </div>
  );
}
