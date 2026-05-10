import { useEffect, useRef } from "react";

/**
 * Manages DOM side-effects for dock mode:
 * - Adds/removes body classes for layout push
 * - Manages CSS custom properties for dock width
 * - Collapses/expands the Docusaurus sidebar
 * - Tracks navbar height for dock top offset
 */
export function useDockLayout(isOpen, isDocked, dockWidth) {
  const weCollapsedSidebar = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const isMobile = window.innerWidth <= 768;
    const desktopDockActive = isOpen && isDocked && !isMobile;

    // --- Body classes & CSS vars ---
    if (desktopDockActive) {
      document.body.classList.add("pv-dock-active");
      document.body.style.setProperty("--pv-dock-width", `${dockWidth}px`);
    } else {
      document.body.classList.remove("pv-dock-active");
      document.body.style.setProperty("--pv-dock-width", "0px");
    }

    // --- Docusaurus sidebar auto-collapse ---
    const sidebarToggleBtn = document.querySelector(
      '[class*="collapseSidebarButton"]',
    );
    const isCollapsed = !!document.querySelector(
      '[aria-label="Expand sidebar"]',
    );

    if (desktopDockActive) {
      if (sidebarToggleBtn && !isCollapsed) {
        weCollapsedSidebar.current = true;
        sidebarToggleBtn.click();
      }
    } else {
      if (weCollapsedSidebar.current && isCollapsed && sidebarToggleBtn) {
        weCollapsedSidebar.current = false;
        sidebarToggleBtn.click();
      }
    }

    // --- Navbar height tracking ---
    const updateNavOffset = () => {
      const nav = document.querySelector(".navbar");
      if (nav) {
        document.documentElement.style.setProperty(
          "--ifm-navbar-height",
          `${nav.offsetHeight}px`,
        );
      }
    };

    if (desktopDockActive) {
      updateNavOffset();
      window.addEventListener("resize", updateNavOffset, { passive: true });
    }

    return () => {
      document.body.classList.remove("pv-dock-active");
      document.documentElement.style.removeProperty("--dock-top-offset");
      window.removeEventListener("resize", updateNavOffset);
    };
  }, [isOpen, isDocked, dockWidth]);
}
