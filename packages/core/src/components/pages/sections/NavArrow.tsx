"use client";

import { useEffect, useRef, useState } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import {
  scrollBehavior,
  scrollToSection,
} from "../../../lib/section-scroll.ts";
import { SiteIcon } from "../../SiteIcon.tsx";

/** A section counts as reached once its top is within this
 * distance of the viewport top. Downward jumps land the section
 * flush at the top (offset 0) and upward ones just below the
 * navbar (~72px), so either landing counts as reached and the
 * arrow moves on to the next section instead of re-selecting
 * the one the reader is already on. */
const REACHED_WITHIN_PX = 200;

/**
 * NavArrow — the floating arrow button at the bottom center of
 * the portfolio home. It appears once the reader has scrolled a
 * bit, jumps to the next section on tap, and points back to the
 * top at the bottom of the page. The chevron bounces while it
 * points down.
 */
export function NavArrow({ sections }: { sections: string[] }) {
  const config = usePortoConfig();
  const [direction, setDirection] = useState<"down" | "up">("down");
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  /* Lifted above the footer at the bottom of the page: the
     arrow sits over the footer text otherwise (15px of overlap
     on phones). The footer's height is measured live when the
     arrow flips up, so wrapped text still clears. */
  const [liftPx, setLiftPx] = useState<number | null>(null);
  const directionRef = useRef<"down" | "up">("down");
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      setIsVisible(scrollTop > 100);
      const nextDirection =
        scrollTop + windowHeight >= fullHeight - 50 ? "up" : "down";
      if (nextDirection !== directionRef.current) {
        directionRef.current = nextDirection;
        setDirection(nextDirection);
        if (nextDirection === "up") {
          const footer = document.querySelector(".porto-footer");
          setLiftPx(
            footer instanceof HTMLElement ? footer.offsetHeight + 16 : 88,
          );
        } else {
          setLiftPx(null);
        }
      }
      setIsScrolling(true);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(
        () => setIsScrolling(false),
        800,
      );
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (direction === "up") {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      return;
    }
    const windowTop = window.pageYOffset || document.documentElement.scrollTop;
    let nextSectionId: string | null = null;
    for (const id of sections) {
      const element = document.getElementById(id);
      if (!element) {
        continue;
      }
      const absoluteTop = element.getBoundingClientRect().top + windowTop;
      if (absoluteTop > windowTop + REACHED_WITHIN_PX) {
        nextSectionId = id;
        break;
      }
    }
    if (nextSectionId === null) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: scrollBehavior(),
      });
      return;
    }
    if (nextSectionId === sections[sections.length - 1]) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: scrollBehavior(),
      });
      return;
    }
    scrollToSection(nextSectionId, {
      hideOnScroll: config.theme.hideNavbarOnScroll,
    });
  };

  if (sections.length <= 1) {
    return null;
  }
  return (
    <button
      type="button"
      className={`porto-nav-arrow${isVisible ? " porto-nav-arrow--visible" : ""}${isScrolling ? " porto-nav-arrow--scrolling" : ""}`}
      style={
        liftPx !== null
          ? { bottom: `calc(${liftPx}px + env(safe-area-inset-bottom, 0px))` }
          : undefined
      }
      onClick={handleClick}
      aria-label={
        direction === "down" ? "Scroll to next section" : "Scroll to top"
      }
      title={direction === "down" ? "Next section" : "Back to top"}
    >
      {direction === "down" ? (
        <span className="porto-nav-arrow__bounce">
          <SiteIcon icon="lu:chevron-down" size="2.5rem" />
        </span>
      ) : (
        <SiteIcon icon="lu:chevron-up" size="2.5rem" />
      )}
    </button>
  );
}
