"use client";

import { useEffect, useRef, useState } from "react";
import type { TocHeading, TocItem } from "../../../lib/content.ts";
import { nestHeadings } from "../../../lib/content.ts";
import { SiteIcon } from "../../SiteIcon.tsx";

/**
 * The desktop table of contents (right sidebar, ≥72rem) + the
 * shared scroll-spy hook (`useTocScrollSpy`, also used by
 * `MobileTableOfContents`).
 *
 * The scroll-spy is a React port of the Astro `porto-toc.ts`
 * script: an IntersectionObserver watches a narrow band below
 * the navbar (nav height + mobile-TOC height + 2rem, 53px tall).
 * When an observed element enters the band, the nearest heading
 * above it becomes current. React state (`activeSlug`) replaces
 * the script's DOM attribute manipulation.
 *
 * The "On this page" title renders as a <p>, not an <h2> — an <h2>
 * here would enter every doc page's heading list.
 *
 * The page-title id (`PAGE_TITLE_ID` from `lib/docPage.ts`)
 * arrives as a prop, not an import: `lib/docPage.ts` pulls in
 * `lib/slug.ts`, which imports `node:fs` at the top level — a
 * client component importing it would break the browser bundle.
 * The server page passes the id down instead.
 */

/** The current heading slug, live from the scroll position. */
export function useTocScrollSpy(pageTitleId: string): string | null {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const activeSlugRef = useRef<string | null>(null);
  const tocHeadingSelector = `h1#${pageTitleId},:where(h2,h3)[id]`;

  useEffect(() => {
    const onIdle = (cb: () => void) => {
      if (typeof window.requestIdleCallback === "function") {
        return window.requestIdleCallback(cb);
      }
      return window.setTimeout(cb, 1) as unknown as number;
    };

    let observer: IntersectionObserver | undefined;
    let resizeTimeout: number | undefined;
    let cancelled = false;

    /** Test if an element is a table-of-contents heading. */
    const isHeading = (el: Element): el is HTMLHeadingElement =>
      el.matches(tocHeadingSelector);

    /** Walk up the DOM to find the nearest heading. */
    const getElementHeading = (el: Element | null): HTMLElement | null => {
      while (el) {
        // Short circuit if we reach the top-level content container
        // or one of the other containers in main.
        if (el.matches(".porto-markdown-content, main > *")) {
          return document.getElementById(pageTitleId);
        }
        if (isHeading(el)) {
          return el;
        }
        // Find the first heading that is a child of this element,
        // and return it if there is one.
        const childHeading = el.querySelector<HTMLElement>(tocHeadingSelector);
        if (childHeading) {
          return childHeading;
        }
        // Look for the previous sibling last and most deeply nested child.
        let prev = el.previousElementSibling;
        while (prev?.lastElementChild) {
          prev = prev.lastElementChild;
        }
        el = prev ?? el.parentElement;
      }
      return null;
    };

    const getRootMargin = (): string => {
      const navBarHeight =
        document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      // `<summary>` only exists in the mobile TOC, so this falls
      // back to 0 in the desktop component.
      const mobileTocHeight =
        document
          .querySelector(".porto-mobile-toc summary")
          ?.getBoundingClientRect().height ?? 0;
      /** Start intersections at nav height + 2rem padding. */
      const top = navBarHeight + mobileTocHeight + 32;
      /** End intersections `53px` later. This is slightly more than
       * the maximum `margin-top` in Markdown content. */
      const bottom = top + 53;
      const height = document.documentElement.clientHeight;
      return `-${top}px 0% ${bottom - height}px`;
    };

    const setCurrent: IntersectionObserverCallback = (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) {
          continue;
        }
        const heading = getElementHeading(target);
        if (!heading) {
          continue;
        }
        const slug = heading.id;
        if (slug && slug !== activeSlugRef.current) {
          activeSlugRef.current = slug;
          setActiveSlug(slug);
        }
        break;
      }
    };

    const observe = () => {
      if (observer || cancelled) {
        return;
      }
      // Observe headings that appear in the table of contents,
      // siblings of those headings, direct children of
      // `.porto-markdown-content` (elements before the first
      // subheading), and direct children of `main` that don't
      // include headings (mainly banners). Elements that themselves
      // contain a TOC heading are ignored — those children are
      // already observed.
      const toObserve = document.querySelectorAll(
        [
          `main :where(${tocHeadingSelector})`,
          `main :where(${tocHeadingSelector}, .porto-heading-wrapper) ~ *:not(:has(${tocHeadingSelector}))`,
          `main .porto-markdown-content > *:not(:has(${tocHeadingSelector}))`,
          `main > *:not(:has(${tocHeadingSelector}))`,
        ].join(),
      );
      observer = new IntersectionObserver(setCurrent, {
        rootMargin: getRootMargin(),
      });
      toObserve.forEach((element) => observer?.observe(element));
    };

    const onResize = () => {
      // Disable intersection observer while window is resizing.
      if (observer) {
        observer.disconnect();
        observer = undefined;
      }
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => onIdle(observe), 200);
    };

    const idleId = onIdle(() => {
      if (cancelled) {
        return;
      }
      observe();
      window.addEventListener("resize", onResize);
    });

    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      observer?.disconnect();
      window.clearTimeout(resizeTimeout);
      window.removeEventListener("resize", onResize);
    };
  }, [pageTitleId, tocHeadingSelector]);

  return activeSlug;
}

/** The nested TOC list (shared by desktop + mobile). */
export function TableOfContentsList({
  toc,
  depth = 0,
  isMobile = false,
  activeSlug,
}: {
  toc: TocItem[];
  depth?: number;
  isMobile?: boolean;
  activeSlug: string | null;
}) {
  return (
    <ul
      className={
        isMobile ? "porto-toc-list porto-toc-list--mobile" : "porto-toc-list"
      }
      style={{ "--porto-toc-depth": depth } as React.CSSProperties}
    >
      {toc.map((heading) => (
        <li key={heading.slug}>
          <a
            href={`#${heading.slug}`}
            aria-current={activeSlug === heading.slug ? "true" : undefined}
          >
            <span>{heading.text}</span>
            {isMobile && activeSlug === heading.slug && (
              <span className="porto-toc-check" aria-hidden="true">
                <SiteIcon icon="md:check" size="1rem" />
              </span>
            )}
          </a>
          {heading.children.length > 0 && (
            <TableOfContentsList
              toc={heading.children}
              depth={depth + 1}
              isMobile={isMobile}
              activeSlug={activeSlug}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function TableOfContents({
  headings,
  pageTitleId,
}: {
  headings: TocHeading[];
  pageTitleId: string;
}) {
  const toc = nestHeadings(headings);
  const activeSlug = useTocScrollSpy(pageTitleId);
  if (toc.length === 0) {
    return null;
  }
  return (
    <nav aria-labelledby="porto__on-this-page">
      <p id="porto__on-this-page" className="porto-toc-title">
        On this page
      </p>
      <TableOfContentsList toc={toc} activeSlug={activeSlug} />
    </nav>
  );
}
