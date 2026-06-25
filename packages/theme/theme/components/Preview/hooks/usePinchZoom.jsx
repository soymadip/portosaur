import { useEffect, useRef } from "react";

export function usePinchZoom(ref, zoomLevel, setZoomLevel, disabled = false) {
  const currentZoomRef = useRef(zoomLevel);

  useEffect(() => {
    if (currentZoomRef.current !== zoomLevel) {
      const oldZoom = currentZoomRef.current;
      const newZoom = zoomLevel;
      const el = ref?.current;

      if (el && oldZoom > 0) {
        const rect = el.getBoundingClientRect();
        const wV = rect.width;
        const hV = rect.height;
        const focalX = wV / 2;
        const focalY = hV / 2;

        const wC_old = wV * oldZoom;
        const hC_old = hV * oldZoom;

        const xLeft_old = wC_old <= wV ? (wV - wC_old) / 2 : -el.scrollLeft;
        const yTop_old = hC_old <= hV ? (hV - hC_old) / 2 : -el.scrollTop;

        const target = el.firstElementChild;

        if (target) {
          target.style.setProperty("--zoom", newZoom);
          window.dispatchEvent(
            new CustomEvent("pv-zoom-update", { detail: newZoom }),
          );
        }

        // Force synchronous layout recalculation so the new scroll limits are applied
        // BEFORE we set scrollLeft/scrollTop (prevents clamping to old smaller sizes)
        void el.scrollWidth;

        const scaleRatio = newZoom / oldZoom;
        el.scrollLeft = (focalX - xLeft_old) * scaleRatio - focalX;
        el.scrollTop = (focalY - yTop_old) * scaleRatio - focalY;
      }

      currentZoomRef.current = newZoom;
    }
  }, [zoomLevel, ref]);

  useEffect(() => {
    const el = ref?.current;

    if (!el || disabled) {
      return;
    }

    let initialDist = null;
    let initialZoom = null;
    let visualScale = 1;
    let wheelTimeout = null;

    const applyVisualScale = (scale, focalX, focalY) => {
      visualScale = scale;
      const target = el.firstElementChild;

      if (target) {
        const baseZoom = initialZoom || currentZoomRef.current;
        const newZoom = Math.min(Math.max(0.25, baseZoom * scale), 2.5);

        const oldZoom =
          parseFloat(target.style.getPropertyValue("--zoom")) ||
          currentZoomRef.current;

        if (
          focalX !== undefined &&
          focalY !== undefined &&
          newZoom !== oldZoom &&
          oldZoom > 0
        ) {
          const rect = el.getBoundingClientRect();
          const wV = rect.width;
          const hV = rect.height;

          const clientX = focalX - rect.left;
          const clientY = focalY - rect.top;

          const wC_old = wV * oldZoom;
          const hC_old = hV * oldZoom;

          const xLeft_old = wC_old <= wV ? (wV - wC_old) / 2 : -el.scrollLeft;
          const yTop_old = hC_old <= hV ? (hV - hC_old) / 2 : -el.scrollTop;

          target.style.setProperty("--zoom", newZoom);
          window.dispatchEvent(
            new CustomEvent("pv-zoom-update", { detail: newZoom }),
          );

          // Force layout reflow so scroll limits expand before assignment
          void el.scrollWidth;

          const scaleRatio = newZoom / oldZoom;
          el.scrollLeft = (clientX - xLeft_old) * scaleRatio - clientX;
          el.scrollTop = (clientY - yTop_old) * scaleRatio - clientY;
        } else {
          target.style.setProperty("--zoom", newZoom);
          window.dispatchEvent(
            new CustomEvent("pv-zoom-update", { detail: newZoom }),
          );
        }
      }
    };

    const commitZoom = () => {
      if (visualScale !== 1) {
        const baseZoom = initialZoom || currentZoomRef.current;
        const newZoom = Math.min(Math.max(0.25, baseZoom * visualScale), 2.5);
        currentZoomRef.current = newZoom;

        setZoomLevel(newZoom);

        visualScale = 1;
      }
    };

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();

        const delta = e.deltaY * -0.01;
        const targetScale = Math.min(
          Math.max(0.25 / currentZoomRef.current, visualScale + delta),
          2.5 / currentZoomRef.current,
        );

        applyVisualScale(targetScale, e.clientX, e.clientY);

        if (wheelTimeout) {
          clearTimeout(wheelTimeout);
        }

        wheelTimeout = setTimeout(commitZoom, 150);
      }
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        initialZoom = currentZoomRef.current;
        visualScale = 1;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && initialDist !== null) {
        if (e.cancelable) {
          e.preventDefault();
        }

        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const scale = currentDist / initialDist;
        const targetScale = Math.min(
          Math.max(0.25 / initialZoom, scale),
          2.5 / initialZoom,
        );

        const focalX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const focalY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        applyVisualScale(targetScale, focalX, focalY);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2 && initialDist !== null) {
        commitZoom();
        initialDist = null;
        initialZoom = null;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      if (wheelTimeout) clearTimeout(wheelTimeout);
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [ref, setZoomLevel, disabled]);
}
