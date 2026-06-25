import React from "react";
import { Rnd } from "react-rnd";
import IconChevronLeft from "../../../../../../assets/img/svg/icon-chevron-left.svg";
import IconChevronRight from "../../../../../../assets/img/svg/icon-chevron-right.svg";
import styles from "../../../styles.module.css";

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
  const handleDragStop = (e, d) => {
    let finalX = d.x;
    let finalY = d.y;

    if (isMobile) {
      const margin = 16;
      const windowWidth = document.documentElement.clientWidth;
      const windowHeight = document.documentElement.clientHeight;

      const centerX = d.x + pipWidth / 2;
      const centerY = d.y + pipHeight / 2;

      const isLeft = centerX < windowWidth / 2;
      const isTop = centerY < windowHeight / 2;

      finalX = isLeft ? margin : windowWidth - pipWidth - margin;
      finalY = isTop ? margin : windowHeight - pipHeight - margin;
    }

    setFloatingState({ x: finalX, y: finalY });
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

  const handleHidePip = () => {
    const windowWidth = document.documentElement.clientWidth;
    const centerX = pipX + pipWidth / 2;
    if (centerX < windowWidth / 2) {
      setFloatingState({ x: -pipWidth + margin });
    } else {
      setFloatingState({ x: windowWidth - margin });
    }
  };

  return (
    <div
      className={`${styles.previewSystem} ${styles.modePip} ${isVisible ? styles.pvVisible : ""}`}
    >
      <Rnd
        className={styles.rndWrapper}
        position={{ x: pipX, y: pipY }}
        size={{ width: pipWidth, height: pipHeight }}
        enableResizing={!isMobile} // Disable resizing on phones for PiP
        disableDragging={false}
        dragHandleClassName={styles.pipDragZone}
        onDragStop={handleDragStop}
        onResizeStop={(e, dir, ref, delta, pos) => {
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
            className={`${styles.pipEdgeTab} ${isHidden ? styles.pipEdgeTabVisible : ""} ${isHiddenLeft ? styles.pipEdgeTabLeft : styles.pipEdgeTabRight}`}
            onClickCapture={(e) => {
              if (isHidden) {
                e.stopPropagation();
                e.preventDefault();
                handleReveal();
              }
            }}
          >
            {isHiddenLeft ? (
              <IconChevronRight className={styles.svgIcon} />
            ) : (
              <IconChevronLeft className={styles.svgIcon} />
            )}
          </div>

          {/* Main PiP Content */}
          <div
            className={`${styles.pipContent} ${isHidden ? styles.pipContentHidden : ""}`}
          >
            {React.cloneElement(children, {
              isPipMode: true,
              handleHidePip,
            })}
          </div>
        </div>
      </Rnd>
    </div>
  );
}
