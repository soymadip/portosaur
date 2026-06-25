import React, { useRef } from "react";
import styles from "../../../styles.module.css";
import { useMobileDockResize } from "../../../hooks/useMobileDockResize";

export default function MobileDockLayout({
  isVisible,
  children,
  peekHeight,
  setPeekHeight,
  closePreview,
}) {
  const dockRef = useRef(null);
  const { handlePointerDown, handlePointerMove, handlePointerUp } =
    useMobileDockResize({
      dockRef,
      peekHeight,
      setPeekHeight,
      closePreview,
    });

  return (
    <div
      ref={dockRef}
      className={`${styles.previewSystem} ${styles.modeMobileDock} ${isVisible ? styles.pvVisible : ""}`}
      style={{
        "--mobile-dock-height": `${peekHeight}px`,
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${peekHeight}px`,
        zIndex: 1000,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {React.cloneElement(children, {
        isMobileDock: true,
        handlePeekPointerDown: handlePointerDown,
      })}
    </div>
  );
}
