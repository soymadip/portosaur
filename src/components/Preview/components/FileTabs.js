import React, { useRef, useEffect } from "react";
import styles from "../styles.module.css";

/**
 * Horizontal tab bar for multi-source previews.
 * Automatically scrolls the active tab into view.
 */
export default function FileTabs({ sources, activeIndex, onSelect }) {
  const tabRefs = useRef([]);

  useEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeIndex]);

  if (!sources || sources.length <= 1) return null;

  return (
    <div className={styles.tabs}>
      {sources.map((src, i) => (
        <button
          key={i}
          ref={(el) => (tabRefs.current[i] = el)}
          className={`${styles.tab} ${i === activeIndex ? styles.activeTab : ""}`}
          onClick={() => onSelect(i)}
        >
          {src.label || src.path.split("/").pop()}
        </button>
      ))}
    </div>
  );
}
