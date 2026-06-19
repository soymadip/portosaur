import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.css";

export default function Hint({
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
    throw new Error("Hint: 'msg' prop is required to display hint content.");
  }

  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, originalLeft: 0 });
  const [arrowOffset, setArrowOffset] = useState(0);
  const containerRef = useRef(null);
  const hintRef = useRef(null);

  const hintStyle = {
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
    setCoords({ top, left, originalLeft: left });
    setArrowOffset(0);
    setIsVisible(true);
  }, [position, gap]);

  const hide = useCallback(() => {
    setIsVisible(false);
    if (
      typeof document !== "undefined" &&
      containerRef.current &&
      containerRef.current.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      window.addEventListener("scroll", hide, { passive: true });
      return () => window.removeEventListener("scroll", hide);
    }
  }, [isVisible, hide]);

  useEffect(() => {
    if (
      isVisible &&
      hintRef.current &&
      (position === "top" || position === "bottom")
    ) {
      const rect = hintRef.current.getBoundingClientRect();
      const padding = 12;
      let newLeft = coords.originalLeft;
      const halfWidth = rect.width / 2;

      if (coords.originalLeft - halfWidth < padding) {
        newLeft = halfWidth + padding;
      } else if (
        coords.originalLeft + halfWidth >
        window.innerWidth - padding
      ) {
        newLeft = window.innerWidth - halfWidth - padding;
      }

      if (newLeft !== coords.left) {
        setCoords((prev) => ({ ...prev, left: newLeft }));
        setArrowOffset(newLeft - coords.originalLeft);
      }
    }
  }, [isVisible, coords.originalLeft, coords.left, position]);

  const hint =
    isVisible && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={hintRef}
            className={`${styles.hint} ${styles[position]}`}
            style={{
              ...hintStyle,
              top: coords.top,
              left: coords.left,
              "--arrow-offset": `${arrowOffset}px`,
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
    <div
      ref={containerRef}
      className={`${styles.hintContainer} ${underline ? styles.hasUnderline : ""} ${className} ${isVisible ? styles.isActive : ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={() => (isVisible ? hide() : show())}
      style={{ display: "contents" }}
    >
      {children}
      {hint}
    </div>
  );
}
