import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.css";

export default function Tooltip({
  children,
  msg,
  position = "top",
  color,
  bg,
  underline = true,
  gap = 5,
  shadow,
  className = "",
}) {
  if (!msg) {
    throw new Error(
      "Tooltip: 'msg' prop is required to display tooltip content.",
    );
  }

  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  const tooltipStyle = {
    ...(bg && { "--tooltip-color": bg }),
    ...(color && { "--tooltip-text-color": color }),
    ...(!color &&
      bg && { "--tooltip-text-color": "var(--ifm-font-color-base-inverse)" }),
    ...(shadow && { "--tooltip-shadow": shadow }),
  };

  const show = useCallback(() => {
    if (!containerRef.current || !containerRef.current.children[0]) return;
    const rect = containerRef.current.children[0].getBoundingClientRect();
    const tooltipGap = gap;
    let top, left;
    switch (position) {
      case "bottom":
        top = rect.bottom + tooltipGap;
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipGap;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + tooltipGap;
        break;
      case "top":
      default:
        top = rect.top - tooltipGap;
        left = rect.left + rect.width / 2;
        break;
    }
    setCoords({ top, left });
    setIsVisible(true);
  }, [position, gap]);

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
    <div
      ref={containerRef}
      className={`${styles.tooltipContainer} ${underline ? styles.hasUnderline : ""} ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: "contents" }}
    >
      {children}
      {tooltip}
    </div>
  );
}
