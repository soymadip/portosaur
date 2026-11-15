/**
 * Stricter slow-connection gate for prefetching — vanilla script,
 * imported by BaseLayout on every page.
 *
 * Astro's own gate only fires on data-saver mode or a `2g`
 * `effectiveType`, but a throttled test showed `effectiveType` stays
 * `"4g"` at 300Kbps/150ms latency, so the gate never fires for a slow
 * connection in practice. This gate also treats a low `downlink`
 * estimate or a high round-trip time as slow, and every programmatic
 * prefetch (menu-open, category-open) checks it before fetching.
 *
 * Attribute-based viewport prefetching is gated the same way, in two
 * halves: the inline script in BaseLayout strips the viewport
 * attributes on the initial load (a classic script runs during
 * parsing, before Astro's deferred prefetch module initializes), and
 * the `astro:before-swap` listener below strips them from the
 * incoming document on every client-side navigation (the prefetch
 * module observes the new anchors only after the swap, on
 * `astro:page-load`). Stripped links fall back to the hover strategy
 * (`prefetchAll: true`) — intent-based, one link at a time — instead
 * of prefetching a whole viewport of pages. Keep the thresholds in
 * sync with the inline script in BaseLayout.
 */

/** Below ~1 Mbps of estimated bandwidth, prefetching hurts more than it helps. */
const SLOW_DOWNLINK_MBPS = 1;

/** Above ~400ms round-trip, the pipe is too slow to share with prefetches. */
const SLOW_RTT_MS = 400;

/** The Network Information API shape (Chrome-only, untyped in lib.dom). */
interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

/** Whether the connection is too slow for speculative prefetching. */
export function isSlowConnection(): boolean {
  try {
    const connection = (
      navigator as Navigator & { connection?: NetworkInformationLike }
    ).connection;
    if (!connection) {
      return false;
    }
    if (connection.saveData) {
      return true;
    }
    if (connection.effectiveType && /2g/.test(connection.effectiveType)) {
      return true;
    }
    if (
      typeof connection.downlink === "number" &&
      connection.downlink < SLOW_DOWNLINK_MBPS
    ) {
      return true;
    }
    if (typeof connection.rtt === "number" && connection.rtt > SLOW_RTT_MS) {
      return true;
    }
  } catch {
    // Network Information API unavailable — prefetch as normal.
  }
  return false;
}

/** Removes every viewport-prefetch attribute under `root`. */
export function stripViewportPrefetch(root: ParentNode): void {
  root.querySelectorAll("[data-astro-prefetch='viewport']").forEach((el) => {
    el.removeAttribute("data-astro-prefetch");
  });
}

// Gate navigations too: the inline script in BaseLayout only runs on
// the initial load, so strip the incoming document's viewport
// attributes before the swap.
document.addEventListener("astro:before-swap", (event) => {
  if (!isSlowConnection()) {
    return;
  }
  const newDocument = (event as Event & { newDocument?: Document }).newDocument;
  if (newDocument) {
    stripViewportPrefetch(newDocument);
  }
});
