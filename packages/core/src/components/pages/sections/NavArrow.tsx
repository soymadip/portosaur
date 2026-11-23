"use client";

import { useEffect, useRef, useState } from "react";
import { SiteIcon } from "../../SiteIcon.tsx";

/**
 * NavArrow — the floating arrow button at the bottom center of
 * the portfolio home. It appears once the reader has scrolled a
 * bit, jumps to the next section on tap, and points back to the
 * top at the bottom of the page. The chevron bounces while it
 * points down.
 */
export function NavArrow({ sections }: { sections: string[] }) {
  const [direction, setDirection] = useState<"down" | "up">("down");
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      setIsVisible(scrollTop > 100);
      if (scrollTop + windowHeight >= fullHeight - 50) {
        setDirection("up");
      } else {
        setDirection("down");
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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
      if (absoluteTop > windowTop + 100) {
        nextSectionId = id;
        break;
      }
    }
    if (nextSectionId === null) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
      return;
    }
    if (nextSectionId === sections[sections.length - 1]) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
      return;
    }
    document
      .getElementById(nextSectionId)
      ?.scrollIntoView({ behavior: "smooth" });
  };

  if (sections.length <= 1) {
    return null;
  }
  return (
    <button
      type="button"
      className={`porto-nav-arrow${isVisible ? " porto-nav-arrow--visible" : ""}${isScrolling ? " porto-nav-arrow--scrolling" : ""}`}
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
