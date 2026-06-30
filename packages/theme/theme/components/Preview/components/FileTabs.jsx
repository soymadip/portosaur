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

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const activeTab = tabRefs.current[activeIndex];
      const indicator = indicatorRef.current;
      if (activeTab && indicator) {
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
      }
    };

    updateIndicator();

    if (typeof window === "undefined" || !window.ResizeObserver) return;

    const observer = new ResizeObserver(updateIndicator);
    const activeTab = tabRefs.current[activeIndex];

    if (activeTab) {
      observer.observe(activeTab);
      const parent = activeTab.parentElement;
      if (parent) {
        observer.observe(parent);
      }
    }

    return () => {
      observer.disconnect();
    };
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
