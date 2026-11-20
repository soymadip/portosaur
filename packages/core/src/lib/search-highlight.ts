/**
 * The search-result highlight handoff: clicking a result stores
 * its target (page + fragment) in sessionStorage, and the
 * `SearchHighlight` component on the destination page reads it,
 * flashes the matched section, and clears it. Nothing travels in
 * the URL, so a plain link or a TOC click never triggers a flash.
 */

const KEY = "porto-search-highlight";

/**
 * The event a search-result click dispatches after storing its
 * target. The highlight component listens for it — the docs
 * layout does not re-render on client-side navigation, so no
 * effect would pick the flag up otherwise.
 */
export const SEARCH_NAVIGATE_EVENT = "porto-search-navigate";

/** A pending highlight: the page to flash on, and the section within it. */
export interface SearchHighlightFlag {
  /** The destination page's path, without any `#fragment`. */
  page: string;
  /** The section's id, or null for a page result (the page title flashes). */
  fragment: string | null;
  /** The result kind: page, heading, text, or table-row. */
  type: string;
  /** The result's text — for text and table results, the line to
   * find and flash on the page. */
  content: string;
  /** When the result was clicked — flags older than 5s are stale. */
  at: number;
}

/** Stores a result's target for the destination page to flash,
 * and tells the highlight component the navigation started. */
export function markSearchNavigation(entry: {
  url: string;
  type: string;
  content: string;
}) {
  try {
    const [page, fragment] = entry.url.split("#");
    const flag: SearchHighlightFlag = {
      page,
      fragment: fragment ?? null,
      type: entry.type,
      content: entry.content,
      at: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(flag));
    window.dispatchEvent(new CustomEvent(SEARCH_NAVIGATE_EVENT));
  } catch {
    // Storage unavailable (private mode) — no highlight.
  }
}

/** Reads the pending highlight, if any. Does not clear it. */
export function readSearchHighlight(): SearchHighlightFlag | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const flag = JSON.parse(raw) as SearchHighlightFlag;
    if (typeof flag.page !== "string" || typeof flag.at !== "number") {
      return null;
    }
    return flag;
  } catch {
    return null;
  }
}

/** Clears the pending highlight. */
export function clearSearchHighlight() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
