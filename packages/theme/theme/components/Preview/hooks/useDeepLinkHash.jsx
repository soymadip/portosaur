import { useEffect } from "react";
import { generatePvSlug, generatePvHash } from "../utils";

export function useDeepLinkHash(isOpen, sources, activeIndex, mode, baseSlug) {
  useEffect(() => {
    if (!isOpen) return;

    let slug = baseSlug;
    if (sources && sources.length > 1 && activeIndex > 0) {
      const tabNum = activeIndex + 1;
      slug = baseSlug ? `${baseSlug}-tab${tabNum}` : `tab${tabNum}`;
    }

    if (slug) {
      const newHash = generatePvHash(slug, mode);
      if (window.location.hash !== `#${newHash}`) {
        window.history.replaceState(null, "", `#${newHash}`);
      }
    }
  }, [activeIndex, isOpen, sources, mode, baseSlug]);
}
