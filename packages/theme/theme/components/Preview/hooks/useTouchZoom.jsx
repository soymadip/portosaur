import { useEffect } from "react";
import styles from "../styles.module.css";
export function useTouchZoom({
  containerRef,
  isOpen,
  zoomLevel,
  setZoomLevel,
}) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isOpen) return;

    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let initialScrollLeft = 0;
    let initialScrollTop = 0;

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      if (el.classList.contains(styles.isText)) return;
      isPanning = true;
      startX = e.pageX;
      startY = e.pageY;
      initialScrollLeft = el.scrollLeft;
      initialScrollTop = el.scrollTop;
      el.classList.add(styles.isPanning);
      document.body.classList.add(styles.isPanning);
    };

    const handleMouseMove = (e) => {
      if (!isPanning) return;
      e.preventDefault();
      const x = e.pageX;
      const y = e.pageY;
      const walkX = (x - startX) * 1;
      const walkY = (y - startY) * 1;
      el.scrollLeft = initialScrollLeft - walkX;
      el.scrollTop = initialScrollTop - walkY;
    };

    const handleMouseUpOrLeave = () => {
      isPanning = false;
      el.classList.remove(styles.isPanning);
      document.body.classList.remove(styles.isPanning);
    };

    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseup", handleMouseUpOrLeave);
    el.addEventListener("mouseleave", handleMouseUpOrLeave);

    return () => {
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseup", handleMouseUpOrLeave);
      el.removeEventListener("mouseleave", handleMouseUpOrLeave);
    };
  }, [isOpen, containerRef, zoomLevel]);
}
