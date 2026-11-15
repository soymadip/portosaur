// Derived from Starlight (MIT License) — see packages/app/NOTICE.md.
// Persists the docs sidebar's open/closed groups and scroll position in
// `sessionStorage` across page navigations, renamed to Portosaur's
// `porto-` prefix throughout.
//
// Also prefetches a category's children when the category opens (and
// the already-open categories' children once the sidebar is visible):
// nested links carry no viewport-prefetch attribute (see
// SidebarSublist), so without this the tap after opening a category
// would fetch the whole page from cold.

import {
  prefetchCategoryChildren,
  prefetchOpenCategoryChildren,
} from "./sidebar-prefetch.ts";

// Elements are re-queried fresh on every use: client-side
// navigation replaces the sidebar, so anything captured at module
// load is detached after the first navigation.
const getScroller = () => document.getElementById("porto__sidebar");
const getTarget = () =>
  getScroller()?.querySelector<HTMLElement>("porto-sidebar-state-persist");

/** Portosaur uses this key to store sidebar state in `sessionStorage`. */
const storageKey = "porto-sidebar-state";

/** The shape used to persist sidebar state across a user’s session. */
interface SidebarState {
  hash: string;
  open: Array<boolean | null>;
  scroll: number;
}

/**
 * Get the current sidebar state.
 *
 * The `open` state is loaded from session storage when the sidebar hashes match, while `scroll`
 * and `hash` are read from the current page.
 */
const getState = (): SidebarState => {
  let open: SidebarState["open"] = [];
  const hash = getTarget()?.dataset.hash || "";
  try {
    const rawStoredState = sessionStorage.getItem(storageKey);
    const storedState = JSON.parse(rawStoredState || "{}") as SidebarState;
    if (Array.isArray(storedState.open) && storedState.hash === hash)
      open = storedState.open;
  } catch {}
  return {
    hash,
    open,
    scroll: getScroller()?.scrollTop || 0,
  };
};

/** Store the passed sidebar state in session storage. */
const storeState = (state: SidebarState): void => {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {}
};

/**
 * Updates sidebar state in session storage without modifying `open`
 * state. Skipped when the current page has no persist target (the
 * mobile menu-only sidebar on non-docs pages): storing an empty
 * state there would wipe the docs sidebar's saved state.
 */
const updateState = (): void => {
  if (!getTarget()) {
    return;
  }
  storeState(getState());
};

/** Updates sidebar state in session storage to include a new value for a specific `<details>` element. */
const setToggleState = (open: boolean, detailsIndex: number): void => {
  const state = getState();
  state.open[detailsIndex] = open;
  storeState(state);
};

/**
 * Per-page setup: wire the click listener that stores the `open`
 * state of toggled `<details>` groups, and restore the sidebar's
 * scroll position from the stored state (the inline script in
 * SidebarPersister only runs on the first load — client-side
 * navigation needs this re-run). The marker keeps a re-run on the
 * same sidebar from double-wiring the listener.
 */
const setupSidebarPersist = (): void => {
  const target = getTarget();
  if (!target || target.hasAttribute("data-porto-wired")) {
    return;
  }
  target.setAttribute("data-porto-wired", "");
  // Restore the scroll position when the stored state belongs to
  // this sidebar (same hash).
  try {
    const storedState = JSON.parse(
      sessionStorage.getItem(storageKey) || "{}",
    ) as SidebarState;
    const scroller = getScroller();
    if (
      scroller &&
      storedState.hash === target.dataset.hash &&
      typeof storedState.scroll === "number"
    ) {
      scroller.scrollTop = storedState.scroll;
    }
  } catch {}
  // Store the current `open` state whenever a user interacts with one of the `<details>` groups.
  target.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    // Query for the nearest `<summary>` and then its parent `<details>`.
    // This excludes clicks outside of the `<summary>`, which don’t trigger toggles.
    const toggledDetails = event.target.closest("summary")?.closest("details");
    if (!toggledDetails) return;
    const restoreElement = toggledDetails.querySelector<HTMLElement>(
      "porto-sidebar-restore",
    );
    const index = parseInt(restoreElement?.dataset.index || "");
    if (isNaN(index)) return;
    setToggleState(!toggledDetails.open, index);
    if (!toggledDetails.open) {
      // Opening the category reveals its children — prefetch them
      // now, so the tap after opening swaps instantly instead of
      // fetching the whole page from cold.
      prefetchCategoryChildren(toggledDetails);
    }
  });
  // The categories already open (the active section, or restored
  // state) show their children — prefetch them now, but only while
  // the sidebar is actually visible. On desktop it always is; on
  // mobile it sits inside the closed menu popover, and the
  // menu-open prefetch (MobileMenu) covers it instead.
  if (window.matchMedia("(min-width: 50em)").matches) {
    prefetchOpenCategoryChildren();
  }
};

setupSidebarPersist();
document.addEventListener("astro:page-load", setupSidebarPersist);

// Store sidebar state before navigating. These will also store it on tab blur etc.,
// but avoid using the `beforeunload` event, which can cause issues with back/forward cache
// on some browsers.
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") updateState();
});
