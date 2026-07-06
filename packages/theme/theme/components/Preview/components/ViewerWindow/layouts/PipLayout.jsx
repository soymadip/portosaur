import React from "react";
import { Rnd } from "react-rnd";

import styles from "../../../styles.module.css";
import Icon from "@theme/components/Icon";

export default function PipLayout({
  isVisible,
  children,
  pipWidth,
  pipHeight,
  pipX,
  pipY,
  setFloatingState,
  isMobile,
}) {
  const [isResizing, setIsResizing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });

  const handleDragStart = (_e, d) => {
    setIsDragging(true);
    dragStartPos.current = { x: d.x, y: d.y };
  };

  const handleDragStop = (e, d) => {
    let finalX = d.x;
    let finalY = d.y;
    setFloatingState({ x: finalX, y: finalY });
    setIsDragging(false);

    const dx = Math.abs(finalX - dragStartPos.current.x);
    const dy = Math.abs(finalY - dragStartPos.current.y);

    if ((isHiddenLeft || isHiddenRight) && dx < 5 && dy < 5) {
      if (isHiddenLeft) {
        setFloatingState({ x: margin });
      } else {
        setFloatingState({
          x: document.documentElement.clientWidth - pipWidth - margin,
        });
      }
    }
  };

  const margin = isMobile ? 16 : 20;
  const isHiddenLeft = pipX <= -pipWidth + margin + 5;
  const isHiddenRight =
    pipX >= document.documentElement.clientWidth - margin - 5;
  const isHidden = isHiddenLeft || isHiddenRight;

  const handleReveal = () => {
    if (isHiddenLeft) {
      setFloatingState({ x: margin });
    } else if (isHiddenRight) {
      setFloatingState({
        x: document.documentElement.clientWidth - pipWidth - margin,
      });
    }
  };

  return (
    <div
      className={`${styles.previewSystem} ${styles.modePip} ${isVisible ? styles.pvVisible : ""}`}
    >
      <Rnd
        className={`${styles.rndWrapper} ${isResizing || isDragging ? styles.pipResizing : ""}`}
        position={{ x: pipX, y: pipY }}
        size={{ width: pipWidth, height: pipHeight }}
        enableResizing={true}
        disableDragging={false}
        dragAxis={isHidden ? "y" : "both"}
        minWidth={320}
        minHeight={150}
        resizeHandleStyles={{
          top: { height: 24 },
          right: { width: 24 },
          bottom: { height: 24 },
          left: { width: 24 },
          topRight: { width: 36, height: 36 },
          bottomRight: { width: 36, height: 36 },
          bottomLeft: { width: 36, height: 36 },
          topLeft: { width: 36, height: 36 },
        }}
        dragHandleClassName={styles.pipDragZone}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={() => setIsResizing(true)}
        onResizeStop={(e, dir, ref, delta, pos) => {
          setIsResizing(false);
          setFloatingState({
            width: ref.offsetWidth,
            height: ref.offsetHeight,
            x: pos.x,
            y: pos.y,
          });
        }}
        bounds={isHidden ? undefined : "window"}
        style={{ zIndex: 2000 }}
      >
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {/* Edge Pull Tab */}
          <div
            className={`${styles.pipEdgeTab} ${styles.pipDragZone} ${isHidden ? styles.pipEdgeTabVisible : ""} ${isHiddenLeft ? styles.pipEdgeTabLeft : styles.pipEdgeTabRight}`}
            onClickCapture={(e) => {
              if (isHidden) {
                e.stopPropagation();
                e.preventDefault();
                handleReveal();
              }
            }}
          >
            {isHiddenLeft ? (
              <Icon id="md:chevron-right" className={styles.svgIcon} />
            ) : (
              <Icon id="md:chevron-left" className={styles.svgIcon} />
            )}
          </div>

          {/* Main PiP Content */}
          <div
            className={`${styles.pipContent} ${isHidden ? styles.pipContentHidden : ""}`}
          >
            {children}
          </div>
        </div>
      </Rnd>
    </div>
  );
}
