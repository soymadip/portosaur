import { useEffect, useRef } from "react";
import { generatePvSlug, generatePvHash } from "../utils";

/**
 * Syncs the URL hash with the active preview tab.
 * Also scrolls the active tab element into view.
 */
export function useDeepLinkHash(
  isOpen,
  sources,
  activeIndex,
  tabRefs,
  isDocked,
) {
  useEffect(() => {
    if (!isOpen) return;

    const src = sources[activeIndex];
    if (src) {
      const slug = generatePvSlug(src.label, src.path);
      const newHash = generatePvHash(slug, isDocked);

      if (window.location.hash !== `#${newHash}`) {
        window.history.replaceState(null, "", `#${newHash}`);
      }
    }

    // Scroll active tab into view
    const activeTabEl = tabRefs.current?.[activeIndex];
    if (activeTabEl) {
      activeTabEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeIndex, isOpen, sources, isDocked]);
}
