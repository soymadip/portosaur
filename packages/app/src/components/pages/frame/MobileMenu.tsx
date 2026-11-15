"use client";

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
import { PortoIcon } from "../../PortoIcon.tsx";
import { MobileMenuFooter } from "./MobileMenuFooter.tsx";
import { SiteTitle } from "./SiteTitle.tsx";

/**
 * MobileMenu — the mobile navigation popover, shared by every page.
 *
 * On docs pages (`hasSidebar`) the popover also holds the sidebar
 * tree (the `children` slot) and becomes the persistent sidebar
 * from 50rem up; on other pages it holds only the footer (nav
 * links, theme select, version link). The toggle lives in the
 * navbar (right cluster, mobile only) and opens this popover via
 * `popovertarget` — no JavaScript needed to open/close; this
 * component only resets the popover attribute on desktop
 * (persistent variant), traps focus while the menu is open, syncs
 * the navbar toggle button's `aria-expanded` on open/close, and
 * closes the menu the moment a link inside it is tapped (before
 * the navigation fetch — the user gets immediate feedback instead
 * of staring at the open menu while the next page loads).
 *
 * The popover attribute is managed imperatively (like the Astro
 * build's `resetPopoverAttribute`): React renders `popover="auto"`
 * for the server HTML, and the effect adds/removes the attribute
 * on viewport changes. React never re-applies an unchanged prop,
 * so the imperative change survives re-renders.
 *
 * Open/close animation — ported from VitePress's VPNavScreen:
 * the pane fades (opacity 0.25s) while its content slides down
 * 8px into place, and reverses on close. Pure CSS —
 * `@starting-style` + `allow-discrete` (see animations.css).
 *
 * Desktop sidebar collapse — ported from Fumadocs' docs layout:
 * the tree's title row holds a collapse trigger (Lucide's
 * sidebar glyph — the brand row would hide it behind the navbar
 * until the navbar hides on scroll); clicking it slides the pane
 * out by its own width while the content expands into the freed
 * space (250ms, the same duration Fumadocs uses), and a floating
 * panel with the same trigger offers the way back. Hovering the
 * viewport's left edge while collapsed peeks the sidebar back in
 * as a floating card. Cmd/Ctrl+B toggles too. State only —
 * Fumadocs doesn't persist it either, so a reload reopens the
 * sidebar. The collapse only exists on desktop (`isDesktop`
 * gates the `inert` attribute; the CSS rules are all inside the
 * 50rem block), and only on pages with a sidebar — the menu-only
 * variant has nothing to collapse.
 */

/** The collapse state, shared with the sidebar tree: the trigger
 * lives in the tree's title row (the brand row sits hidden behind
 * the navbar until it hides on scroll, so a trigger there would
 * be unclickable on page load). */
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
      <PortoIcon name="sidebar" />
    </button>
  );
}

export function MobileMenu({
  hasSidebar = false,
  children,
}: {
  hasSidebar?: boolean;
  children?: ReactNode;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef(0);
  const config = usePortoConfig();
  // OG Docusaurus renders the sidebar logo only when the navbar
  // hides on scroll — otherwise the brand copy would sit hidden
  // behind the always-visible navbar forever, and the tree would
  // need the navbar-height offset from padding instead (the
  // `--no-brand` content variant below).
  const showBrand = hasSidebar && config.theme.hideNavbarOnScroll;
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

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

  // Collapsing drops any in-progress peek.
  useEffect(() => {
    if (collapsed) {
      setHovered(false);
    }
  }, [collapsed]);

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
      setCollapsed((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasSidebar]);

  // When the collapse hides the trigger that had focus (the
  // brand-row button goes inert with the pane), hand focus to the
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

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
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
        <div
          ref={paneRef}
          popover="auto"
          id="porto__sidebar"
          role="dialog"
          aria-modal="true"
          aria-label={hasSidebar ? "Docs sidebar" : "Mobile navigation"}
          className={
            hasSidebar
              ? "porto-mobile-menu porto-mobile-menu--persistent"
              : "porto-mobile-menu"
          }
          // The collapsed pane is inert (except while peeked) so
          // its links can't be tabbed to off-screen — desktop only,
          // where the collapse exists at all.
          inert={collapsed && !hovered && isDesktop}
          onPointerEnter={onPeekEnter}
          onPointerLeave={onPeekLeave}
        >
          <div
            className={
              hasSidebar && !config.theme.hideNavbarOnScroll
                ? "porto-mobile-menu__content porto-mobile-menu__content--no-brand"
                : "porto-mobile-menu__content"
            }
          >
            {showBrand && (
              <div className="porto-mobile-menu__brand">
                <SiteTitle />
              </div>
            )}
            {children}
            <div className="md:hidden">
              <MobileMenuFooter />
            </div>
          </div>
        </div>
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
            {/* The hover-peek strip: Fumadocs' 16px edge zone. */}
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
