import { useRef } from "react";

export function useMobileDockResize({
  dockRef,
  peekHeight,
  setPeekHeight,
  closePreview,
}) {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const startTimeRef = useRef(0);
  const vh =
    typeof window !== "undefined" ? document.documentElement.clientHeight : 800;

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = peekHeight;
    startTimeRef.current = performance.now();
    document.body.classList.add("pv-resizing");
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const newHeight = Math.max(
      100,
      Math.min(startHeightRef.current + deltaY, vh * 0.95),
    );

    if (dockRef && dockRef.current) {
      dockRef.current.style.height = `${newHeight}px`;
      dockRef.current.style.setProperty(
        "--mobile-dock-height",
        `${newHeight}px`,
      );
    } else {
      setPeekHeight(newHeight);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.classList.remove("pv-resizing");
    e.target.releasePointerCapture(e.pointerId);

    const deltaY = startYRef.current - e.clientY;
    const deltaTime = performance.now() - startTimeRef.current;

    // Negative deltaY means dragged down.
    // Velocity: pixels per ms
    const velocity = deltaY / deltaTime;

    // Swipe to dismiss conditions:
    // Fast flick downwards (velocity <= -0.3)
    // Dragged down more than 35% of the starting height
    if (velocity <= -0.3 || deltaY <= -(startHeightRef.current * 0.35)) {
      closePreview();
    } else {
      const newHeight = Math.max(
        100,
        Math.min(startHeightRef.current + deltaY, vh * 0.95),
      );
      setPeekHeight(newHeight);
    }
  };

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
