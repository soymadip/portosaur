import { useEffect, useRef, useState } from "react";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import TOCItems from "@theme/TOCItems";
import Hint from "../Hint/index.jsx";
import Icon from "../Icon/index.jsx";
import actionStyles from "../PageActions/styles.module.css";
import styles from "./styles.module.css";

const TOC_PANEL_ID = "mobile-doc-toc-panel";

export default function MobileTOC() {
  const { frontMatter, toc } = useDoc();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const scrollActiveItemIntoView = () => {
      const panel = panelRef.current;
      const activeItem = panel?.querySelector(
        ".table-of-contents__link--active",
      );

      if (!panel || !activeItem) {
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const itemOffset = itemRect.top - panelRect.top;
      const preferredOffset = 12;
      const lowerComfortBoundary = panel.clientHeight * 0.4;

      if (
        itemOffset < preferredOffset ||
        itemOffset > lowerComfortBoundary ||
        itemRect.bottom > panelRect.bottom - preferredOffset
      ) {
        panel.scrollTop += itemOffset - preferredOffset;
      }
    };

    let frame = 0;
    const scheduleScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(scrollActiveItemIntoView);
    };

    const observer = new MutationObserver(scheduleScroll);
    if (panelRef.current) {
      observer.observe(panelRef.current, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true,
      });
    }
    scheduleScroll();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen]);

  const closeAfterNavigation = (event) => {
    if (event.target.closest?.("a")) {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <Hint msg="On this page" noUl hideOnClick>
        <button
          ref={buttonRef}
          type="button"
          className={actionStyles.actionBtn}
          aria-label="On this page"
          aria-controls={TOC_PANEL_ID}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <Icon id="lucide:list" className={actionStyles.iconOnly} />
        </button>
      </Hint>

      <div className={styles.popover} hidden={!isOpen}>
        <div
          ref={panelRef}
          id={TOC_PANEL_ID}
          className={styles.panel}
          role="navigation"
          aria-label="On this page"
          onClick={closeAfterNavigation}
        >
          <TOCItems
            toc={toc}
            linkClassName="table-of-contents__link toc-highlight"
            linkActiveClassName="table-of-contents__link--active"
            minHeadingLevel={frontMatter.toc_min_heading_level}
            maxHeadingLevel={frontMatter.toc_max_heading_level}
          />
        </div>
      </div>
    </div>
  );
}
