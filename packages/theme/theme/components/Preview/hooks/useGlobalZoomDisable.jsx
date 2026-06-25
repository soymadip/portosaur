import { useEffect } from "react";

export function useGlobalZoomDisable(isOpen) {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    // Prevent desktop trackpad pinch-zoom globally (outside iframes)
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // Use capture phase so we intercept the event before the browser acts on it.
    // We call preventDefault() to block site zoom, but NOT stopPropagation(),
    // so usePinchZoom's element-level listener still receives the event for content zoom.
    window.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [isOpen]);
}
