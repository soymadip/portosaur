/**
 * Navigation progress bar (Docusaurus's NProgress mechanism) —
 * vanilla script, imported by BaseLayout on every page. The bar
 * itself is rendered by `NavProgress.astro`.
 *
 * A navigation starts the bar only after a 200ms delay (like
 * Docusaurus's `nprogress.ts`: `setTimeout(start, 200)`), so slow
 * navigations show something and fast ones show nothing — no
 * flicker. The bar finishes on `astro:after-swap`, with
 * `astro:page-load` as a fallback so a failed navigation can't leave
 * it stuck.
 *
 * The bar element is re-queried fresh on every use: client-side
 * navigation replaces the body, so a cached element is detached
 * after the first swap.
 */

/** Delay before the bar appears — fast navigations never show it. */
const SHOW_DELAY_MS = 200;

/** Time the finished bar lingers before resetting to empty. */
const RESET_DELAY_MS = 400;

/** The pending delayed-show timer, if a navigation is in flight. */
let showTimer: number | undefined;

/** The bar element on the current page, if it exists. */
function getBar(): HTMLElement | null {
  return document.getElementById("porto-nav-progress");
}

/** Shows the bar, restarting its crawl from empty. */
function showBar(): void {
  const bar = getBar();
  if (!bar) {
    return;
  }
  bar.classList.remove("is-done");
  // Force a reflow so the scaleX transition restarts from 0 instead
  // of continuing from the previous run's end state.
  void bar.offsetWidth;
  bar.classList.add("is-active");
}

/** Finishes the bar: completes the crawl, then fades it out. */
function finishBar(): void {
  if (showTimer !== undefined) {
    window.clearTimeout(showTimer);
    showTimer = undefined;
  }
  const bar = getBar();
  if (!bar || !bar.classList.contains("is-active")) {
    return;
  }
  bar.classList.remove("is-active");
  bar.classList.add("is-done");
  window.setTimeout(() => {
    // A new navigation may have started meanwhile — showBar removes
    // `is-done` itself, so only reset when the bar is idle.
    if (!bar.classList.contains("is-active")) {
      bar.classList.remove("is-done");
    }
  }, RESET_DELAY_MS);
}

// A navigation begins — schedule the delayed show. Fast
// navigations finish before the delay and show nothing.
document.addEventListener("astro:before-preparation", () => {
  if (showTimer !== undefined) {
    return;
  }
  showTimer = window.setTimeout(() => {
    showTimer = undefined;
    showBar();
  }, SHOW_DELAY_MS);
});

// The swap is the navigation completing — finish the bar. Page-load
// is the fallback so a failed navigation can't leave it stuck.
document.addEventListener("astro:after-swap", finishBar);
document.addEventListener("astro:page-load", finishBar);
