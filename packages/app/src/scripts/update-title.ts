/**
 * Section-based `document.title` updater — vanilla port of the old
 * `utils/updateTitle.jsx`, including the 2026-11-14 hash-sync fix.
 *
 * While scrolling the home page, the title follows the most-visible
 * section and the URL hash syncs to that section's id via
 * `history.replaceState` (no new history entries, no scroll jump).
 * The hash is NOT touched on initial load, so a deep-linked
 * `#section-id` isn't clobbered before the browser's anchor scroll
 * lands. A `hashchange` listener covers anchor navigation (clicking a
 * `#about` link updates the title immediately).
 *
 * Wiring (home page): import this module and call `initUpdateTitle`
 * with the section titles (built from `porto:config` in the page
 * frontmatter, e.g. `{ me: "Home | {site}", about: "About Me | {site}",
 * projects: ..., experience: ..., contact: ... }`) and the site title
 * as `defaultTitle`.
 */

export interface UpdateTitleOptions {
  /** Section id -> document title, e.g. `{ about: "About Me | Site" }`. */
  sections: Record<string, string>;
  /** Title used when no tracked section is visible (the site title). */
  defaultTitle: string;
  /** Set to false to disable. Default: true. */
  enabled?: boolean;
}

/**
 * Starts tracking sections. Returns a cleanup function that removes
 * the scroll and hashchange listeners.
 */
export function initUpdateTitle(options: UpdateTitleOptions): () => void {
  const { sections, defaultTitle } = options;
  const enabled = options.enabled !== false;
  if (!enabled || typeof document === "undefined") {
    return () => {};
  }

  let currentSection: string | null = null;

  const syncHash = () => {
    if (currentSection && window.location.hash !== `#${currentSection}`) {
      window.history.replaceState(null, "", `#${currentSection}`);
    }
  };

  const updateTitle = (syncHashOnScroll = true) => {
    const sectionsToTrack = Object.keys(sections)
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (sectionsToTrack.length === 0) {
      document.title = defaultTitle;
      return;
    }
    const viewportHeight = window.innerHeight;
    let maxVisibleSection: string | null = null;
    let maxVisibleArea = 0;
    for (const section of sectionsToTrack) {
      const rect = section.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(viewportHeight, rect.bottom);
      const visibleArea = Math.max(0, visibleBottom - visibleTop);
      if (visibleArea > maxVisibleArea) {
        maxVisibleArea = visibleArea;
        maxVisibleSection = section.id;
      }
    }
    if (maxVisibleSection && sections[maxVisibleSection]) {
      document.title = sections[maxVisibleSection];
      if (syncHashOnScroll) {
        currentSection = maxVisibleSection;
        syncHash();
      }
    } else {
      document.title = defaultTitle;
      if (syncHashOnScroll) {
        currentSection = null;
      }
    }
  };

  let isScrolling = false;
  const handleScroll = () => {
    if (!isScrolling) {
      window.requestAnimationFrame(() => {
        updateTitle();
        isScrolling = false;
      });
      isScrolling = true;
    }
  };

  const handleHashChange = () => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && sections[hash]) {
      document.title = sections[hash];
      currentSection = hash;
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("hashchange", handleHashChange);
  // Set the title on load, but don't touch the URL hash until the user
  // scrolls, so a deep-linked #section-id isn't clobbered before the
  // browser's anchor scroll lands.
  updateTitle(false);

  return () => {
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("hashchange", handleHashChange);
  };
}
