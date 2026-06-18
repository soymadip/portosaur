import { useEffect } from "react";
import { generatePvHash } from "../utils";

export function useDeepLinkHash(isOpen, sources, activeIndex, mode, baseSlug) {
  useEffect(() => {
    if (!isOpen || !baseSlug) return;

    const newHash = generatePvHash(baseSlug, mode, activeIndex);

    if (window.location.hash !== `#${newHash}`) {
      window.history.replaceState(null, "", `#${newHash}`);
    }
  }, [activeIndex, isOpen, sources, mode, baseSlug]);
}
