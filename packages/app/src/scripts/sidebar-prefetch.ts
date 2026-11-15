/**
 * Sidebar category prefetching — vanilla module, used by the sidebar
 * persist script (category toggle) and the mobile menu (menu open).
 *
 * Nested sidebar links carry no viewport-prefetch attribute (see
 * SidebarSublist): viewport-prefetching the whole visible tree
 * saturated slow connections, and the router's fetch doesn't reuse
 * an in-flight prefetch. Instead, a category's children prefetch
 * when the category opens — only that category, not the whole tree —
 * and the categories already open (the active section, or restored
 * state) prefetch their children once the sidebar is visible.
 *
 * Every prefetch is gated on the slow-connection check and deduped
 * per URL, like the mobile menu's nav-link prefetching.
 */

import { prefetch } from "astro:prefetch";
import { isSlowConnection } from "./prefetch-gate.ts";

/** URLs already prefetched from the sidebar, so each fetches once. */
const prefetchedSidebarLinks = new Set<string>();

/** Prefetches one internal link, unless it was already prefetched. */
function prefetchLink(href: string | null): void {
  if (!href || !href.startsWith("/") || href.startsWith("//")) {
    return;
  }
  // Normalize to an absolute URL: Astro's viewport strategy passes
  // `anchor.href` (absolute) to `prefetch()`, and its dedupe is a
  // string comparison — a relative href for the same page would
  // append a second prefetch link for it.
  const url = new URL(href, location.href).href;
  if (prefetchedSidebarLinks.has(url)) {
    return;
  }
  prefetchedSidebarLinks.add(url);
  prefetch(url);
}

/**
 * Prefetches the links a category reveals when it opens: its own
 * index link plus its direct children (leaf links and sub-category
 * index links) — not deeper descendants, which prefetch when their
 * own category opens.
 */
export function prefetchCategoryChildren(details: Element): void {
  if (isSlowConnection()) {
    return;
  }
  prefetchLink(
    details.querySelector(":scope > summary a[href]")?.getAttribute("href") ??
      null,
  );
  details
    .querySelectorAll(
      ":scope > ul > li > a[href], :scope > ul > li > details > summary a[href]",
    )
    .forEach((link) => {
      prefetchLink(link.getAttribute("href"));
    });
}

/**
 * Prefetches the children of every category that is already open.
 * Callers only call this while the sidebar is visible (desktop
 * setup, or the mobile menu just opened) — prefetching a hidden
 * sidebar's links would spend bandwidth the user can't see yet.
 */
export function prefetchOpenCategoryChildren(): void {
  document
    .querySelectorAll("porto-sidebar-state-persist details[open]")
    .forEach((details) => {
      prefetchCategoryChildren(details);
    });
}
