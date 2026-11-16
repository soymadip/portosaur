"use client";

import { useEffect, useRef } from "react";
import type { TocHeading } from "../../../../lib/content.ts";
import { nestHeadings } from "../../../../lib/content.ts";
import { PortoIcon } from "../../../PortoIcon/index.tsx";
import {
  TableOfContentsList,
  useTocScrollSpy,
} from "../TableOfContents/index.tsx";

/**
 * The mobile table of contents — a fixed bar below the navbar
 * (below the `lg` breakpoint) with a dropdown of the page's
 * headings. Shows the current heading's text; the current entry
 * in the dropdown carries a check mark.
 *
 * The nav follows the hide-on-scroll navbar — when the navbar
 * hides, the mobile TOC slides up to the top of the viewport
 * (`html.porto-navbar-hidden` rule in MobileTableOfContents.css).
 *
 * Closes on link click, outside click, and Escape (returning
 * focus to the summary when it had focus).
 */
export function MobileTableOfContents({
  headings,
  pageTitleId,
}: {
  headings: TocHeading[];
  pageTitleId: string;
}) {
  const toc = nestHeadings(headings);
  const activeSlug = useTocScrollSpy(pageTitleId);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const currentText =
    headings.find((heading) => heading.slug === activeSlug)?.text ?? "";

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) {
      return;
    }
    const closeToc = () => {
      details.open = false;
    };
    const onWindowClick = (event: MouseEvent) => {
      if (!details.contains(event.target as Node)) {
        closeToc();
      }
    };
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.open) {
        const hasFocus = details.contains(document.activeElement);
        closeToc();
        if (hasFocus) {
          details.querySelector("summary")?.focus();
        }
      }
    };
    // Close the table of contents whenever a link is clicked.
    const links = details.querySelectorAll("a");
    links.forEach((link) => {
      link.addEventListener("click", closeToc);
    });
    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      links.forEach((link) => {
        link.removeEventListener("click", closeToc);
      });
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, []);

  if (toc.length === 0) {
    return null;
  }
  return (
    <div className="porto-mobile-toc">
      <nav aria-labelledby="porto__on-this-page--mobile">
        <details ref={detailsRef} id="porto__mobile-toc">
          <summary id="porto__on-this-page--mobile">
            <span className="porto-mobile-toc__toggle">
              On this page
              <PortoIcon name="right-caret" size="1rem" />
            </span>
            <span className="porto-mobile-toc__current">{currentText}</span>
          </summary>
          <div className="porto-mobile-toc__dropdown">
            <TableOfContentsList toc={toc} isMobile activeSlug={activeSlug} />
          </div>
        </details>
      </nav>
    </div>
  );
}
