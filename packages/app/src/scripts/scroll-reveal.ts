/**
 * Scroll reveal — vanilla port of the old `useScrollReveal` hook.
 *
 * Observes every `[data-reveal]` element and toggles a class while it
 * is visible in the viewport (like the old hook, the class is removed
 * again when the element scrolls out of view). The reveal styling
 * itself (initial hidden state + `.is-visible` shown state) lives in
 * the theme CSS.
 *
 * Call `initScrollReveal` explicitly and keep its cleanup: with
 * client-side navigation the observed elements are replaced, so the
 * page re-scans on `astro:page-load` and disconnects the old
 * observer (an auto-init on import would leak it).
 */

const DEFAULT_CLASS = "is-visible";

/**
 * Starts observing `[data-reveal]` elements.
 *
 * @param options - IntersectionObserver options (default threshold 0.05,
 *   same as the old hook).
 * @param className - Class toggled while an element is visible.
 * @returns A cleanup function that disconnects the observer.
 */
export function initScrollReveal(
  options: IntersectionObserverInit = { threshold: 0.05 },
  className: string = DEFAULT_CLASS,
): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }
  const elements = document.querySelectorAll("[data-reveal]");
  if (elements.length === 0 || typeof IntersectionObserver === "undefined") {
    return () => {};
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      entry.target.classList.toggle(className, entry.isIntersecting);
    }
  }, options);
  elements.forEach((element) => {
    observer.observe(element);
  });
  return () => {
    observer.disconnect();
  };
}
