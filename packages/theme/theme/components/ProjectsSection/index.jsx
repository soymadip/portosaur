import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Slider from "react-slick";
import {
  FaCode,
  FaGlobe,
  FaPlay,
  FaChevronLeft,
  FaChevronRight,
  FaStar,
} from "react-icons/fa";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useScrollReveal from "../../hooks/useScrollReveal";
import Tooltip from "../Tooltip/index.jsx";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import styles from "./styles.module.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function ProjectsSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const brokenLinks = useBrokenLinks();

  if (id) {
    brokenLinks.collectAnchor(id);
  }

  const projectShelf = siteConfig.customFields?.projects || {};

  if (projectShelf.enable === false) {
    return null;
  }

  const isAutoplayEnabled = projectShelf.autoplay ?? true;
  const displayHeading = projectShelf.heading;
  const displaySubheading = projectShelf.subheading;

  const [projects, setProjects] = useState([]);
  const sliderRef = useRef(null);
  const [atBeginning, setAtBeginning] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [slidesToShow, setSlidesToShow] = useState(3);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const activeDotRef = useRef(null);
  const dotsContainerRef = useRef(null);
  const [sectionRef, isVisible] = useScrollReveal();

  const getVisibleSlidesPerView = useCallback(() => {
    if (typeof window === "undefined") return 3;
    const width = window.innerWidth;
    if (width <= 600) return 1;
    if (width <= 1024) return 2;
    return 3;
  }, []);

  const prepareProjects = useCallback((projectList, slides) => {
    if (!projectList?.length) return { projects: [], totalPages: 0 };
    const processedProjects = projectList.map((project, index) => {
      const processed = {
        ...project,
        desc: project.desc || "N/A",
        icon: project.icon || "img/project-blank.png",
        bg: project.bg || null,
        tags: project.tags || [],
        state: project.state || "completed",
      };
      if (!processed.id) {
        processed.id =
          (processed.title || "project")
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-") + `-${index}`;
      }
      return processed;
    });
    processedProjects.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });
    const totalPages = Math.ceil(processedProjects.length / slides);
    return { projects: processedProjects, totalPages };
  }, []);

  useEffect(() => {
    const configuredProjects = siteConfig.customFields?.projects?.enable
      ? siteConfig.customFields?.projects?.projects || []
      : [];
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
    handleLayout();
    window.addEventListener("resize", handleLayout);
    return () => window.removeEventListener("resize", handleLayout);
  }, [
    siteConfig,
    getVisibleSlidesPerView,
    prepareProjects,
    slidesToShow,
    projects.length,
  ]);

  const goToSlide = useCallback(
    (index) => {
      if (sliderRef.current) {
        sliderRef.current.slickGoTo(index * slidesToShow);
        setCurrentSlide(index);
      }
    },
    [slidesToShow],
  );

  useEffect(() => {
    const scrollTimeout = setTimeout(() => {
      if (activeDotRef.current && dotsContainerRef.current) {
        const container = dotsContainerRef.current;
        const activeDot = activeDotRef.current;
        try {
          const adaptiveThreshold = Math.max(1, Math.floor(totalPages * 0.1));
          if (currentSlide <= adaptiveThreshold) {
            container.scrollTo({ left: 0, behavior: "smooth" });
            return;
          }
          if (currentSlide >= totalPages - 2) {
            const scrollMax = container.scrollWidth - container.clientWidth;
            container.scrollTo({ left: scrollMax, behavior: "smooth" });
            return;
          }
          const dotRect = activeDot.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const isOutsideLeft = dotRect.left < containerRect.left + 20;
          const isOutsideRight = dotRect.right > containerRect.right - 20;
          if (isOutsideLeft || isOutsideRight) {
            const dotPosition = activeDot.offsetLeft;
            const dotWidth = activeDot.clientWidth;
            const containerWidth = container.clientWidth;
            const scrollPosition =
              dotPosition - containerWidth / 2 + dotWidth / 2;
            if ("scrollBehavior" in document.documentElement.style) {
              container.scrollTo({
                left: Math.max(0, scrollPosition),
                behavior: "smooth",
              });
            } else {
              container.scrollLeft = Math.max(0, scrollPosition);
            }
          }
        } catch (error) {
          console.warn("Dot scrolling error:", error);
        }
      }
    }, 50);
    return () => clearTimeout(scrollTimeout);
  }, [currentSlide, totalPages]);

  const settings = useMemo(
    () => ({
      dots: false,
      infinite: false,
      speed: 600,
      slidesToShow,
      slidesToScroll: slidesToShow,
      autoplay: isAutoplayEnabled,
      autoplaySpeed: 5000,
      pauseOnHover: true,
      adaptiveHeight: false,
      centerPadding: "0px",
      centerMode: false,
      variableWidth: false,
      swipeToSlide: false,
      focusOnSelect: false,
      arrows: false,
      responsive: [
        {
          breakpoint: 1024,
          settings: {
            slidesToShow: Math.min(projects.length, 2),
            slidesToScroll: 2,
            dots: false,
          },
        },
        {
          breakpoint: 600,
          settings: { slidesToShow: 1, slidesToScroll: 1, dots: false },
        },
      ],
      className: styles.projectsCarousel,
      beforeChange: (_, next) => {
        setAtBeginning(next === 0);
        setCurrentSlide(Math.floor(next / slidesToShow));
        setAtEnd(next + slidesToShow >= projects.length);
      },
    }),
    [projects, slidesToShow],
  );

  const goToNext = useCallback(() => {
    if (!atEnd && sliderRef.current) sliderRef.current.slickNext();
  }, [atEnd]);

  const goToPrev = useCallback(() => {
    if (!atBeginning && sliderRef.current) sliderRef.current.slickPrev();
  }, [atBeginning]);

  const renderProjectLink = useCallback((url, Icon, label, ariaLabel) => {
    if (!url || url === "#" || url === "") return null;
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

  const getProjectStateInfo = useCallback((state) => {
    switch (state?.toLowerCase()) {
      case "active":
        return { label: "Active", className: styles.stateActive };
      case "completed":
        return { label: "Completed", className: styles.stateCompleted };
      case "maintenance":
        return { label: "Maintenance", className: styles.stateMaintenance };
      case "paused":
        return { label: "Paused", className: styles.statePaused };
      case "archived":
        return { label: "Archived", className: styles.stateArchived };
      case "planned":
        return { label: "Planned", className: styles.statePlanned };
      case "n/a":
      default:
        return { label: "N/A", className: styles.stateNA };
    }
  }, []);

  const renderNavigationDots = useCallback(() => {
    if (totalPages <= 1) return null;
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
            className={`${styles.navDot} ${currentSlide === i ? styles.activeDot : ""}`}
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
    <div
      id={id}
      ref={sectionRef}
      className={`${styles.projectsSection} ${isVisible ? "is-visible" : ""} ${className || ""}`}
      role="region"
      aria-label="Projects section"
    >
      <div className={styles.projectsContainer}>
        {/* Heading */}
        <div className={styles.projectsHeader}>
          <h2 className={styles.projectsTitle}>{displayHeading}</h2>
          <p className={styles.projectsSubtitle}>{displaySubheading}</p>
        </div>

        {/* Projects carousel or empty state */}
        {projects.length === 0 ? (
          <div className={styles.noProjects}>
            <p>No projects to display.</p>
          </div>
        ) : (
          <div className={styles.carouselContainer}>
            {/* Desktop prev button */}
            {projects.length > slidesToShow && (
              <button
                className={`${styles.carouselControl} ${styles.prevButton} ${styles.desktopOnly} ${atBeginning ? styles.disabledButton : ""}`}
                onClick={goToPrev}
                aria-label="View previous projects"
                aria-disabled={atBeginning}
                type="button"
                disabled={atBeginning}
              >
                <FaChevronLeft aria-hidden="true" />
              </button>
            )}

            <div
              className={styles.carouselWrapper}
              aria-roledescription="carousel"
              aria-label="Projects carousel"
            >
              <Slider ref={sliderRef} {...settings}>
                {projects.map((project, index) => {
                  const stateInfo = getProjectStateInfo(project.state);
                  const extraCount = project.tags?.length - 3;
                  return (
                    <div
                      key={project.id || project.title + index}
                      className={styles.carouselSlide}
                      data-project-id={project.id}
                      aria-roledescription="slide"
                      aria-label={`Project ${index + 1} of ${projects.length}: ${project.title}`}
                      style={{ "--card-index": index }}
                    >
                      <div
                        className={`${styles.carouselCard} ${project.featured ? styles.featuredCard : ""}`}
                      >
                        {/* State badge */}
                        {project.state && (
                          <div
                            className={styles.projectStateBadge}
                            title={`Project status: ${stateInfo.label}`}
                          >
                            <span
                              className={`${styles.projectStateLabel} ${stateInfo.className}`}
                            >
                              {stateInfo.label}
                            </span>
                          </div>
                        )}

                        {/* Image + tags */}
                        <div
                          className={styles.projectImageContainer}
                          style={{
                            backgroundColor:
                              project.bg ||
                              "rgba(var(--ifm-color-primary-rgb), 0.05)",
                          }}
                        >
                          <img
                            src={project.icon}
                            alt={project.title}
                            className={styles.projectImage}
                            loading="lazy"
                          />
                          {project.tags?.length > 0 &&
                            (() => {
                              return (
                                <div className={styles.projectTags}>
                                  {project.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className={styles.projectTag}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <Tooltip
                                      msg={project.tags.slice(3).join(", ")}
                                      underline={false}
                                      gap={13}
                                    >
                                      <span
                                        className={`${styles.projectTag} ${styles.extraTagBtn}`}
                                      >
                                        +{extraCount}
                                      </span>
                                    </Tooltip>
                                  )}
                                </div>
                              );
                            })()}
                          {project.featured && (
                            <div
                              className={styles.featuredBadge}
                              title="Featured Project"
                              aria-label="Featured project"
                            >
                              <FaStar aria-hidden="true" />
                            </div>
                          )}
                        </div>

                        {/* Title + description */}
                        <div className={styles.projectContent}>
                          <h3 className={styles.projectTitle}>
                            {project.title}
                          </h3>
                          <p className={styles.projectDescription}>
                            {project.desc}
                          </p>
                        </div>

                        {/* Links */}
                        <div className={styles.projectLinks}>
                          {renderProjectLink(
                            project.website,
                            FaGlobe,
                            "Website",
                            `Visit ${project.title} website`,
                          )}
                          {renderProjectLink(
                            project.repo,
                            FaCode,
                            "Source",
                            `Repository with source code`,
                          )}
                          {renderProjectLink(
                            project.demo,
                            FaPlay,
                            "Demo",
                            `Live demo for ${project.title}`,
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Slider>

              {/* Desktop dots */}
              <div className={styles.desktopDotsContainer}>
                {renderNavigationDots()}
              </div>

              {/* Mobile navigation */}
              <div className={styles.mobileNavigationControls}>
                {totalPages > 1 && (
                  <>
                    <button
                      className={`${styles.carouselControl} ${styles.prevButton} ${atBeginning ? styles.disabledButton : ""}`}
                      onClick={goToPrev}
                      aria-label="View previous projects"
                      aria-disabled={atBeginning}
                      type="button"
                      disabled={atBeginning}
                    >
                      <FaChevronLeft aria-hidden="true" />
                    </button>
                    <div
                      className={styles.dotsScrollContainer}
                      ref={dotsContainerRef}
                    >
                      {renderNavigationDots()}
                    </div>
                    <button
                      className={`${styles.carouselControl} ${styles.nextButton} ${atEnd ? styles.disabledButton : ""}`}
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

            {/* Desktop next button */}
            {projects.length > slidesToShow && (
              <button
                className={`${styles.carouselControl} ${styles.nextButton} ${styles.desktopOnly} ${atEnd ? styles.disabledButton : ""}`}
                onClick={goToNext}
                aria-label="View next projects"
                aria-disabled={atEnd}
                type="button"
                disabled={atEnd}
              >
                <FaChevronRight />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
