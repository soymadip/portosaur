import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.css";

export default function Tooltip({
  children,
  msg,
  position = "top",
  color,
  underline = true,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, originalLeft: 0 });
  const [arrowOffset, setArrowOffset] = useState(0);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  const tooltipStyle = color
    ? { "--tooltip-color": color, "--tooltip-text-color": "var(--ifm-font-color-base-inverse)" }
    : {};

  const show = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const gap = 8;

    let top, left;
    switch (position) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        break;
      case "top":
      default:
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        break;
    }

    setCoords({ top, left, originalLeft: left });
    setArrowOffset(0);
    setIsVisible(true);
  }, [position]);

  const hide = useCallback(() => {
    setIsVisible(false);
    if (typeof document !== "undefined" && containerRef.current && document.activeElement === containerRef.current) {
      containerRef.current.blur();
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      window.addEventListener("scroll", hide, { passive: true });
      return () => window.removeEventListener("scroll", hide);
    }
  }, [isVisible, hide]);

  useEffect(() => {
    if (isVisible && tooltipRef.current && (position === "top" || position === "bottom")) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const padding = 12;
      let newLeft = coords.originalLeft;
      const halfWidth = rect.width / 2;

      if (coords.originalLeft - halfWidth < padding) {
        newLeft = halfWidth + padding;
      } else if (coords.originalLeft + halfWidth > window.innerWidth - padding) {
        newLeft = window.innerWidth - halfWidth - padding;
      }

      if (newLeft !== coords.left) {
        setCoords((prev) => ({ ...prev, left: newLeft }));
        setArrowOffset(newLeft - coords.originalLeft);
      }
    }
  }, [isVisible, coords.originalLeft, coords.left, position]);

  const tooltip =
    isVisible && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={tooltipRef}
            className={`${styles.tooltip} ${styles[position]}`}
            style={{ 
              ...tooltipStyle, 
              top: coords.top, 
              left: coords.left,
              "--arrow-offset": `${arrowOffset}px`
            }}
            role="tooltip"
          >
            {msg}
            <span className={styles.arrow} />
          </span>,
          document.body,
        )
      : null;

  return (
    <span
      ref={containerRef}
      className={`${styles.tooltipContainer} ${underline ? styles.hasUnderline : ""} ${isVisible ? styles.isActive : ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => (isVisible ? hide() : show())}
    >
      {React.Children.map(children, (child) =>
        typeof child === "string" ? child.trim() : child,
      )}
      {tooltip}
    </span>
  );
}
