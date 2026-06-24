import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import styles from "../styles.module.css";

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
          {i === activeIndex && (
            <motion.div
              layoutId="activePreviewTabIndicator"
              className={styles.activeTabIndicator}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
