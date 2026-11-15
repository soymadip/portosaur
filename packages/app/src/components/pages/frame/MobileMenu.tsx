"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
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
 */

export function MobileMenu({
  hasSidebar = false,
  children,
}: {
  hasSidebar?: boolean;
  children?: ReactNode;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const config = usePortoConfig();
  // OG Docusaurus renders the sidebar logo only when the navbar
  // hides on scroll — otherwise the brand copy would sit hidden
  // behind the always-visible navbar forever, and the tree would
  // need the navbar-height offset from padding instead (the
  // `--no-brand` content variant below).
  const showBrand = hasSidebar && config.theme.hideNavbarOnScroll;

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
      const persistent = hasSidebar && mediaQuery.matches;
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

  return (
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
    </nav>
  );
}
