import { useEffect, useRef } from "react";
import TOCOriginal from "@theme-init/TOC";

// Fix bug where the active link in the TOC is not visible when scrolling through the page
export default function TOCWrapper(props) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Docusaurus toggles the active class directly on the DOM using an IntersectionObserver
    // So we use a MutationObserver to detect when a link gets the active class
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const target = mutation.target;
          // Check if this element just became the active link
          if (target.classList.contains("table-of-contents__link--active")) {
            // Scroll the TOC container so the active link is visible
            // block: 'nearest' ensures minimal scrolling (only scrolls if outside viewport)
            target.scrollIntoView({
              block: "nearest",
              behavior: "smooth",
            });
          }
        }
      }
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="custom-toc-wrapper"
      style={{ height: "100%" }}
    >
      <TOCOriginal {...props} />
    </div>
  );
}
