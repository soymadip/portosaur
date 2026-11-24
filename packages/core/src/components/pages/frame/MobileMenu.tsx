"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import { buttonClass } from "../../Button.tsx";
import { SiteIcon } from "../../SiteIcon.tsx";
import { MobileMenuFooter } from "./MobileMenuFooter.tsx";
import { SiteTitle } from "./SiteTitle.tsx";
import { ThemeSelect } from "./ThemeSelect.tsx";

/**
 * MobileMenu — the mobile navigation popover, shared by every page.
 *
 * Two views, Docusaurus-style: the main menu (nav links, version
 * link) and, on docs pages (`hasSidebar`), the sidebar tree with
 * a "Back to main menu" bar above it. The views slide sideways
 * between each other; docs pages open on the tree, other pages
 * on the main menu, and closing the drawer resets to the page
 * default. The drawer is full-height with its own header (site
 * title, theme select, close button), since it covers the
 * navbar. From 50rem up the pane becomes the persistent sidebar
 * and the views dissolve — the tree shows directly, as before.
 * The toggle lives in the navbar (right cluster, mobile only)
 * and opens this popover via `popovertarget` — no JavaScript
 * needed to open/close. This component only resets the popover
 * attribute on desktop (persistent variant), traps focus while
 * the menu is open, syncs the navbar toggle button's
 * `aria-expanded` on open/close, and closes the menu the moment
 * a link inside it is tapped (before the navigation fetch — the
 * user gets immediate feedback instead of staring at the open
 * menu while the next page loads).
 *
 * The popover attribute is managed imperatively (like the Astro
 * build's `resetPopoverAttribute`): React renders `popover="auto"`
 * for the server HTML, and the effect adds/removes the attribute
 * on viewport changes. React never re-applies an unchanged prop,
 * so the imperative change survives re-renders.
 *
 * Open/close animation — the drawer slides in from the right
 * edge (transform 0.25s), one panel with no fade. Pure CSS —
 * `@starting-style` + `allow-discrete` (see animations.css);
 * the closed state is the base rule's off-canvas park, so the
 * exit slides back out the same way.
 *
 * Desktop sidebar collapse — ported from Fumadocs' docs layout:
 * the tree's title row holds a collapse trigger (Lucide's
 * sidebar glyph). Clicking it slides the pane
 * out by its own width while the content expands into the freed
 * space, and a floating panel with the same trigger offers the
 * way back. Hovering the viewport's left edge while collapsed
 * peeks the sidebar back in as a floating card. Cmd/Ctrl+B
 * toggles too. Unlike Fumadocs (state only — a reload reopens
 * the sidebar), the toggle is remembered for the session:
 * `toggleCollapsed` writes it to `sessionStorage`, the
 * pre-paint script in the root layout restores the collapsed
 * class before first paint, and the marker effect below reads
 * the stored choice before the page defaults — so a reload
 * keeps the sidebar as the visitor left it until the tab
 * closes. The collapse only exists on desktop (`isDesktop`
 * gates the `inert` attribute. The CSS rules are all inside
 * the 50rem block), and only on pages with a sidebar — the
 * menu-only variant has nothing to collapse.
 *
 * Starting collapsed: `theme.navigation.sidebar_collapsed`
 * (global) or per-page `sidebar_collapsed` frontmatter (which
 * overrides the global). The default arrives as a marker element
 * in the SSR HTML — this component renders one for the global
 * option, DocPage renders one per page — and CSS `:has()` rules
 * hold the collapsed geometry from the first paint, before any
 * JS runs, so a default-collapsed page never flashes the open
 * sidebar. The marker effect below reads the markers into state
 * once the client takes over and removes them.
 */

/** The collapse state, shared with the sidebar tree: the trigger
 * lives in the tree's title row. */
const SidebarCollapseContext = createContext<{
  collapsed: boolean;
  toggleCollapsed: () => void;
} | null>(null);

export function useSidebarCollapse(): {
  collapsed: boolean;
  toggleCollapsed: () => void;
} {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    throw new Error("useSidebarCollapse must be used inside <MobileMenu>");
  }
  return ctx;
}

/** Fumadocs' `SidebarCollapseTrigger`: the sidebar glyph in a ghost
 * icon button, with the expanded state on `aria-expanded` (the
 * label stays "Collapse sidebar" — the toggle pattern Fumadocs
 * uses, same button in the title row and the floating panel). */
export function SidebarCollapseTrigger({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={buttonClass({
        variant: "ghost",
        size: "icon-sm",
        className: "porto-sidebar-collapse-trigger",
      })}
      aria-label="Collapse sidebar"
      aria-controls="porto__sidebar"
      aria-expanded={!collapsed}
      data-collapsed={collapsed}
      onClick={onClick}
    >
      <SiteIcon icon="lu:panel-left" />
    </button>
  );
}

/** The visitor's own collapse choice, remembered for the
 * session (`"1"` collapsed, `"0"` expanded) — separate from
 * the sidebar tree's `porto-sidebar-state` key in Sidebar.tsx.
 * The pre-paint script in the root layout reads the same key. */
const COLLAPSE_STORAGE_KEY = "porto-sidebar-collapsed";

export function MobileMenu({
  hasSidebar = false,
  children,
}: {
  hasSidebar?: boolean;
  children?: ReactNode;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef(0);
  const ownMarkerRef = useRef<HTMLDivElement>(null);
  // The stored choice is read once, on the first takeover: on
  // later navigations the page markers apply their own defaults
  // instead (a stored choice that won on every navigation would
  // defeat the per-page `sidebar_collapsed` frontmatter).
  const restoredRef = useRef(false);
  const pathname = usePathname();
  const config = usePortoConfig();
  // The global default is known at render time (the config is
  // static, so server and client agree — no hydration mismatch).
  // the per-page frontmatter default arrives via the marker
  // effect below.
  const [collapsed, setCollapsed] = useState(
    config.theme.sidebarCollapsed === true,
  );
  const [hovered, setHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  // Which drawer view shows: the tree on docs pages, the main
  // menu elsewhere. Reset to the page default whenever the
  // drawer closes or the page changes (below) — without the
  // reset, a docs page left on the main menu would reopen on it,
  // and a navigation to a tree-less page would leave the main
  // menu slid off-canvas with nothing in its place.
  const [showSecondary, setShowSecondary] = useState(hasSidebar);
  // True once the client has taken the sidebar's default state
  // over from the first-paint markers (below) — this component's
  // own global marker unmounts with it.
  const [takenOver, setTakenOver] = useState(false);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 50rem)");

    // Remove the popover attribute on desktop viewports — only
    // for the persistent (docs) variant, where the pane becomes
    // the always-visible sidebar. The menu-only variant keeps
    // its popover at every width (its toggle hides at desktop,
    // so it can never open there). The dialog semantics follow
    // the popover: the persistent pane is a sidebar, not a
    // dialog, so `role`/`aria-modal` come off with it.
    const resetPopoverAttribute = () => {
      const desktop = mediaQuery.matches;
      setIsDesktop(desktop);
      // Crossing the breakpoint resets the drawer view: the
      // desktop sidebar shows the tree directly, and a drawer
      // reopened after a round trip starts on the page default
      // (removing the popover attribute fires no toggle event,
      // so the close reset below never runs for a resize).
      setShowSecondary(hasSidebar);
      const persistent = hasSidebar && desktop;
      if (persistent) {
        pane.removeAttribute("popover");
        pane.removeAttribute("role");
        pane.removeAttribute("aria-modal");
      } else {
        pane.setAttribute("popover", "auto");
        pane.setAttribute("role", "dialog");
        pane.setAttribute("aria-modal", "true");
      }
    };
    resetPopoverAttribute();
    mediaQuery.addEventListener("change", resetPopoverAttribute);

    // Trap keyboard focus inside the header and menu when the
    // menu is expanded. Docs pages inert the main frame (the
    // sidebar popover sits outside it, inside <main> — inerting
    // <main> there would inert the menu itself). Other pages have
    // no main frame, so the whole <main> is inerted instead.
    const trapFocus = (shouldTrap: boolean) => {
      const targets = document.querySelector(".main-frame")
        ? ".main-frame, .porto-skip-link"
        : "main, .porto-skip-link";
      document.querySelectorAll<HTMLElement>(targets).forEach((el) => {
        el.toggleAttribute("inert", shouldTrap);
      });
    };

    const onToggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === "open";
      trapFocus(open);
      // Closing resets the view to the page default, so the
      // drawer reopens on the tree (docs pages) or the main
      // menu (other pages), like the old site.
      if (!open) {
        setShowSecondary(hasSidebar);
      }
      // Announce the menu state: the navbar toggle button
      // carries `aria-expanded`, and the popover API doesn't
      // update it — so sync it here on every toggle.
      const toggleButton = document.querySelector(
        '[popovertarget="porto__sidebar"]',
      );
      toggleButton?.setAttribute("aria-expanded", open ? "true" : "false");
    };
    pane.addEventListener("toggle", onToggle);

    // Close the menu the moment a link inside it is tapped —
    // before the navigation fetch starts. Links only: the
    // footer's theme select is a <details> dropdown, and opening
    // it must not close the menu — and neither must toggling a
    // sidebar category. The `:popover-open` guard keeps the
    // desktop persistent sidebar (no popover there) out of this.
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a[href]") &&
        pane.matches(":popover-open")
      ) {
        pane.hidePopover();
      }
    };
    pane.addEventListener("click", onClick);

    return () => {
      mediaQuery.removeEventListener("change", resetPopoverAttribute);
      pane.removeEventListener("toggle", onToggle);
      pane.removeEventListener("click", onClick);
    };
  }, [hasSidebar]);

  // A navigation resets the view too: a link tap closes the
  // drawer (handled above), but a back/forward step leaves it
  // open over the new page — without this, a docs page left on
  // the main menu would keep it after navigating to another
  // docs page, and a tree-less page would show an empty drawer.
  useEffect(() => {
    setShowSecondary(hasSidebar);
  }, [pathname, hasSidebar]);

  // The collapse state lives on <html> as classes — the pane
  // slide, the content expansion, the floating panel and the
  // peek strip are all pure CSS keyed off them.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("porto-sidebar-collapsed", collapsed && hasSidebar);
    root.classList.toggle(
      "porto-sidebar-peeked",
      collapsed && hovered && hasSidebar,
    );
    return () => {
      root.classList.remove("porto-sidebar-collapsed");
      root.classList.remove("porto-sidebar-peeked");
    };
  }, [collapsed, hovered, hasSidebar]);

  // The sidebar's default state arrives as marker elements in the
  // SSR HTML — this component renders one for the global
  // `theme.navigation.sidebar_collapsed`, DocPage renders one per
  // page from `sidebar_collapsed` frontmatter — and CSS `:has()`
  // rules hold the collapsed geometry from the first paint, before
  // any JS runs. This effect reads the markers into state once
  // the client takes over, then removes them so they can't fight
  // later toggles. It runs on every navigation: the new page's
  // markers apply its own default (a page with no marker leaves
  // the state as the user left it). On the FIRST run only, a
  // stored toggle choice wins over the markers — the visitor's
  // own choice beats the configured default on a reload.
  useEffect(() => {
    if (!hasSidebar) {
      return;
    }
    const collapsedMarker = document.querySelector(
      '[data-porto-sidebar-default="collapsed"]',
    );
    const expandedMarker = document.querySelector(
      '[data-porto-sidebar-default="expanded"]',
    );
    if (!restoredRef.current) {
      restoredRef.current = true;
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(COLLAPSE_STORAGE_KEY);
      } catch {
        // Storage unavailable — fall through to the markers.
      }
      if (stored === "1") {
        setCollapsed(true);
      } else if (stored === "0") {
        setCollapsed(false);
      } else if (expandedMarker) {
        setCollapsed(false);
      } else if (collapsedMarker) {
        setCollapsed(true);
      }
    } else if (expandedMarker) {
      setCollapsed(false);
    } else if (collapsedMarker) {
      setCollapsed(true);
    }
    // The page's marker is an attribute on the columns div, not
    // an element: removing the ATTRIBUTE imperatively is safe
    // (React only touches attributes when props change, and the
    // server-rendered page never re-renders), while removing a
    // React-rendered node would corrupt the fiber tree and crash
    // the next client navigation. This component's own marker
    // element is skipped here — React removes it via the
    // `takenOver` re-render below.
    document
      .querySelectorAll("[data-porto-sidebar-default]")
      .forEach((marker) => {
        if (marker !== ownMarkerRef.current) {
          marker.removeAttribute("data-porto-sidebar-default");
        }
      });
    setTakenOver(true);
  }, [pathname, hasSidebar]);

  // Collapsing drops any in-progress peek.
  useEffect(() => {
    if (collapsed) {
      setHovered(false);
    }
  }, [collapsed]);

  // The single write site for the session persistence — the
  // button and the Cmd/Ctrl+B hotkey below both come through
  // here. Page defaults from markers never write. The write is
  // idempotent, so StrictMode double-invoking the updater in
  // dev is harmless. Declared before the hotkey effect: the
  // effect lists it in its deps, and a later `const` would be
  // a temporal-dead-zone error at render time.
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Storage unavailable — persistence is best-effort.
      }
      return next;
    });
  }, []);

  // Cmd/Ctrl+B toggles the collapse on desktop, like Fumadocs —
  // except while typing (an input, textarea, select, or editable
  // element has focus).
  useEffect(() => {
    if (!hasSidebar) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key !== "b"
      ) {
        return;
      }
      if (!window.matchMedia("(min-width: 50rem)").matches) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      toggleCollapsed();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasSidebar, toggleCollapsed]);

  // When the collapse hides the trigger that had focus (the
  // pane goes inert), hand focus to the
  // floating panel's trigger — Fumadocs does the same.
  useEffect(() => {
    if (collapsed && paneRef.current?.contains(document.activeElement)) {
      document
        .querySelector<HTMLElement>(".porto-sidebar-collapse-panel button")
        ?.focus();
    }
  }, [collapsed]);

  useEffect(() => {
    return () => {
      window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Memoized on `collapsed` only, so hovering the peek strip
  // doesn't re-render the sidebar tree (it doesn't consume the
  // hover state).
  const collapseValue = useMemo(
    () => ({ collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed],
  );

  // The peek only answers the mouse (never touch) while collapsed
  // — and never mid-slide, or the hover flickers the pane.
  const shouldIgnoreHover = (event: ReactPointerEvent): boolean => {
    const pane = paneRef.current;
    if (!pane) {
      return true;
    }
    return (
      !collapsed ||
      event.pointerType === "touch" ||
      pane.getAnimations().length > 0
    );
  };

  const onPeekEnter = (event: ReactPointerEvent) => {
    if (shouldIgnoreHover(event)) {
      return;
    }
    window.clearTimeout(hoverTimerRef.current);
    setHovered(true);
  };

  const onPeekLeave = (event: ReactPointerEvent) => {
    if (shouldIgnoreHover(event)) {
      return;
    }
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(
      () => setHovered(false),
      // Leaving toward the viewport edge gets a close delay, so a
      // slip off the sidebar doesn't snap it shut immediately.
      Math.min(event.clientX, document.body.clientWidth - event.clientX) > 100
        ? 0
        : 500,
    );
  };

  return (
    <SidebarCollapseContext.Provider value={collapseValue}>
      <nav
        className="print:hidden"
        aria-label={hasSidebar ? "Docs sidebar" : "Mobile navigation"}
      >
        {/* The global default marker (see the effect above):
          rendered while the client hasn't taken over yet, so the
          `:has()` rules hold the collapsed geometry from the
          first paint. `hidden`, so it takes no space. */}
        {hasSidebar && config.theme.sidebarCollapsed === true && !takenOver && (
          <div
            ref={ownMarkerRef}
            data-porto-sidebar-default="collapsed"
            hidden
          />
        )}
        <div
          ref={paneRef}
          popover="auto"
          id="porto__sidebar"
          role="dialog"
          aria-modal="true"
          aria-label={hasSidebar ? "Docs sidebar" : "Mobile navigation"}
          className={[
            "porto-mobile-menu",
            hasSidebar ? "porto-mobile-menu--persistent" : "",
            showSecondary && hasSidebar
              ? "porto-mobile-menu--show-secondary"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          // The collapsed pane is inert (except while peeked) so
          // its links can't be tabbed to off-screen — desktop only,
          // where the collapse exists at all.
          inert={collapsed && !hovered && isDesktop}
          onPointerEnter={onPeekEnter}
          onPointerLeave={onPeekLeave}
        >
          {/* The drawer's own header, mobile only — the
            full-height pane covers the navbar, so the title,
            theme toggle, and close button live here instead,
            the old site's layout. The close button hides the
            popover directly, no JavaScript needed. */}
          <div className="porto-mobile-menu__header">
            <SiteTitle />
            {config.theme.showThemeSwitch && <ThemeSelect />}
            <button
              type="button"
              className="porto-mobile-menu__close"
              popoverTarget="porto__sidebar"
              popoverTargetAction="hide"
              aria-label="Close menu"
            >
              <SiteIcon icon="lu:x" size="20px" strokeWidth={2.5} />
            </button>
          </div>
          <div className="porto-mobile-menu__content">
            {/* Two views, Docusaurus-style: the main menu first,
              the tree second. The show-secondary class slides
              both panels left, so the tree comes in from the
              right. The hidden view is inert (mobile only — at
              desktop the views dissolve and the tree shows
              directly, so nothing may stay inert there). */}
            <div className="porto-mobile-menu__views">
              <div
                className="porto-mobile-menu__view porto-mobile-menu__view--primary"
                inert={showSecondary && hasSidebar && !isDesktop}
              >
                <div className="porto-mobile-menu__footer-slot md:hidden">
                  <MobileMenuFooter />
                </div>
              </div>
              {hasSidebar && (
                <div
                  className="porto-mobile-menu__view porto-mobile-menu__view--secondary"
                  inert={!showSecondary && !isDesktop}
                >
                  <button
                    type="button"
                    className="porto-mobile-menu__back"
                    onClick={() => setShowSecondary(false)}
                  >
                    ← Back to main menu
                  </button>
                  {children}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* The scrim: dims + blurs the page while the menu is
          open (the search backdrop's treatment), over the whole
          viewport including the navbar, which sits behind the
          full-height drawer. It never takes clicks, so taps
          pass through to the backdrop and light-dismiss still
          works. */}
        <div className="porto-mobile-menu__scrim" aria-hidden="true" />
        {hasSidebar && (
          <>
            {/* The floating way back: visible only while the
              sidebar is collapsed and not peeked. The panel's
              trigger is inert with it, so it can't be tabbed to
              while hidden. */}
            <div
              className="porto-sidebar-collapse-panel"
              inert={!collapsed || hovered}
            >
              <SidebarCollapseTrigger
                collapsed={collapsed}
                onClick={toggleCollapsed}
              />
            </div>
            {/* The hover-peek strip: the 24px edge zone (Fumadocs
              uses 16px). */}
            <div
              className="porto-sidebar-collapse-strip"
              aria-hidden="true"
              onPointerEnter={onPeekEnter}
              onPointerLeave={onPeekLeave}
            />
          </>
        )}
      </nav>
    </SidebarCollapseContext.Provider>
  );
}
