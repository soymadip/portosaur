"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePortoConfig } from "../../../../lib/porto-context.tsx";
import { isSamePage, stripBase } from "../../../../lib/pageUrl.ts";
import type { PreparedSidebar, SidebarItem } from "../../../../lib/sidebar.ts";
import { PortoIcon } from "../../../PortoIcon.tsx";
import {
  SidebarCollapseTrigger,
  useSidebarCollapse,
} from "../MobileMenu/index.tsx";

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
 * still works (the close is the user's choice). The next
 * navigation opens the new page's path again.
 *
 * Auto-collapse (`theme.navigation.auto_collapse`, default true)
 * closes the old tree when the active item changes: navigating
 * to another page leaves only the new page's path open, and
 * navigating to a top-level page closes every category.
 * Expanding a category never closes anything — opening a tree
 * to peek leaves the rest alone. Only the navigation collapses.
 * With the option off, categories open and close independently
 * and navigation leaves them as they are.
 *
 * When `theme.collapsable_sidebar` is false, categories render as
 * plain groups (label + list, no fold).
 *
 * The fold is Fumadocs' measured-height mechanism (their Base UI
 * collapsible): the panel's height is a pixel value measured from
 * its content, animated 0 to full and back, then released to
 * `auto` once settled open so nested folds inside it grow it
 * naturally. It works in every browser — the earlier
 * `::details-content` fold only animated where that
 * pseudo-element exists (Chrome, newer Firefox) and snapped
 * open and shut everywhere else.
 *
 * Prefetch: Next.js `<Link>` prefetches on viewport by default.
 * Links inside closed categories sit in a 0-height clipped
 * panel, so they never intersect and never prefetch until their
 * category opens — the same behavior the Astro build wired by
 * hand. The current page's link skips prefetching.
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

// A soft block glides to the item under the mouse or keyboard
// focus, like the Fumadocs docs sidebar. One block for the whole
// tree — it slides between items instead of each row flashing
// its own background on and off. The block is the only hover
// fill, the rows themselves carry none.
//
// The block hides over the active row, which has its own
// background, and holds its place over gaps and separators.
// Touch never shows it, there is no hover to follow. With
// reduced motion it fades in place instead of gliding (see
// Sidebar.css).
function follow(area: HTMLElement | null) {
  const block = area?.querySelector(".porto-sidebar__hover-block");
  if (!area || !(block instanceof HTMLElement)) {
    return;
  }
  let current: Element | null = null;

  const isActiveRow = (item: Element): boolean =>
    item.matches('[aria-current="page"]') ||
    item.querySelector('a[aria-current="page"]') !== null;

  const show = (item: Element | null) => {
    if (item === current) {
      return;
    }
    // Glide between items, appear in place when coming from
    // outside.
    block.style.transitionProperty = current ? "" : "opacity";
    current = item;
    if (!item) {
      block.style.opacity = "0";
      return;
    }

    const rect = item.getBoundingClientRect();
    const origin = area.getBoundingClientRect();
    block.style.translate = `${rect.left - origin.left}px ${rect.top - origin.top}px`;
    block.style.width = `${rect.width}px`;
    block.style.height = `${rect.height}px`;
    // The active row has its own background.
    block.style.opacity = isActiveRow(item) ? "0" : "1";
  };
  // A category row is its folder row, not the label link inside
  // it — the block spans the full row, caret included.
  const itemOf = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest(".porto-sidebar__folder-row") ??
        target.closest("a[href]"))
      : null;

  const controller = new AbortController();
  const { signal } = controller;
  area.addEventListener(
    "pointerover",
    (event) => {
      const item = itemOf(event.target);
      // Hold the position over separators and gaps.
      if (item && event.pointerType === "mouse") {
        show(item);
      }
    },
    { signal },
  );
  area.addEventListener("pointerleave", () => show(null), { signal });
  area.addEventListener(
    "focusin",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.matches(":focus-visible")
      ) {
        show(itemOf(event.target));
      }
    },
    { signal },
  );
  area.addEventListener(
    "focusout",
    () => {
      if (!area.matches(":hover")) {
        show(null);
      }
    },
    { signal },
  );
  return () => controller.abort();
}

// The category fold — Fumadocs' measured-height panel (their
// Base UI collapsible, without the dependency). The height is a
// pixel value measured from the content: opening glides 0 to
// the full height, closing captures the current height first
// (an interrupted open may be partway) and glides to 0. Once
// settled open the height releases to `auto`, so a nested
// category opening inside grows the panel without re-measuring.
// Opacity rides the same 150ms (it reads the `open` prop, so it
// flips with the toggle and the CSS transition fades it).
// `visibility` hides a settled-closed panel, which takes its
// links out of the tab order — it flips to visible the moment
// the panel opens and only after the fade on close. When the
// height doesn't animate (reduced motion turns the transition
// off), both ends land immediately instead of waiting for a
// transition that never fires.
function FolderPanel({
  open,
  id,
  children,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The initial values match the server render, so there is no
  // hydration mismatch.
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);
  const [hidden, setHidden] = useState(!open);
  const openRef = useRef(open);
  openRef.current = open;
  const prevOpenRef = useRef(open);
  const frameRef = useRef(0);

  useEffect(() => {
    // Mount only renders the initial state — the fold runs on
    // changes after that.
    if (prevOpenRef.current === open) {
      return;
    }
    prevOpenRef.current = open;
    const panel = ref.current;
    if (!panel) {
      return;
    }
    cancelAnimationFrame(frameRef.current);
    const style = getComputedStyle(panel);
    const animates =
      style.transitionDuration !== "0s" &&
      style.transitionProperty.includes("height");
    if (open) {
      setHidden(false);
      if (!animates) {
        setHeight("auto");
        return;
      }
      // Glide from the current height (0 when closed, partway
      // when reopening mid-close) to the full content height.
      setHeight(panel.scrollHeight);
      return;
    }
    if (!animates) {
      setHeight(0);
      setHidden(true);
      return;
    }
    // Capture the current height first, then glide to 0 on a
    // later frame so the browser registers the start value —
    // going straight from `auto` to 0 would snap, `auto` does
    // not interpolate.
    const current = panel.getBoundingClientRect().height;
    setHeight(current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        if (!openRef.current) {
          setHeight(0);
        }
      });
    });
    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [open]);

  const onTransitionEnd = (event: React.TransitionEvent) => {
    if (event.propertyName !== "height") {
      return;
    }
    if (openRef.current) {
      setHeight("auto");
    } else {
      setHidden(true);
    }
  };

  return (
    <div
      id={id}
      ref={ref}
      className="porto-sidebar__folder-panel"
      style={{
        height: height === "auto" ? "auto" : `${height}px`,
        opacity: open ? 1 : 0,
        visibility: hidden ? "hidden" : "visible",
      }}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
}

export function Sidebar({ prepared }: { prepared: PreparedSidebar }) {
  const config = usePortoConfig();
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
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
  // positional over this list. The list (same order) seeds the
  // first stored snapshot from the visible state.
  const { categoryIndex, categoryList } = useMemo(() => {
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
    return { categoryIndex: map, categoryList: list };
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
    // No stored state yet (the first render, before the mount
    // effects run): the current page's ancestors start open, so
    // the active link is never hidden on first paint. After
    // that the stored value rules — a manual close of the
    // active category sticks until the next navigation opens
    // the new page's path again (see the effect below).
    return openState === null && hasActiveDescendant(item, current);
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

  // After every navigation, the current page's ancestors open:
  // a category the user closed earlier reopens the moment the
  // current page lands inside it again, so a search or
  // direct-link landing never strands the active link inside a
  // closed category. Closing a category by hand doesn't change
  // `current`, so a deliberate close is left alone until the
  // next navigation. With auto-collapse, the navigation also
  // closes the old tree: only the new page's path stays open,
  // and navigating to a top-level page closes every category.
  // The collapse runs on the navigation, not on expanding a
  // tree — opening a category to peek never closes anything.
  // The stored state is updated too, so a later re-render keeps
  // the open state and the stored state in agreement.
  useEffect(() => {
    setOpenState((previous) => {
      const next: Array<boolean | null> = previous
        ? [...previous]
        : Array.from({ length: categoryCount }, () => null);
      let changed = false;
      const openPath = (nodes: SidebarItem[]) => {
        for (const node of nodes) {
          if (node.type !== "category" || !hasActiveDescendant(node, current)) {
            continue;
          }
          const index = categoryIndex.get(node);
          if (index !== undefined && next[index] !== true) {
            next[index] = true;
            changed = true;
          }
          if (node.items) {
            openPath(node.items);
          }
        }
      };
      openPath(items);
      if (!autoCollapse) {
        if (!changed) {
          return previous;
        }
        storeState(next);
        return next;
      }
      const fixLevel = (nodes: SidebarItem[]) => {
        const activeNode = nodes.find(
          (node) =>
            node.type === "category" && hasActiveDescendant(node, current),
        );
        for (const node of nodes) {
          if (node.type !== "category") {
            continue;
          }
          const index = categoryIndex.get(node);
          if (index === undefined) {
            continue;
          }
          // No active category at this level (a top-level page):
          // every category here closes.
          const want = node === activeNode;
          if (next[index] !== want) {
            next[index] = want;
            changed = true;
          }
        }
        if (activeNode?.items) {
          fixLevel(activeNode.items);
        } else {
          // Nothing active down this branch: close the nested
          // branches too, so reopening a parent later doesn't
          // resurrect a stale open subtree.
          for (const node of nodes) {
            if (node.type === "category" && node.items) {
              fixLevel(node.items);
            }
          }
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
      // Expanding a category never closes anything — only a
      // navigation collapses (see the effect above).
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
          const open = isOpen(item);
          const panelId = `porto-sidebar-panel-${categoryIndex.get(item)}`;
          return (
            <li key={item.label}>
              <div
                className="porto-sidebar__folder"
                data-open={open ? "true" : undefined}
              >
                <div
                  className="porto-sidebar__folder-row"
                  onClick={() => setCategoryOpen(item, !open)}
                >
                  <span className="porto-sidebar__group-label">{label}</span>
                  <button
                    type="button"
                    className="porto-sidebar__caret"
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCategoryOpen(item, !open);
                    }}
                  >
                    <PortoIcon name="right-caret" size="1.25rem" />
                  </button>
                </div>
                <FolderPanel open={open} id={panelId}>
                  {item.items && renderItems(item.items, true)}
                </FolderPanel>
              </div>
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
    <nav className="porto-sidebar" aria-label="Docs sidebar" ref={follow}>
      {spriteHtml && <span dangerouslySetInnerHTML={{ __html: spriteHtml }} />}
      <div aria-hidden="true" className="porto-sidebar__hover-block" />
      <div className="porto-sidebar-title-row">
        <p className="porto-sidebar-title">{sectionTitle}</p>
        <SidebarCollapseTrigger
          collapsed={collapsed}
          onClick={toggleCollapsed}
        />
      </div>
      {renderItems(items, false)}
    </nav>
  );
}
