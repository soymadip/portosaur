import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Slider from "react-slick";
import { FaGithub, FaGlobe, FaPlay, FaChevronLeft, FaChevronRight, FaStar } from 'react-icons/fa';
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from './styles.module.css';

// Import slick carousel css
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

/// PART OF THIS COMPONENT IS AI GENERATED

export default function ProjectsSection({ id, className, title, subtitle }) {
  const { siteConfig } = useDocusaurusContext();

  const [projects, setProjects] = useState([]);
  const sliderRef = useRef(null);
  const [atBeginning, setAtBeginning] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [slidesToShow, setSlidesToShow] = useState(3);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const activeDotRef = useRef(null);
  const dotsContainerRef = useRef(null);

  // Default Settings 
  const projectDefaults = {
    title: "Future Project",
    desc:  "Coming soon...",
    image: "img/project-blank.png",
    state: "active",
    tags:  ["planned"]
  };


  const createPlaceholders = useCallback((count, existingProjects) => {
    if (existingProjects.length === 0) return [];
    
    return [
      ...existingProjects,
      ...Array.from({ length: count }, (_, i) => ({
        ...projectDefaults,

        // Dummy card config
        state: "n/a",
        title: `Project ${existingProjects.length + i + 1}`,
        description: projectDefaults.desc,
        image: projectDefaults.image,
        id: `placeholder-${i}`,
        tags: null 
      }))
    ];
  }, [projectDefaults]);

  // Get current slidesToShow based on screen width
  const getVisibleSlidesPerView = useCallback(() => {
    if (typeof window === 'undefined') return 3;
    
    const width = window.innerWidth;
    if (width <= 600) return 1;
    if (width <= 1024) return 2;
    return 3;
  }, []);
  
  const prepareProjects = useCallback((projectList, slides) => {
    if (!projectList?.length) return { projects: [], totalPages: 0 };
    
    // Sort featured first
    const sortedProjects = [...projectList].sort((a, b) => 
      (a.featured ? -1 : 0) - (b.featured ? -1 : 0)
    ).map(project => {
      
      // Apply defaults if value not null 
      const processedProject = {
        ...project,
        description: project.desc === undefined ? projectDefaults.desc : project.desc,
        image: project.image === undefined ? projectDefaults.image : project.image,
        tags: project.tags === undefined ? [...projectDefaults.tags] : project.tags,
        state: project.state === undefined ? projectDefaults.state : project.state
      };
      
      // Add ID
      if (!processedProject.id) {
        processedProject.id = processedProject.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      }
      
      return processedProject;
    });

    // Calculate pagination and placeholder needs
    const totalPages = Math.ceil(sortedProjects.length / slides);
    const slotsPerPage = slides;
    const totalSlots = totalPages * slotsPerPage;
    const placeholderCount = totalSlots - sortedProjects.length;

    // Return prepared data
    return {
      projects: placeholderCount > 0 
        ? createPlaceholders(placeholderCount, sortedProjects) 
        : sortedProjects,
      totalPages
    };
  }, [createPlaceholders, projectDefaults]);

  // Load and set up projects on initial load and on resize
  useEffect(() => {
    const projectShelf = siteConfig.customFields?.projects;
    const configuredProjects = projectShelf?.enable ? projectShelf?.projects || [] : [];
    
    const handleLayout = () => {
      const newSlidesToShow = getVisibleSlidesPerView();
      
      if (newSlidesToShow !== slidesToShow || !projects.length) {
        setSlidesToShow(newSlidesToShow);
        const { projects: newProjects, totalPages: newTotalPages } = 
          prepareProjects(configuredProjects, newSlidesToShow);
        
        setProjects(newProjects);
        setTotalPages(newTotalPages);
        setAtEnd(newProjects.length <= newSlidesToShow);
      }
    };

    // Initial setup
    handleLayout();
    
    // Resize handler
    window.addEventListener('resize', handleLayout);
    return () => window.removeEventListener('resize', handleLayout);
  }, [siteConfig, getVisibleSlidesPerView, prepareProjects, slidesToShow, projects.length]);

  // Method to go to a specific slide
  const goToSlide = useCallback((index) => {
    if (sliderRef.current) {

      sliderRef.current.slickGoTo(index * slidesToShow);
      setCurrentSlide(index);

    }
  }, [slidesToShow]);

  useEffect(() => {
    const scrollTimeout = setTimeout(() => {

      if (activeDotRef.current && dotsContainerRef.current) {
        const container = dotsContainerRef.current;
        const activeDot = activeDotRef.current;
        
        try {

          // For first few
          const adaptiveThreshold = Math.max(1, Math.floor(totalPages * 0.1));
          if (currentSlide <= adaptiveThreshold) {
            container.scrollTo({
              left: 0,
              behavior: 'smooth'
            });
            return;
          }
          
          // For last few
          if (currentSlide >= totalPages - 2) {
            const scrollMax = container.scrollWidth - container.clientWidth;
            container.scrollTo({
              left: scrollMax,
              behavior: 'smooth'
            });
            return;
          }
          
          // Center the active dot at mobile
          const dotRect = activeDot.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Check if dot is within visible area with margins
          const isOutsideLeft = dotRect.left < containerRect.left + 20;
          const isOutsideRight = dotRect.right > containerRect.right - 20;
          
          if (isOutsideLeft || isOutsideRight) {
            const dotPosition = activeDot.offsetLeft;
            const dotWidth = activeDot.clientWidth;
            const containerWidth = container.clientWidth;
            const scrollPosition = dotPosition - (containerWidth / 2) + (dotWidth / 2);
            
            // Disable smooth scroll if not supported
            if ('scrollBehavior' in document.documentElement.style) {
              container.scrollTo({
                left: Math.max(0, scrollPosition),
                behavior: 'smooth'
              });
            } else {
              container.scrollLeft = Math.max(0, scrollPosition);
            }
          }
        } catch (error) {
          console.warn('Dot scrolling error:', error);
        }
      }
    }, 50);
    
    return () => clearTimeout(scrollTimeout);
  }, [currentSlide, totalPages]);

  // Carousel settings
  const settings = useMemo(() => ({
    dots: false,
    infinite: false,
    speed: 600,
    slidesToShow: Math.min(projects.length, slidesToShow),
    slidesToScroll: slidesToShow,
    autoplay: false,
    adaptiveHeight: false,
    centerPadding: '20px',
    centerMode: false,
    variableWidth: false,
    swipeToSlide: false,
    focusOnSelect: false,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: Math.min(projects.length, 2),
          slidesToScroll: 2,
          dots: false,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          dots: false,
          arrows: false,
        }
      }
    ],
    className: styles.projectsCarousel,
    beforeChange: (current, next) => {
      setAtBeginning(next === 0);
      setCurrentSlide(Math.floor(next / slidesToShow));
      setAtEnd(next + Math.min(projects.length, slidesToShow) >= projects.length);
    },
  }), [projects, slidesToShow]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (!atEnd && sliderRef.current) {
      sliderRef.current.slickNext();
    }
  }, [atEnd]);

  const goToPrev = useCallback(() => {
    if (!atBeginning && sliderRef.current) {
      sliderRef.current.slickPrev();
    }
  }, [atBeginning]);

  // Project link renderer
  const renderProjectLink = useCallback((url, Icon, label, ariaLabel) => {
    if (!url) return null;

    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className={styles.projectLink}
        aria-label={ariaLabel}
      >
        <Icon />
        <span>{label}</span>
      </a>
    );
  }, []);

  // Get state label and class
  const getProjectStateInfo = useCallback((state) => {
    switch(state?.toLowerCase()) {
      // For projects currently in active development
      case 'active':
        return { 
          label: 'Active', 
          className: styles.stateActive,
        };
      // For finished projects
      case 'completed':
        return { 
          label: 'Completed', 
          className: styles.stateCompleted,
        };
      // For projects receiving updates/maintenance
      case 'maintenance':
        return { 
          label: 'Maintenance', 
          className: styles.stateMaintenance,
        };
      // For temporarily paused development
      case 'paused':
        return { 
          label: 'Paused', 
          className: styles.statePaused,
        };
      // For projects no longer maintained
      case 'archived':
        return { 
          label: 'Archived', 
          className: styles.stateArchived,
        };
      // For future projects in planning stage
      case 'planned':
        return { 
          label: 'Planned', 
          className: styles.statePlanned,
        };
      // Default state when not specified
      case 'n/a':
      default:
        return { 
          label: 'N/A', 
          className: styles.stateNA,
        };
    }
  }, []);

  // Render navigation dots with proper CSS classes based on count
  const renderNavigationDots = useCallback(() => {
    if (totalPages <= 1) return null;

    // Determine if we should use scrollable or centered layout
    const fewDots = totalPages <= 5;
    
    return (
      <div 
        className={`${styles.navDotsContainer} ${fewDots ? styles.centerDots : styles.scrollDots}`}
        role="tablist"
        aria-label="Project carousel navigation"
      >
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            className={`${styles.navDot} ${currentSlide === i ? styles.activeDot : ''}`}
            onClick={() => goToSlide(i)}
            aria-label={`Go to slide ${i + 1} of ${totalPages}`}
            aria-selected={currentSlide === i}
            role="tab"
            type="button"
            ref={currentSlide === i ? activeDotRef : null}
          />
        ))}
      </div>
    );
  }, [currentSlide, totalPages, goToSlide]);

  return (
    <div id={id} className={`${styles.projectsSection} ${className || ''}`} role="region" aria-label="Projects section">
      <div className={styles.projectsContainer}>
        <div className={styles.projectsHeader}>
          <h2 className={styles.projectsTitle}>
            {title || "My Projects"}
          </h2>
          <p className={styles.projectsSubtitle}>
            {subtitle || "A collection of all my works, with featured projects highlighted"}
          </p>
        </div>
        
        {projects.length === 0 ? (
          <div className={styles.noProjects}>
            <p>No projects to display.</p>
          </div>
        ) : (
          <div className={styles.carouselContainer}>
            {/* Desktop navigation buttons (sides) */}
            <button 
              className={`${styles.carouselControl} ${styles.prevButton} ${styles.desktopOnly} ${atBeginning ? styles.disabledButton : ''}`} 
              onClick={goToPrev}
              aria-label="View previous projects"
              aria-disabled={atBeginning}
              type="button"
              disabled={atBeginning}
            >
              <FaChevronLeft aria-hidden="true" />
            </button>
            
            <div className={styles.carouselWrapper} aria-roledescription="carousel" aria-label="Projects carousel">
              <Slider ref={sliderRef} {...settings}>
                {projects.map((project, index) => (
                  <div 
                    key={project.id || project.title + index} 
                    className={styles.carouselSlide} 
                    data-project-id={project.id}
                    aria-roledescription="slide" 
                    aria-label={`Project ${index + 1} of ${projects.length}: ${project.title}`}
                  >
                    <div className={`${styles.carouselCard} ${project.featured ? styles.featuredCard : ''}`}>
                      {/* Project state badge */}
                      {project.state && (
                        <div 
                          className={styles.projectStateBadge}
                          title={`Project status: ${getProjectStateInfo(project.state).label}`}
                        >
                          <span className={`${styles.projectStateLabel} ${getProjectStateInfo(project.state).className}`}>
                            {getProjectStateInfo(project.state).label}
                          </span>
                        </div>
                      )}

                      <div className={styles.projectImageContainer}>
                        {project.image && (
                          <img 
                            src={project.image} 
                            alt={project.title} 
                            className={styles.projectImage} 
                            loading="lazy"
                          />
                        )}
                        
                        {/* Featured badge */}
                        {project.featured && (
                          <div className={styles.featuredBadge} title="Featured Project" aria-label="Featured project">
                            <FaStar aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.projectContent}>
                        <h3 className={styles.projectTitle}>{project.title}</h3>
                        
                        {project.tags?.length > 0 && (
                          <div className={styles.projectTags}>
                            {project.tags.map(tag => (
                              <span key={tag} className={styles.projectTag}>{tag}</span>
                            ))}
                          </div>
                        )}
                        
                        <p className={styles.projectDescription}>{project.description}</p>
                      </div>
                      
                      <div className={styles.projectLinks}>
                        {renderProjectLink(
                          project.website, 
                          FaGlobe, 
                          "Website", 
                          `Visit ${project.title} website`
                        )}
                        
                        {renderProjectLink(
                          project.github, 
                          FaGithub, 
                          "Source", 
                          `Repository with source code`
                        )}
                        
                        {renderProjectLink(
                          project.Demo, 
                          FaPlay, 
                          "Demo", 
                          `Live demo for ${project.title}`
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </Slider>
              
              {/* Desktop navigation dots */}
              <div className={styles.desktopDotsContainer}>
                {renderNavigationDots()}
              </div>
              
              {/* Mobile navigation controls (bottom) */}
              <div className={styles.mobileNavigationControls}>
                {totalPages > 1 && (
                  <>
                    <button 
                      className={`${styles.carouselControl} ${styles.prevButton} ${atBeginning ? styles.disabledButton : ''}`} 
                      onClick={goToPrev}
                      aria-label="View previous projects"
                      aria-disabled={atBeginning}
                      type="button"
                      disabled={atBeginning}
                    >
                      <FaChevronLeft aria-hidden="true" />
                    </button>
                    
                    {/* Mobile navigation dots */}
                    <div 
                      className={styles.dotsScrollContainer}
                      ref={dotsContainerRef}
                    >
                      {renderNavigationDots()}
                    </div>
                    
                    <button 
                      className={`${styles.carouselControl} ${styles.nextButton} ${atEnd ? styles.disabledButton : ''}`} 
                      onClick={goToNext}
                      aria-label="View next projects"
                      aria-disabled={atEnd}
                      type="button"
                      disabled={atEnd}
                    >
                      <FaChevronRight aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Desktop navigation button (right side) */}
            <button 
              className={`${styles.carouselControl} ${styles.nextButton} ${styles.desktopOnly} ${atEnd ? styles.disabledButton : ''}`} 
              onClick={goToNext}
              aria-label="View next projects"
              aria-disabled={atEnd}
              type="button"
              disabled={atEnd}
            >
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
