import { useRef, useEffect, useLayoutEffect } from "react";
import styles from "../styles.module.css";

export default function FileTabs({ sources, activeIndex, onSelect }) {
  const tabRefs = useRef([]);
  const indicatorRef = useRef(null);

  // Scroll active tab into view safely without bubbling up to the window
  useEffect(() => {
    const el = tabRefs.current[activeIndex];

    if (el && el.parentElement) {
      const parent = el.parentElement;
      const scrollLeft =
        el.offsetLeft - parent.offsetWidth / 2 + el.offsetWidth / 2;

      parent.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeIndex]);

  // Slide the ink-bar indicator to the active tab using CSS transform.
  // This works in all modes including PiP, since it's relative to the parent
  // and doesn't do any absolute screen-coordinate tracking.
  useLayoutEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    const indicator = indicatorRef.current;
    if (activeTab && indicator) {
      indicator.style.width = `${activeTab.offsetWidth}px`;
      indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
    }
  }, [activeIndex, sources]);

  if (!sources || sources.length <= 1) return null;

  return (
    <div className={styles.tabs}>
      {/* Single shared ink-bar that slides between tabs via CSS transition */}
      <div ref={indicatorRef} className={styles.activeTabIndicator} />

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
