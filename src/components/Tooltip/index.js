import React, { useState, useRef, useCallback } from "react";
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

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

    setCoords({ top, left });
    setIsVisible(true);
  }, [position]);

  const hide = useCallback(() => setIsVisible(false), []);

  const tooltip =
    isVisible && typeof document !== "undefined"
      ? createPortal(
          <span
            className={`${styles.tooltip} ${styles[position]}`}
            style={{ ...tooltipStyle, top: coords.top, left: coords.left }}
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
      className={`${styles.tooltipContainer} ${underline ? styles.hasUnderline : ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.Children.map(children, (child) =>
        typeof child === "string" ? child.trim() : child,
      )}
      {tooltip}
    </span>
  );
}
