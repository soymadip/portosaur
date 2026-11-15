/**
 * Hash navigation for card grids (ported from the old
 * `utils/HashNavigation.jsx`).
 *
 * When the page loads with a `#<slug>` hash, scrolls the matching card
 * (by `id="<prefix><slug>"`) into view, highlights it, blurs the other
 * cards, and shows a dismissable overlay. The effect clears after
 * `effectDuration`, on overlay click/tap, or on Escape.
 *
 * The styles for the `hash-nav-*` classes live in the using page's
 * `<style>` block (as `:global()` rules — the classes are added by this
 * script to elements owned by other components, so scoped selectors
 * would not match them).
 */

export interface HashNavigationOptions {
  /** Id prefix of the target elements (default `"note-"`). */
  elementPrefix?: string;
  /** Selector for the cards to blur (default `".note-card"`). */
  elementSelector?: string;
  /** Selector for the container that gets the overlay (default `".container"`). */
  containerSelector?: string;
  /** How long the highlight lasts, in ms (default `6000`). */
  effectDuration?: number;
  /** Delay before scrolling, in ms (default `300`). */
  scrollDelay?: number;
  /** `scrollIntoView` options (default smooth, centered). */
  scrollOptions?: ScrollIntoViewOptions;
  /** Set to `false` to disable (default `true`). */
  enabled?: boolean;
}

// The previous run's cleanup, if its effect is still active — and the
// pending scroll timeout, if its effect hasn't started yet. A second
// run (same-page hash change) clears the first run instead of stacking
// a second highlight and overlay on top of it: without this, the
// first run's delayed timeout would also remove the second run's
// highlight when it fires.
let clearPreviousEffect: (() => void) | null = null;
let pendingScrollTimeoutId: number | null = null;

export function initHashNavigation(options: HashNavigationOptions = {}): void {
  const {
    elementPrefix = "note-",
    elementSelector = ".note-card",
    containerSelector = ".container",
    effectDuration = 6000,
    scrollDelay = 300,
    scrollOptions = { behavior: "smooth", block: "center" },
    enabled = true,
  } = options;

  if (!enabled) {
    return;
  }

  // A re-run supersedes the previous run — clear its effect (or its
  // not-yet-started scroll) first, even when this run finds no hash
  // or target: a stale highlight must not outlive the hash that
  // caused it.
  if (clearPreviousEffect) {
    clearPreviousEffect();
    clearPreviousEffect = null;
  }
  if (pendingScrollTimeoutId !== null) {
    window.clearTimeout(pendingScrollTimeoutId);
    pendingScrollTimeoutId = null;
  }

  if (!window.location.hash) {
    return;
  }

  const hashValue = window.location.hash.substring(1);
  const targetElement = document.getElementById(`${elementPrefix}${hashValue}`);
  if (!targetElement) {
    return;
  }

  pendingScrollTimeoutId = window.setTimeout(() => {
    pendingScrollTimeoutId = null;
    targetElement.scrollIntoView(scrollOptions);

    const container = document.querySelector(containerSelector);
    if (container) {
      container.classList.add("hash-nav-active");
    }

    const allElements = document.querySelectorAll(elementSelector);
    targetElement.classList.add("hash-nav-highlight");
    allElements.forEach((element) => {
      if (element !== targetElement) {
        element.classList.add("hash-nav-blur");
      }
    });

    const overlay = document.createElement("div");
    overlay.className = "hash-nav-overlay";
    document.body.appendChild(overlay);

    let effectTimeoutId: number | null = null;

    const removeEffects = () => {
      if (effectTimeoutId !== null) {
        window.clearTimeout(effectTimeoutId);
        effectTimeoutId = null;
      }
      if (clearPreviousEffect === removeEffects) {
        clearPreviousEffect = null;
      }
      allElements.forEach((element) => {
        element.classList.remove("hash-nav-blur");
      });
      targetElement.classList.remove("hash-nav-highlight");
      if (container) {
        container.classList.remove("hash-nav-active");
      }
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      overlay.removeEventListener("click", removeEffects);
      overlay.removeEventListener("touchstart", removeEffects);
      document.removeEventListener("keydown", handleKeyDown);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        removeEffects();
      }
    };

    overlay.addEventListener("click", removeEffects);
    overlay.addEventListener("touchstart", removeEffects);
    document.addEventListener("keydown", handleKeyDown);
    clearPreviousEffect = removeEffects;
    effectTimeoutId = window.setTimeout(removeEffects, effectDuration);
  }, scrollDelay);
}
