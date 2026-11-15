"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortoConfig } from "../lib/porto-context.tsx";
import { isSamePage, stripBase } from "../lib/pageUrl.ts";
import type { PreparedSidebar, SidebarItem } from "../lib/sidebar.ts";
import { PortoIcon } from "./PortoIcon.tsx";

/**
 * The docs sidebar — nested categories, icons, carets, 265px.
 *
 * The tree arrives prepared from the server (`lib/sidebar.ts`):
 * each row's icon is pre-rendered HTML (the Iconify packs are too
 * big to ship to the client) and repeated icons dedupe into a
 * per-page sprite. This component only handles expand state,
 * active state, and persistence.
 *
 * Expand state + scroll position persist in `sessionStorage`
 * across navigations (the Astro `sidebar-persist.ts` port): the
 * stored state is `{ hash, open, scroll }`, keyed by the tree hash
 * — a changed tree discards the saved state. Restore happens in
 * `useEffect`, so the first client render matches the server
 * (categories containing the current page start open) and there
 * is no hydration mismatch.
 *
 * When `theme.collapsable_sidebar` is false, categories render as
 * plain groups (label + list, no `<details>`).
 *
 * Prefetch: Next.js `<Link>` prefetches on viewport by default.
 * Links inside closed categories are `display: none`, so they
 * never intersect and never prefetch until their category opens —
 * the same behavior the Astro build wired by hand. The current
 * page's link skips prefetching.
 */

const STORAGE_KEY = "porto-sidebar-state";

interface SidebarState {
  hash: string;
  open: Array<boolean | null>;
  scroll: number;
}

function normalizeHref(href: string): string {
  return href.replace(/\/+$/, "") || "/";
}

function hasActiveDescendant(item: SidebarItem, current: string): boolean {
  if (item.href && normalizeHref(item.href) === current) {
    return true;
  }
  for (const child of item.items ?? []) {
    if (hasActiveDescendant(child, current)) {
      return true;
    }
  }
  return false;
}

export function Sidebar({ prepared }: { prepared: PreparedSidebar }) {
  const config = usePortoConfig();
  const rawPathname = usePathname();
  const pathname = stripBase(rawPathname ?? "/", config.site.baseUrl);
  const current = normalizeHref(pathname);
  const collapsable = config.theme.collapsableSidebar !== false;

  const { items, spriteHtml, hash } = prepared;

  // Categories in pre-order traversal — the stored `open` array is
  // positional over this list.
  const categoryIndex = useMemo(() => {
    const map = new Map<SidebarItem, number>();
    let index = 0;
    const walk = (nodes: SidebarItem[]) => {
      for (const node of nodes) {
        if (node.type === "category") {
          map.set(node, index);
          index += 1;
          if (node.items) {
            walk(node.items);
          }
        }
      }
    };
    walk(items);
    return map;
  }, [items]);

  const categoryCount = categoryIndex.size;

  // `null` = defaults (categories containing the current page open).
  const [openState, setOpenState] = useState<Array<boolean | null> | null>(
    null,
  );
  const openStateRef = useRef(openState);
  openStateRef.current = openState;

  const isOpen = (item: SidebarItem): boolean => {
    const index = categoryIndex.get(item);
    if (index === undefined) {
      return false;
    }
    const stored = openState?.[index];
    if (stored !== null && stored !== undefined) {
      return stored;
    }
    return hasActiveDescendant(item, current);
  };

  const storeState = (open: Array<boolean | null>) => {
    const scroller = document.getElementById("porto__sidebar");
    try {
      const state: SidebarState = {
        hash,
        open,
        scroll: scroller?.scrollTop ?? 0,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable — persistence is best-effort.
    }
  };

  // Restore saved state on mount (client-only — no hydration
  // mismatch) and persist scroll position while scrolling.
  useEffect(() => {
    let restored: Array<boolean | null> | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const stored = JSON.parse(raw ?? "{}") as SidebarState;
      if (Array.isArray(stored.open) && stored.hash === hash) {
        restored = stored.open;
        const scroller = document.getElementById("porto__sidebar");
        if (scroller && typeof stored.scroll === "number") {
          scroller.scrollTop = stored.scroll;
        }
      }
    } catch {
      // Corrupt or unavailable storage — keep the defaults.
    }
    if (restored) {
      setOpenState(restored);
    }

    const scroller = document.getElementById("porto__sidebar");
    if (!scroller) {
      return;
    }
    let ticking = false;
    const onScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const open = openStateRef.current ?? [];
        try {
          const state: SidebarState = {
            hash,
            open,
            scroll: scroller.scrollTop,
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
          // Storage unavailable — persistence is best-effort.
        }
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
    };
    // Restore once per tree (hash change = new tree).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const setCategoryOpen = (item: SidebarItem, open: boolean) => {
    const index = categoryIndex.get(item);
    if (index === undefined) {
      return;
    }
    setOpenState((previous) => {
      const next: Array<boolean | null> = previous
        ? [...previous]
        : Array.from({ length: categoryCount }, () => null);
      next[index] = open;
      storeState(next);
      return next;
    });
  };

  const renderIcon = (item: SidebarItem) => (
    <span
      className="porto-sidebar__icon"
      aria-hidden="true"
      style={item.color ? { color: item.color } : undefined}
      dangerouslySetInnerHTML={{ __html: item.iconHtml }}
    />
  );

  const renderItems = (nodes: SidebarItem[], nested: boolean) => (
    <ul className={nested ? undefined : "porto-sidebar__top-level"}>
      {nodes.map((item) => {
        const active = item.href ? normalizeHref(item.href) === current : false;
        if (item.type === "category") {
          const label = item.href ? (
            <Link
              href={item.href}
              className={nested ? undefined : "porto-sidebar__large"}
              aria-current={active ? "page" : undefined}
              prefetch={active ? false : undefined}
            >
              {renderIcon(item)}
              {item.label}
            </Link>
          ) : (
            <span className={nested ? undefined : "porto-sidebar__large"}>
              {renderIcon(item)}
              {item.label}
            </span>
          );
          if (!collapsable) {
            // A category link here is a list link, not a group
            // label — it keeps its normal link padding (the
            // `.porto-sidebar__group-label a` rule strips it).
            return (
              <li key={item.label}>
                {item.href ? (
                  label
                ) : (
                  <span className="porto-sidebar__group-label">{label}</span>
                )}
                {item.items && renderItems(item.items, true)}
              </li>
            );
          }
          return (
            <li key={item.label}>
              <details
                open={isOpen(item)}
                onToggle={(event) => {
                  setCategoryOpen(item, event.currentTarget.open);
                }}
              >
                <summary>
                  <span className="porto-sidebar__group-label">{label}</span>
                  <span className="porto-sidebar__caret">
                    <PortoIcon name="right-caret" size="1.25rem" />
                  </span>
                </summary>
                {item.items && renderItems(item.items, true)}
              </details>
            </li>
          );
        }
        return (
          <li key={item.label}>
            <Link
              href={item.href ?? "#"}
              aria-current={active ? "page" : undefined}
              className={nested ? undefined : "porto-sidebar__large"}
              prefetch={active ? false : undefined}
            >
              {renderIcon(item)}
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav className="porto-sidebar" aria-label="Docs sidebar">
      {spriteHtml && <span dangerouslySetInnerHTML={{ __html: spriteHtml }} />}
      {renderItems(items, false)}
    </nav>
  );
}
