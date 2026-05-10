import { useEffect, useState } from 'react';
import { useLocation } from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// AI Generated

/**
 * UpdateTitle component that changes the page title based on the section in view
 * @param {Object} props              - Component props
 * @param {Object} props.sections     - Map of section IDs to their corresponding titles
 * @param {string} props.defaultTitle - Default title to use when no section is prominently visible
 * @param {boolean} props.enabled     - Whether the dynamic title functionality is enabled
 * @returns {null} This component doesn't render anything visible
 */


export default function UpdateTitle({ 
  sections = {}, 
  defaultTitle = null,
  enabled = true 
}) {
  const location = useLocation();
  const { siteConfig } = useDocusaurusContext();
  const [currentTitle, setCurrentTitle] = useState(null);

  // Use the provided default title or fall back to site title
  const effectiveDefaultTitle = defaultTitle || siteConfig.title;

  useEffect(() => {

    // Only run if enabled
    if (!enabled) return;

    // Use provided sections or default to empty object
    const sectionTitles = Object.keys(sections).length > 0 
      ? sections 
      : {};

    const updateTitle = () => {
      // Get all sections we want to track
      const sectionsToTrack = Object.keys(sectionTitles)
        .map(id => document.getElementById(id))
        .filter(Boolean);
      
      if (sectionsToTrack.length === 0) {
        // No sections found, use default title
        setCurrentTitle(effectiveDefaultTitle);
        return;
      }
      
      // Calculate which section is most visible
      const viewportHeight = window.innerHeight;
      let maxVisibleSection = null;
      let maxVisibleArea = 0;
      
      sectionsToTrack.forEach(section => {
        const rect = section.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);
        const visibleArea = Math.max(0, visibleBottom - visibleTop);
        
        if (visibleArea > maxVisibleArea) {
          maxVisibleArea = visibleArea;
          maxVisibleSection = section.id;
        }
      });
      
      // Update title state based on visible section
      if (maxVisibleSection && sectionTitles[maxVisibleSection]) {
        setCurrentTitle(sectionTitles[maxVisibleSection]);
      } else {
        setCurrentTitle(effectiveDefaultTitle);
      }
    };
    
    // Add scroll event listener with throttling
    let isScrolling = false;
    const handleScroll = () => {
      if (!isScrolling) {
        window.requestAnimationFrame(() => {
          updateTitle();
          isScrolling = false;
        });
        isScrolling = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    // Initial call
    updateTitle();
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname, sections, effectiveDefaultTitle, enabled]);

  useEffect(() => {
    if (currentTitle) {
      document.title = currentTitle;
    }
  }, [currentTitle]);

  // Component doesn't render anything visible
  return null;
}