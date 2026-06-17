import { useEffect, useRef } from "react";

export function useDockLayout({
  isOpen,
  isPopupMode,
  isSidebarDock,
  isPeekDock,
  dockWidth,
  peekHeight,
}) {
  const weCollapsedSidebar = useRef(false);

  // Hook 1: Handle structural layout changes (sidebar, classes, overflow)
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isOpen && isPopupMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    if (isSidebarDock) {
      document.body.classList.add("pv-dock-active");
    } else {
      document.body.classList.remove("pv-dock-active");
    }

    if (isPeekDock) {
      document.body.classList.add("pv-peek-active");
    } else {
      document.body.classList.remove("pv-peek-active");
    }

    const sidebarToggleBtn = document.querySelector(
      '[class*="collapseSidebarButton"]',
    );
    const isCollapsed = !!document.querySelector(
      '[aria-label="Expand sidebar"]',
    );

    if (isSidebarDock) {
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

    const updateNavOffset = () => {
      const nav = document.querySelector(".navbar");
      if (nav) {
        document.documentElement.style.setProperty(
          "--ifm-navbar-height",
          `${nav.offsetHeight}px`,
        );
      }
    };

    if (isSidebarDock) {
      updateNavOffset();
      window.addEventListener("resize", updateNavOffset, { passive: true });
    }

    return () => {
      document.body.classList.remove("pv-dock-active");
      document.body.classList.remove("pv-peek-active");
      document.body.style.overflow = "";

      if (weCollapsedSidebar.current) {
        const sidebarToggleBtn = document.querySelector(
          '[class*="collapseSidebarButton"]',
        );
        const isCollapsed = !!document.querySelector(
          '[aria-label="Expand sidebar"]',
        );
        if (sidebarToggleBtn && isCollapsed) {
          sidebarToggleBtn.click();
        }
        weCollapsedSidebar.current = false;
      }
      window.removeEventListener("resize", updateNavOffset);
    };
  }, [isOpen, isPopupMode, isSidebarDock, isPeekDock]);

  // Hook 2: Handle dimension updates without tearing down the structural layout
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isSidebarDock) {
      document.body.style.setProperty("--pv-dock-width", `${dockWidth}px`);
    } else {
      document.body.style.setProperty("--pv-dock-width", "0px");
    }

    if (isPeekDock) {
      document.body.style.setProperty(
        "--mobile-peek-height",
        `${peekHeight}px`,
      );
    } else {
      document.body.style.setProperty("--mobile-peek-height", "0px");
    }

    return () => {
      document.body.style.removeProperty("--pv-dock-width");
      document.body.style.removeProperty("--mobile-peek-height");
    };
  }, [isSidebarDock, isPeekDock, dockWidth, peekHeight]);
}
