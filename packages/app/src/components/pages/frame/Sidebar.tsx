"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import { isSamePage, stripBase } from "../../../lib/pageUrl.ts";
import type { PreparedSidebar, SidebarItem } from "../../../lib/sidebar.ts";
import { PortoIcon } from "../../PortoIcon.tsx";

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
 * Every navigation reopens the path to the current page: a
 * stored "closed" from an earlier visit must never hide the
 * active link after a search or direct-link navigation — a
 * sidebar click can only land inside an already-open category,
 * so those two routes are exactly where a closed active category
 * strands the user. Closing a category while reading inside it
 * still works (the close is the user's choice); the next
 * navigation opens the new page's path again.
 *
 * Auto-collapse (`theme.navigation.auto_collapse`, default true)
 * keeps one category open per level: opening a category closes
 * its siblings, and navigating closes the old tree. The active
 * branch is not exempt — opening a sibling while reading inside
 * a category closes it, like closing it by hand; the next
 * navigation opens the new page's path again. With the option
 * off, categories open and close independently.
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
  const autoCollapse = config.theme.autoCollapse !== false;

  // The section title above the tree — "Docs" on a docs site,
  // "Notes" on a portfolio site, where the sidebar only ever
  // shows the notes tree. Same mapping as the pagination section
  // link in `doc-page.tsx`.
  const sectionTitle = config.siteMode === "docs" ? "Docs" : "Notes";

  const { items, spriteHtml, hash } = prepared;

  // Categories in pre-order traversal — the stored `open` array is
  // positional over this list. The sibling map (categories sharing
  // a parent list) drives auto-collapse: opening one closes the
  // others at its level. It is built in a second pass so the
  // index assignment stays exactly pre-order — stored state from
  // an older build maps onto the same positions.
  const { categoryIndex, categorySiblings, categoryList } = useMemo(() => {
    const map = new Map<SidebarItem, number>();
    const list: SidebarItem[] = [];
    let index = 0;
    const walk = (nodes: SidebarItem[]) => {
      for (const node of nodes) {
        if (node.type === "category") {
          map.set(node, index);
          list.push(node);
          index += 1;
          if (node.items) {
            walk(node.items);
          }
        }
      }
    };
    walk(items);
    const siblings = new Map<SidebarItem, number[]>();
    const walkSiblings = (nodes: SidebarItem[]) => {
      const cats = nodes.filter((node) => node.type === "category");
      for (const cat of cats) {
        siblings.set(
          cat,
          cats
            .filter((other) => other !== cat)
            .map((other) => map.get(other) as number),
        );
      }
      for (const cat of cats) {
        if (cat.items) {
          walkSiblings(cat.items);
        }
      }
    };
    walkSiblings(items);
    return {
      categoryIndex: map,
      categorySiblings: siblings,
      categoryList: list,
    };
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
    const stored = index !== undefined ? openState?.[index] : undefined;
    if (autoCollapse) {
      // A stored value is the truth, even for the active branch:
      // opening a sibling closed it on purpose, and the active
      // link stays hidden until the next navigation reopens the
      // new path — the same standing a deliberate close has.
      // With no stored value yet, the active path opens by
      // default, like the independent mode.
      if (stored !== null && stored !== undefined) {
        return stored;
      }
      return hasActiveDescendant(item, current);
    }
    // The current page's ancestors open ahead of any stored
    // state — a category the user closed earlier reopens the
    // moment the current page lands inside it again. The stored
    // value still applies once the user navigates away.
    if (hasActiveDescendant(item, current)) {
      return true;
    }
    if (stored !== null && stored !== undefined) {
      return stored;
    }
    return false;
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

  // After every navigation, open the current page's ancestors in
  // the DOM. React only writes the `open` attribute when the prop
  // changes, so navigating between two pages in the same closed
  // category (e.g. via search) would otherwise leave the active
  // link hidden — the prop stays `true` throughout, and React
  // never notices the browser closed the element natively.
  // Closing a category by hand doesn't change `current`, so a
  // deliberate close is left alone until the next navigation.
  // With auto-collapse, the navigation also closes the old tree:
  // the active path's siblings go false in stored state, so the
  // accordion holds after a search or direct-link navigation and
  // not just after a manual toggle — and a later re-render keeps
  // the DOM and the stored state in agreement.
  useEffect(() => {
    const sidebar = document.querySelector(".porto-sidebar");
    const active = sidebar?.querySelector('a[aria-current="page"]');
    let details = active?.closest("details") ?? null;
    while (details) {
      details.open = true;
      details = details.parentElement?.closest("details") ?? null;
    }
    if (!autoCollapse) {
      return;
    }
    setOpenState((previous) => {
      const next: Array<boolean | null> = previous
        ? [...previous]
        : Array.from({ length: categoryCount }, () => null);
      let changed = false;
      const fixLevel = (nodes: SidebarItem[]) => {
        const activeNode = nodes.find(
          (node) =>
            node.type === "category" && hasActiveDescendant(node, current),
        );
        if (!activeNode) {
          return;
        }
        for (const node of nodes) {
          if (node.type !== "category") {
            continue;
          }
          const index = categoryIndex.get(node);
          if (index === undefined) {
            continue;
          }
          const want = node === activeNode;
          if (next[index] !== want) {
            next[index] = want;
            changed = true;
          }
        }
        if (activeNode.items) {
          fixLevel(activeNode.items);
        }
      };
      fixLevel(items);
      if (!changed) {
        return previous;
      }
      storeState(next);
      return next;
    });
    // The tree (items) and its index only change with a new tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, autoCollapse]);

  const setCategoryOpen = (item: SidebarItem, open: boolean) => {
    const index = categoryIndex.get(item);
    if (index === undefined) {
      return;
    }
    setOpenState((previous) => {
      // The first stored snapshot captures the visible state —
      // a branch open by default (the active path) gets a stored
      // `true`, or navigating away would close it for having no
      // stored value, even with auto-collapse off.
      const next: Array<boolean | null> = previous
        ? [...previous]
        : categoryList.map((cat) => isOpen(cat));
      next[index] = open;
      // Opening a category closes its siblings; closing one
      // never touches the rest.
      if (open && autoCollapse) {
        for (const sibling of categorySiblings.get(item) ?? []) {
          next[sibling] = false;
        }
      }
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
      <p className="porto-sidebar-title">{sectionTitle}</p>
      {renderItems(items, false)}
    </nav>
  );
}
