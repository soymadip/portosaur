/**
 * Touchstart preload (Docusaurus's `Link` mechanism) — vanilla
 * script, imported by BaseLayout on every page.
 *
 * A delegated `touchstart` listener prefetches the touched internal
 * link, giving the tap a head start even when viewport prefetching
 * hasn't reached it yet. Astro's own tap handler only covers links
 * with no explicit prefetch strategy, so viewport-prefetched links
 * (navbar, sidebar) get no tap preload from Astro — this fills that
 * gap.
 *
 * Best-effort only: it does not fix the router re-downloading an
 * in-flight prefetch (the prefetch volume cap in SidebarSublist +
 * sidebar-prefetch.ts is the main fix for that). A touch is explicit
 * intent, so the prefetch bypasses the slow-connection check, like
 * Astro's own tap handler.
 */

import { prefetch } from "astro:prefetch";

/** URLs already preloaded by touch, so each fetches once per page. */
const prefetchedOnTouch = new Set<string>();

document.addEventListener(
  "touchstart",
  (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const link = event.target.closest("a[href]");
    if (!link) {
      return;
    }
    const href = link.getAttribute("href");
    if (
      !href ||
      !href.startsWith("/") ||
      href.startsWith("//") ||
      link.hasAttribute("target")
    ) {
      return;
    }
    // Normalize to an absolute URL: Astro's viewport strategy passes
    // `anchor.href` (absolute) to `prefetch()`, and its dedupe is a
    // string comparison — a relative href for the same page would
    // append a second prefetch link for it.
    const url = new URL(href, location.href).href;
    if (prefetchedOnTouch.has(url)) {
      return;
    }
    prefetchedOnTouch.add(url);
    prefetch(url, { ignoreSlowConnection: true });
  },
  { passive: true },
);
