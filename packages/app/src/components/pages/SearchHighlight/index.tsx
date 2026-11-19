"use client";

import { useEffect } from "react";
import {
  clearSearchHighlight,
  readSearchHighlight,
  SEARCH_NAVIGATE_EVENT,
} from "../../../lib/search-highlight.ts";

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
  // A flag older than 5s is stale (the navigation never
  // landed) — drop it instead of flashing a wrong page.
  if (Date.now() - flag.at > 5000) {
    clearSearchHighlight();
    return true;
  }
  const here = window.location.pathname.replace(/\/+$/, "") || "/";
  const there = flag.page.replace(/\/+$/, "") || "/";
  if (here !== there) {
    return false;
  }
  const target = flag.fragment
    ? document.getElementById(decodeURIComponent(flag.fragment))
    : document.querySelector("main h1");
  if (!target) {
    return false;
  }
  clearSearchHighlight();
  target.classList.add("porto-search-highlight");
  window.setTimeout(() => {
    target.classList.remove("porto-search-highlight");
  }, 2000);
  return true;
}

/** Retries the highlight every 100ms for up to 3s. */
function startRetry(): number {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts++;
    if (tryHighlight() || attempts >= 30) {
      window.clearInterval(timer);
    }
  }, 100);
  return timer;
}

export function SearchHighlight() {
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
  return null;
}
