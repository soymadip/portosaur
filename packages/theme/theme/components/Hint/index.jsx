import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./styles.module.css";

export default function Hint({
  children,
  msg,
  bottom,
  left,
  right,
  color,
  bg,
  noUl,
  gap = 5,
  shadow,
  className = "",
  zIndex,
}) {
  if (!msg) {
    throw new Error("Hint: 'msg' prop is required to display hint content.");
  }

  let position = "top";
  if (bottom) position = "bottom";
  else if (left) position = "left";
  else if (right) position = "right";

  const [isVisible, setIsVisible] = useState(false);
  const [activePosition, setActivePosition] = useState(position);
  const [coords, setCoords] = useState({ top: 0, left: 0, originalLeft: 0 });
  const [arrowOffset, setArrowOffset] = useState(0);
  const containerRef = useRef(null);
  const hintRef = useRef(null);

  const hintStyle = {
    ...(bg && { "--tooltip-color": bg }),
    ...(color && { "--tooltip-text-color": color }),
    ...(!color && bg && { "--tooltip-text-color": "#fff" }),
    ...(shadow && { "--tooltip-shadow": shadow }),
    ...(zIndex !== undefined && { zIndex }),
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
    setActivePosition(position);
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
      !isVisible ||
      !hintRef.current ||
      !containerRef.current ||
      !containerRef.current.children[0]
    ) {
      return;
    }

    const tooltipWidth = hintRef.current.offsetWidth;
    const tooltipHeight = hintRef.current.offsetHeight;
    const triggerRect =
      containerRef.current.children[0].getBoundingClientRect();

    const padding = 10;
    const tooltipGap = gap;

    let newPosition = activePosition;

    // Auto-flip horizontal placements if they overflow the viewport sides
    //   For "left", the tooltip's right edge is at triggerRect.left - tooltipGap
    //   So its left edge will be at triggerRect.left - tooltipGap - tooltipWidth
    if (
      activePosition === "left" &&
      triggerRect.left - tooltipGap - tooltipWidth < padding
    ) {
      newPosition = "top";
    } else if (
      activePosition === "right" &&
      triggerRect.right + tooltipGap + tooltipWidth >
        window.innerWidth - padding
    ) {
      newPosition = "top";
    }

    // Auto-flip vertical placements if they overflow viewport top/bottom
    //   For "top", the tooltip's bottom edge is at triggerRect.top - tooltipGap
    //   So its top edge is at triggerRect.top - tooltipGap - tooltipHeight
    if (
      newPosition === "top" &&
      triggerRect.top - tooltipGap - tooltipHeight < padding
    ) {
      newPosition = "bottom";
    } else if (
      newPosition === "bottom" &&
      triggerRect.bottom + tooltipGap + tooltipHeight >
        window.innerHeight - padding
    ) {
      newPosition = "top";
    }

    // If position flipped, update and recalculate coordinates
    if (newPosition !== activePosition) {
      let top, left;

      switch (newPosition) {
        case "bottom":
          top = triggerRect.bottom + tooltipGap;
          left = triggerRect.left + triggerRect.width / 2;
          break;
        case "left":
          top = triggerRect.top + triggerRect.height / 2;
          left = triggerRect.left - tooltipGap;
          break;
        case "right":
          top = triggerRect.top + triggerRect.height / 2;
          left = triggerRect.right + tooltipGap;
          break;
        case "top":
        default:
          top = triggerRect.top - tooltipGap;
          left = triggerRect.left + triggerRect.width / 2;
          break;
      }

      setActivePosition(newPosition);
      setCoords({ top, left, originalLeft: left });
      setArrowOffset(0);
      return;
    }

    // 3. For top/bottom positions, shift horizontally to remain within the screen
    if (activePosition === "top" || activePosition === "bottom") {
      let newLeft = coords.originalLeft;
      const halfWidth = tooltipWidth / 2;

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
  }, [isVisible, coords.originalLeft, coords.left, activePosition, gap]);

  const hint =
    isVisible && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={hintRef}
            className={`${styles.hint} ${styles[activePosition]}`}
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
      className={`${styles.hintContainer} ${!noUl ? styles.hasUnderline : ""} ${className} ${isVisible ? styles.isActive : ""}`}
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
