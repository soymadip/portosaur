import React, { useRef } from "react";
import styles from "../../../styles.module.css";

/**
 * DockLayout — renders as a natural sticky flex sibling in the Layout.
 * No fixed positioning or JS tracking needed: it sticks to the top of the
 * viewport automatically (like the Docusaurus sidebar), moves with the navbar
 * when hideOnScroll fires, and stops before the footer because the flex
 * column ends there.
 */
export default function DockLayout({
  isVisible,
  children,
  setDockWidth,
  dockWidth,
}) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = dockWidth;
    document.body.classList.add("pv-resizing");
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = startXRef.current - e.clientX;
    const newWidth = Math.max(
      300,
      Math.min(startWidthRef.current + deltaX, window.innerWidth * 0.8),
    );
    setDockWidth(newWidth);
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.classList.remove("pv-resizing");
    e.target.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`${styles.previewSystem} ${styles.modeDock} ${isVisible ? styles.pvVisible : ""}`}
      style={{ "--pv-dock-width": `${dockWidth}px` }}
    >
      <div
        className={styles.dockResizeHandle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {children}
    </div>
  );
}
