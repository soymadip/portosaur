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
    let initialDistance = null;
    let initialZoom = zoomLevel;
    const getDistance = (touches) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );
    };
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.01;
        setZoomLevel((prev) => Math.min(Math.max(0.5, prev + delta), 3));
      }
    };
    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        setZoomLevel((prev) => {
          initialZoom = prev;
          return prev;
        });
      }
    };
    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && initialDistance) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const ratio = currentDistance / initialDistance;
        setZoomLevel(Math.min(Math.max(0.5, initialZoom * ratio), 3));
      }
    };
    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        initialDistance = null;
      }
    };
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
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseup", handleMouseUpOrLeave);
    el.addEventListener("mouseleave", handleMouseUpOrLeave);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseup", handleMouseUpOrLeave);
      el.removeEventListener("mouseleave", handleMouseUpOrLeave);
    };
  }, [isOpen, setZoomLevel, containerRef, zoomLevel]);
}
