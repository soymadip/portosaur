import { useRef, useState, useEffect, useCallback } from "react";
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
import Hint from "../Hint/index.jsx";
import styles from "./styles.module.css";

export default function ProjectsSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const [sectionRef, isVisible] = useScrollReveal();

  const { projectShelf } = siteConfig.customFields?.homePage || {};
  if (projectShelf?.enable === false) return null;

  const projects = projectShelf?.projects || [];

  if (projects.length === 0) return null;

  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Determine cards based on screen size
  const [slidesToShow, setSlidesToShow] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;

      if (width <= 600) {
        setSlidesToShow(1);
      } else if (width <= 1024) {
        setSlidesToShow(2);
      } else {
        setSlidesToShow(3);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleScroll = useCallback(() => {
    if (!carouselRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;

    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);

    const slideWidth = clientWidth / slidesToShow;
    const newCurrentSlide = Math.round(scrollLeft / slideWidth);
    setCurrentSlide(newCurrentSlide);
  }, [slidesToShow]);

  useEffect(() => {
    handleScroll();
  }, [slidesToShow, handleScroll, projects.length]);

  const scrollByAmount = (direction) => {
    if (!carouselRef.current) return;

    const newSlide = direction === "next" ? currentSlide + 1 : currentSlide - 1;
    goToSlide(newSlide);
  };

  const goToSlide = (index) => {
    if (!carouselRef.current) return;

    const scrollAmount = carouselRef.current.clientWidth / slidesToShow;
    carouselRef.current.scrollTo({
      left: index * scrollAmount,
      behavior: "smooth",
    });
  };

  const totalPages = Math.ceil(projects.length - slidesToShow + 1);

  return (
    <div
      id={id}
      ref={sectionRef}
      className={`${styles.projectsSection} ${isVisible ? "is-visible" : ""} ${className || ""}`}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {projectShelf?.heading || "Projects"}
          </h2>
          {projectShelf?.subheading && (
            <p className={styles.subtitle}>{projectShelf.subheading}</p>
          )}
        </div>

        <div className={styles.carouselContainer}>
          {projects.length > slidesToShow && (
            <button
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={() => scrollByAmount("prev")}
              disabled={!canScrollLeft}
              aria-label="Previous project"
            >
              <FaChevronLeft />
            </button>
          )}

          <div
            className={styles.carousel}
            ref={carouselRef}
            onScroll={handleScroll}
            style={{ "--slides-to-show": slidesToShow }}
          >
            {projects.map((project, idx) => {
              const tags = project.tags || [];
              const extraTags = tags.length - 3;

              return (
                <div key={idx} className={styles.cardWrapper}>
                  <div className={styles.card}>
                    <div
                      className={styles.iconContainer}
                      style={{
                        backgroundColor: project.bg || "rgba(255,255,255,0.05)",
                      }}
                    >
                      <img
                        src={
                          typeof project.icon === "string"
                            ? project.icon
                            : project.icon?.src
                        }
                        alt={project.title}
                        className={styles.icon}
                        loading="lazy"
                        onError={(e) => {
                          if (
                            project.icon?.fallback &&
                            e.currentTarget.src !== project.icon.fallback
                          ) {
                            e.currentTarget.src = project.icon.fallback;
                          }
                        }}
                      />

                      {project.state && (
                        <div className={styles.stateBadgeWrapper}>
                          <span
                            className={`${styles.stateBadge} ${styles[project.state.toLowerCase()] || ""}`}
                          >
                            {project.state}
                          </span>
                        </div>
                      )}

                      {project.featured && (
                        <div className={styles.featuredBadge} title="Featured">
                          <FaStar />
                        </div>
                      )}

                      {tags.length > 0 && (
                        <div className={styles.tags}>
                          {tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={styles.tag}>
                              {tag}
                            </span>
                          ))}
                          {extraTags > 0 && (
                            <Hint
                              msg={tags.slice(3).join(", ")}
                              underline={false}
                            >
                              <span
                                className={`${styles.tag} ${styles.extraTag}`}
                              >
                                +{extraTags}
                              </span>
                            </Hint>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={styles.content}>
                      <div className={styles.titleRow}>
                        <h3 className={styles.cardTitle}>{project.title}</h3>
                      </div>
                      <p className={styles.desc}>{project.desc}</p>
                    </div>

                    <div className={styles.links}>
                      {project.website && (
                        <a
                          href={project.website}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          <FaGlobe /> Website
                        </a>
                      )}
                      {project.repo && (
                        <a
                          href={project.repo}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          <FaCode /> Source
                        </a>
                      )}
                      {project.demo && (
                        <a
                          href={project.demo}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.link}
                        >
                          <FaPlay /> Demo
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {projects.length > slidesToShow && (
            <button
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={() => scrollByAmount("next")}
              disabled={!canScrollRight}
              aria-label="Next project"
            >
              <FaChevronRight />
            </button>
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.dotsContainer}>
            {Array.from({ length: Math.max(1, totalPages) }).map((_, idx) => (
              <button
                key={idx}
                className={`${styles.dot} ${currentSlide === idx ? styles.activeDot : ""}`}
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
