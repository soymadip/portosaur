import { useEffect, useRef } from "react";
export function useAdaptiveSizing({
  mode,
  windowWidth,
  floatingState,
  dockWidth,
  peekHeight,
  setFloatingState,
}) {
  const isPhone = windowWidth <= 480;
  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 480 && windowWidth <= 996;
  const isDesktop = windowWidth > 996;
  const isPopupMode = mode === "popup";
  const isDockMode = mode === "dock" && isDesktop;
  const showAsPeek = mode === "dock" && !isDesktop;
  const isPipMode = mode === "pip";
  const prevWidthRef = useRef(windowWidth);

  useEffect(() => {
    if (floatingState.x !== null && !isDockMode && !isMobile) {
      const wasOnRight = floatingState.x > prevWidthRef.current / 2;
      if (wasOnRight) {
        const delta = windowWidth - prevWidthRef.current;
        setFloatingState((prev) => ({ ...prev, x: prev.x + delta }));
      }
    }
    prevWidthRef.current = windowWidth;
  }, [windowWidth, isDockMode, isMobile, floatingState.x, setFloatingState]);

  const vh =
    typeof window !== "undefined" ? document.documentElement.clientHeight : 800;

  const pipWidth = isPhone
    ? windowWidth
    : isTablet
      ? Math.min(600, windowWidth - 60)
      : floatingState.width;

  const pipHeight = isPhone
    ? Math.min(floatingState.height, vh * 0.7)
    : isTablet
      ? Math.min(450, vh * 0.6)
      : floatingState.height;

  const marginX = isPhone ? 0 : 20;
  const marginY = isPhone ? 0 : 20;
  const defaultPipX = isTablet
    ? (windowWidth - pipWidth) / 2
    : isPhone
      ? 0
      : Math.max(16, windowWidth - pipWidth - marginX);

  const defaultPipY = isPhone
    ? vh - pipHeight
    : Math.max(16, vh - pipHeight - marginY);

  let rndX = floatingState.x ?? defaultPipX;
  let rndY = floatingState.y ?? defaultPipY;

  if (!isDockMode && !isPhone && floatingState.x !== null) {
    const minVisible = 60;
    const minVisibleY = 50;

    rndX = Math.max(
      -pipWidth + minVisible,
      Math.min(windowWidth - minVisible, rndX),
    );
    rndY = Math.max(-pipHeight + minVisibleY, Math.min(vh - minVisibleY, rndY));
  }

  const popupWidth = isMobile
    ? windowWidth * 0.95
    : Math.min(windowWidth * 0.8, 1000);

  const popupHeight = isMobile ? vh * 0.9 : Math.min(vh * 0.8, 800);

  const rndPosition = isPopupMode
    ? { x: (windowWidth - popupWidth) / 2, y: (vh - popupHeight) / 2 }
    : isDockMode
      ? { x: windowWidth - dockWidth, y: 0 }
      : showAsPeek
        ? { x: 0, y: Math.max(0, vh - peekHeight) }
        : { x: rndX, y: rndY };

  const rndSize = isPopupMode
    ? { width: popupWidth, height: popupHeight }
    : isDockMode
      ? { width: dockWidth, height: vh }
      : showAsPeek
        ? { width: windowWidth, height: peekHeight }
        : { width: pipWidth, height: pipHeight };

  const rndBounds = isPhone
    ? { left: 0, top: 0, right: windowWidth, bottom: vh }
    : isDockMode
      ? { left: 0, top: 0, right: windowWidth, bottom: vh }
      : undefined;

  return {
    isPhone,
    isMobile,
    isTablet,
    isDesktop,
    isPopupMode,
    isDockMode,
    showAsPeek,
    isPipMode,
    rndPosition,
    rndSize,
    rndBounds,
    pipWidth,
    pipHeight,
    vh,
  };
}
