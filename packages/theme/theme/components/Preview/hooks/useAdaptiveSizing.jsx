import { useEffect, useRef } from "react";

export function useAdaptiveSizing({
  mode,
  windowWidth,
  windowHeight,
  floatingState,
  setFloatingState,
}) {
  const isMobile = windowWidth <= 480;
  const isTabletPortrait = windowWidth > 480 && windowWidth <= 768;
  const isTabletLandscape = windowWidth > 768 && windowWidth <= 996;
  const isDesktop = windowWidth > 996;

  const isPopupMode = mode === "popup";
  const isDockMode = mode === "dock" && isDesktop;
  const isMobileDock = mode === "dock" && !isDesktop;
  const isPipMode = mode === "pip";

  const prevWidthRef = useRef(windowWidth);

  // Auto-shift PiP when resizing window
  useEffect(() => {
    if (
      floatingState.x !== null &&
      !isDockMode &&
      !(isMobile || isTabletPortrait)
    ) {
      const wasOnRight = floatingState.x > prevWidthRef.current / 2;
      if (wasOnRight) {
        const delta = windowWidth - prevWidthRef.current;
        setFloatingState((prev) => ({ ...prev, x: prev.x + delta }));
      }
    }
    prevWidthRef.current = windowWidth;
  }, [
    windowWidth,
    isDockMode,
    isMobile,
    isTabletPortrait,
    floatingState.x,
    setFloatingState,
  ]);

  const vh =
    windowHeight ??
    (typeof window !== "undefined"
      ? document.documentElement.clientHeight
      : 800);

  // PiP Size
  const pipWidth = isMobile
    ? windowWidth - 32
    : isTabletPortrait || isTabletLandscape
      ? Math.min(400, windowWidth - 60)
      : floatingState.width;

  const pipHeight = isMobile
    ? Math.min(160, vh * 0.3)
    : isTabletPortrait || isTabletLandscape
      ? Math.min(250, vh * 0.4)
      : floatingState.height;

  // Base positions
  const marginX = isMobile ? 16 : 20;
  const marginY = isMobile ? 16 : 20;

  // Clamping constraints
  const getConstrainedPosition = (pipX, pipY) => {
    // Determine minimum visible area
    const minVisibleX = isMobile ? 0 : 20;
    const minVisibleY = isMobile ? 0 : 20;

    const constrainedX = Math.max(
      isMobile ? marginX : -pipWidth + minVisibleX,
      Math.min(
        windowWidth - (isMobile ? pipWidth + marginX : minVisibleX),
        pipX,
      ),
    );
    const constrainedY = Math.max(
      isMobile ? marginY : -pipHeight + minVisibleY,
      Math.min(vh - (isMobile ? pipHeight + marginY : minVisibleY), pipY),
    );

    return { x: constrainedX, y: constrainedY };
  };

  const defaultPipX = windowWidth - pipWidth - marginX;
  const defaultPipY = vh - pipHeight - marginY;

  const { x: pipX, y: pipY } = getConstrainedPosition(
    floatingState.x ?? defaultPipX,
    floatingState.y ?? defaultPipY,
  );

  return {
    isMobile,
    isTabletPortrait,
    isTabletLandscape,
    isDesktop,
    isPopupMode,
    isDockMode,
    isMobileDock,
    isPipMode,
    pipWidth,
    pipHeight,
    pipX,
    pipY,
    vh,
  };
}
