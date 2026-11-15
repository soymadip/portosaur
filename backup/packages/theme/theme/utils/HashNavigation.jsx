import { useEffect, useRef } from "react";
export default function HashNavigation({
  elementPrefix = "card-",
  elementSelector = ".content-card",
  containerSelector = ".container",
  effectDuration = 6000,
  scrollDelay = 300,
  scrollOptions = { behavior: "smooth", block: "center" },
  enabled = true,
  styles = {},
}) {
  const styleId = "hash-navigation-styles";
  const highlightClass = "hash-nav-highlight";
  const blurClass = "hash-nav-blur";
  const containerActiveClass = "hash-nav-active";
  const {
    overlayColor = "rgba(var(--ifm-color-emphasis-200-rgb), 0.5)",
    highlightShadow = "0 0 30px 10px var(--ifm-color-primary)",
    highlightScale = "1.05",
    blurAmount = "4px",
    blurOpacity = "0.3",
  } = styles;
  const stylesInjected = useRef(false);
  useEffect(() => {
    if (document.getElementById(styleId) || stylesInjected.current) {
      return;
    }
    const styleElement = document.createElement("style");
    styleElement.id = styleId;
    styleElement.innerHTML = `
      
      ${containerSelector}.${containerActiveClass} {
        position: relative;
      }
      
      ${containerSelector}.${containerActiveClass}::after {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: ${overlayColor};
        z-index: 10;
        pointer-events: none;
      }
      
      .${highlightClass} {
        position: relative;
        z-index: 20;
        transform: scale(${highlightScale});
        box-shadow: ${highlightShadow};
        transition: all 0.3s ease;
      }
      
      .${blurClass} {
        filter: blur(${blurAmount}) grayscale(70%) brightness(0.8);
        opacity: ${blurOpacity};
        transition: all 0.3s ease;
        background-color: rgba(var(--ifm-color-emphasis-200-rgb), 0.15);
        pointer-events: none; 
      }
      
      /* Clickable overlay for dismissing effects */
      .hash-nav-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 15; 
        cursor: pointer;
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .${highlightClass}, 
        .${blurClass} {
          transition: none !important;
        }
        
        .${highlightClass} {
          transform: none !important;
        }
        
        .${blurClass} {
          filter: opacity(${blurOpacity});
          background-color: rgba(var(--ifm-color-emphasis-200-rgb), 0.15);
        }
      }
    `;
    document.head.appendChild(styleElement);
    stylesInjected.current = true;
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
      stylesInjected.current = false;
    };
  }, [
    containerSelector,
    overlayColor,
    highlightShadow,
    highlightScale,
    blurAmount,
    blurOpacity,
  ]);
  useEffect(() => {
    if (!enabled) return;
    if (window.location.hash) {
      const hashValue = window.location.hash.substring(1);
      const targetElement = document.getElementById(
        `${elementPrefix}${hashValue}`,
      );
      if (targetElement) {
        setTimeout(() => {
          targetElement.scrollIntoView(scrollOptions);
          const container = document.querySelector(containerSelector);
          if (container) {
            container.classList.add(containerActiveClass);
          }
          const allElements = document.querySelectorAll(elementSelector);
          targetElement.classList.add(highlightClass);
          allElements.forEach((element) => {
            if (element !== targetElement) {
              element.classList.add(blurClass);
            }
          });
          const overlay = document.createElement("div");
          overlay.className = "hash-nav-overlay";
          document.body.appendChild(overlay);
          let effectTimeoutId = null;
          const removeEffects = () => {
            if (effectTimeoutId) {
              clearTimeout(effectTimeoutId);
              effectTimeoutId = null;
            }
            allElements.forEach((element) => {
              element.classList.remove(blurClass);
            });
            targetElement.classList.remove(highlightClass);
            if (container) {
              container.classList.remove(containerActiveClass);
            }
            if (overlay && overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
            overlay.removeEventListener("click", removeEffects);
            overlay.removeEventListener("touchstart", removeEffects);
            document.removeEventListener("keydown", handleKeyDown);
          };
          const handleKeyDown = (e) => {
            if (e.key === "Escape") {
              removeEffects();
            }
          };
          overlay.addEventListener("click", removeEffects);
          overlay.addEventListener("touchstart", removeEffects);
          document.addEventListener("keydown", handleKeyDown);
          effectTimeoutId = setTimeout(removeEffects, effectDuration);
        }, scrollDelay);
      }
    }
    return () => {
      const container = document.querySelector(containerSelector);
      const overlay = document.querySelector(".hash-nav-overlay");
      if (container) {
        container.classList.remove(containerActiveClass);
      }
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
  }, [
    enabled,
    elementPrefix,
    elementSelector,
    containerSelector,
    effectDuration,
    scrollDelay,
    scrollOptions,
  ]);
  return null;
}
