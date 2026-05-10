import { useState, useEffect, useRef } from 'react';
import { IoIosArrowUp } from 'react-icons/io';
import styles from './styles.module.css';

export default function ScrollToTop({ hideDelay = 1500 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const timeoutRef = useRef(null);
  const lastScrollTopRef = useRef(0);

  const startHideTimer = () => {

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Only start timer if not hovering
    if (!isHovering) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, hideDelay);
    }
  };

  useEffect(() => {

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const isScrollingUp = scrollTop < lastScrollTopRef.current;
      
      // Save the current scroll position
      lastScrollTopRef.current = scrollTop;
      
      // Show button when scrolling up past threshold
      if (isScrollingUp && scrollTop > 300) {

        setIsVisible(true);
        startHideTimer();
      } else {

        setIsVisible(false);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    };

    // Set up event listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hideDelay, isHovering]);

  const handleMouseEnter = () => {

    setIsHovering(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleMouseLeave = () => {

    setIsHovering(false);
    startHideTimer();
  };

  const scrollToTop = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  };

  return (
    <button
      className={`${styles.scrollToTop} ${isVisible ? styles.visible : ''}`}
      onClick={scrollToTop}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <IoIosArrowUp />
    </button>
  );
}
