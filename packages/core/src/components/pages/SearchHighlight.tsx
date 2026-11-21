"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  clearSearchHighlight,
  readSearchHighlight,
  SEARCH_NAVIGATE_EVENT,
} from "../../lib/search-highlight.ts";

/**
 * SearchHighlight — after a search-result click, the matched
 * section flashes briefly on the destination page. The clicked
 * link stores its target in sessionStorage and dispatches an
 * event; this component (in the docs layout, so it runs on every
 * docs page) retries until the navigation lands, flashes the
 * section's heading — or the page title, when the result had no
 * section — and clears the flag.
 *
 * It listens for the event instead of watching the route: the
 * docs layout does not re-render on client-side navigation, so
 * no effect would pick the flag up otherwise. A retry loop
 * covers the gap between the click and the new page's content
 * arriving, and the mount pass covers a fresh page load after a
 * search click.
 */

/** The block tags a result's line can live in. A table result
 * matches whole rows, not single cells. */
const BLOCK_SELECTOR = "p, li, td, tr, pre, blockquote, dd, dt";
const TABLE_BLOCK_SELECTOR = "p, li, tr, pre, blockquote, dd, dt";

/**
 * The line a text or table result came from: the block in the
 * section that shares the most of the excerpt's words. Words
 * are matched, not the whole string — the excerpt strips
 * Markdown, so exact text never lines up. Short excerpts need
 * every word; longer ones need at least half, minimum three.
 * Falls back to the whole page when the section gives nothing.
 */
function findContentBlock(
  heading: Element | null,
  content: string,
  type: string,
): Element | null {
  const selector = type === "table-row" ? TABLE_BLOCK_SELECTOR : BLOCK_SELECTOR;
  const words = [
    ...new Set(
      content
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4),
    ),
  ];
  if (words.length === 0) {
    return null;
  }
  const needed =
    words.length <= 4 ? words.length : Math.max(3, Math.ceil(words.length / 2));
  // The section: the heading's following siblings up to the
  // next heading. No heading — the whole page.
  const sections: Element[] = [];
  if (heading) {
    let node = heading.nextElementSibling;
    while (node) {
      if (/^H[1-6]$/.test(node.tagName)) {
        break;
      }
      sections.push(node);
      node = node.nextElementSibling;
    }
  }
  const roots =
    sections.length > 0 ? sections : [...document.querySelectorAll("main")];
  let best: Element | null = null;
  let bestScore = 0;
  let bestLength = Infinity;
  const consider = (block: Element) => {
    const text = (block.textContent ?? "").toLowerCase();
    let score = 0;
    for (const word of words) {
      if (text.includes(word)) {
        score++;
      }
    }
    // Most words wins, then the smallest block — the exact line
    // beats a long paragraph that shares the same words.
    if (
      score > bestScore ||
      (score === bestScore && score > 0 && text.length < bestLength)
    ) {
      best = block;
      bestScore = score;
      bestLength = text.length;
    }
  };
  for (const root of roots) {
    if (root.matches(selector)) {
      consider(root);
    }
    root.querySelectorAll(selector).forEach(consider);
  }
  return bestScore >= needed ? best : null;
}

/**
 * Tries the pending highlight once. True when it flashed (or
 * there was nothing to do), false when the navigation hasn't
 * landed yet and the caller should retry.
 */
function tryHighlight(): boolean {
  const flag = readSearchHighlight();
  if (!flag) {
    return true;
  }
  // A flag older than 15s is stale (the navigation never
  // landed) — drop it instead of flashing a wrong page. The
  // window is generous on purpose: on a slow connection the
  // destination page can take seconds to arrive.
  if (Date.now() - flag.at > 15000) {
    clearSearchHighlight();
    return true;
  }
  const here = window.location.pathname.replace(/\/+$/, "") || "/";
  const there = flag.page.replace(/\/+$/, "") || "/";
  if (here !== there) {
    return false;
  }
  const heading = flag.fragment
    ? document.getElementById(decodeURIComponent(flag.fragment))
    : null;
  if (flag.fragment && !heading) {
    return false;
  }
  // A page result flashes the page title. A heading result
  // flashes the heading itself. A text or table result flashes
  // the line it came from — the heading only when the line
  // can't be found. A matched line gets scrolled into view:
  // the page lands on the section heading, and on a long
  // section the line can sit below the fold, flashing unseen.
  let target: Element | null;
  let scrollToLine = false;
  if (!flag.fragment || flag.type === "heading") {
    target = flag.fragment ? heading : document.querySelector("main h1");
  } else {
    target = findContentBlock(heading, flag.content, flag.type);
    if (target) {
      scrollToLine = true;
    } else {
      target = heading;
    }
  }
  if (!target) {
    return false;
  }
  const flash = target;
  clearSearchHighlight();
  flash.classList.add("porto-search-highlight");
  if (scrollToLine) {
    const rect = flash.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      flash.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }
  window.setTimeout(() => {
    flash.classList.remove("porto-search-highlight");
  }, 3500);
  return true;
}

/** Retries the highlight every 100ms for up to 10s — a slow
 * navigation needs longer than the old 3s window. */
function startRetry(): number {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts++;
    if (tryHighlight() || attempts >= 100) {
      window.clearInterval(timer);
    }
  }, 100);
  return timer;
}

export function SearchHighlight() {
  const pathname = usePathname();
  useEffect(() => {
    const mountTimer = startRetry();
    const onNavigate = () => {
      startRetry();
    };
    window.addEventListener(SEARCH_NAVIGATE_EVENT, onNavigate);
    return () => {
      window.clearInterval(mountTimer);
      window.removeEventListener(SEARCH_NAVIGATE_EVENT, onNavigate);
    };
  }, []);
  // A second trigger: when the route lands, retry too. The
  // event is the primary path (the layout doesn't re-render on
  // navigation), but if it was ever missed — the listener
  // wasn't mounted yet when the click fired — the pathname
  // change catches it. Harmless when there is no flag.
  useEffect(() => {
    const timer = startRetry();
    return () => {
      window.clearInterval(timer);
    };
  }, [pathname]);
  return null;
}
