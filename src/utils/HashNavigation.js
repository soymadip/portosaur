import { useEffect, useRef } from 'react';

// AI Generated (partially)

/**
 * <HashNavigation/> Component to handle hash-based navigation with visual effects
 * Should be added at the bottom of the page
 * 
 * @param {Object} props Component props
 * @param {string} props.elementPrefix Prefix for element IDs (default: 'card-')
 * @param {string} props.elementSelector Selector for all elements in the group (default: '.content-card')
 * @param {string} props.containerSelector Selector for the container element (default: '.container')
 * @param {number} props.effectDuration Duration of the visual effect in ms (default: 6000)
 * @param {number} props.scrollDelay Delay before scrolling in ms (default: 300)
 * @param {Object} props.scrollOptions Options for scrollIntoView (default: { behavior: 'smooth', block: 'center' })
 * @param {boolean} props.enabled Whether the component is enabled (default: true)
 * @param {Object} props.styles Custom styling options
 * @param {string} props.styles.overlayColor Background color for the overlay (default: 'rgba(var(--ifm-color-emphasis-200-rgb), 0.5)')
 * @param {string} props.styles.highlightShadow Shadow for highlighted element (default: '0 0 30px 10px var(--ifm-color-primary)')
 * @param {string} props.styles.highlightScale Scale for highlighted element (default: '1.05')
 * @param {string} props.styles.blurAmount Blur amount for non-highlighted elements (default: '4px')
 * @param {string} props.styles.blurOpacity Opacity for blurred elements (default: '0.3')
 */
export default function HashNavigation({ 
  elementPrefix = 'card-',
  elementSelector = '.content-card',
  containerSelector = '.container',
  effectDuration = 6000,
  scrollDelay = 300,
  scrollOptions = { behavior: 'smooth', block: 'center' },
  enabled = true,
  styles = {}
}) {
  const styleId = 'hash-navigation-styles';
  const highlightClass = 'hash-nav-highlight';
  const blurClass = 'hash-nav-blur';
  const containerActiveClass = 'hash-nav-active';
  
  // Default styles
  const {
    overlayColor = 'rgba(var(--ifm-color-emphasis-200-rgb), 0.5)',
    highlightShadow = '0 0 30px 10px var(--ifm-color-primary)',
    highlightScale = '1.05',
    blurAmount = '4px',
    blurOpacity = '0.3'
  } = styles;
  
  // Reference to track if styles have been injected
  const stylesInjected = useRef(false);
  
  // Inject the component styles
  useEffect(() => {

    // Don't inject styles if already present
    if (document.getElementById(styleId) || stylesInjected.current) {
      return;
    }
    
    const styleElement = document.createElement('style');

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
    
    // Clean up on unmount
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
      stylesInjected.current = false;
    };
  }, [containerSelector, overlayColor, highlightShadow, highlightScale, blurAmount, blurOpacity]);
  

  // Main hash navigation logic
  useEffect(() => {
    if (!enabled) return;

    if (window.location.hash) {
      const hashValue = window.location.hash.substring(1);
      const targetElement = document.getElementById(`${elementPrefix}${hashValue}`);

      if (targetElement) {

        // Wait a moment for the page to fully render
        setTimeout(() => {

          // Scroll to the element
          targetElement.scrollIntoView(scrollOptions);
          
          // Get the container to add the overlay effect
          const container = document.querySelector(containerSelector);
          if (container) {
            container.classList.add(containerActiveClass);
          }

          // Add visual effects
          const allElements = document.querySelectorAll(elementSelector);

          // Add highlight class to the target element
          targetElement.classList.add(highlightClass);

          // Add blur to all other elements
          allElements.forEach(element => {
            if (element !== targetElement) {
              element.classList.add(blurClass);
            }
          });

          // Create clickable overlay for dismissing effects
          const overlay = document.createElement('div');
          overlay.className = 'hash-nav-overlay';

          document.body.appendChild(overlay);

          let effectTimeoutId = null;

          // remove effects
          const removeEffects = () => {

            if (effectTimeoutId) {
              clearTimeout(effectTimeoutId);
              effectTimeoutId = null;
            }

            // Remove effects
            allElements.forEach(element => {
              element.classList.remove(blurClass);
            });

            targetElement.classList.remove(highlightClass);
            
            // Remove the container overlay
            if (container) {
              container.classList.remove(containerActiveClass);
            }
            
            // Remove clickable overlay
            if (overlay && overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }

            // Remove event listeners after effects are cleared
            overlay.removeEventListener('click', removeEffects);
            overlay.removeEventListener('touchstart', removeEffects);
            document.removeEventListener('keydown', handleKeyDown);
          };
          
          // Add keyboard escape handler
          const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
              removeEffects();
            }
          };

          // Add event listeners to dismiss effects
          overlay.addEventListener('click', removeEffects);
          overlay.addEventListener('touchstart', removeEffects);
          document.addEventListener('keydown', handleKeyDown);

          // Set timeout to automatically remove effects after duration
          effectTimeoutId = setTimeout(removeEffects, effectDuration);

        }, scrollDelay);
      }
    }

    // Cleanup
    return () => {
      const container = document.querySelector(containerSelector);
      const overlay = document.querySelector('.hash-nav-overlay');

      if (container) {
        container.classList.remove(containerActiveClass);
      }

      // Remove any overlay element that might exist
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
  }, [enabled, elementPrefix, elementSelector, containerSelector, effectDuration, scrollDelay, scrollOptions]);

  return null;
}
