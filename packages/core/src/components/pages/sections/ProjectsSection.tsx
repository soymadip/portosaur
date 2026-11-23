"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  CAROUSEL_SWIPE_THRESHOLD_PX,
  autoplayDelayMs,
  nextSlideIndex,
} from "../../../lib/carousel.ts";
import {
  isProjectsVisible,
  maxScrollerIndex,
  projectAutoplaySeconds,
  visibleProjectCount,
  type PortfolioProject,
} from "../../../lib/portfolio-home.ts";
import { SiteIcon } from "../../SiteIcon.tsx";

/** The project shelf's config, as `buildSiteConfig` delivers it. */
export interface ProjectShelfData {
  enable?: boolean;
  heading?: string;
  subheading?: string;
  autoplay?: unknown;
  projects?: PortfolioProject[];
}

/** The states a project badge knows, lowercased. Anything else
 * renders with the badge's default look. */
const KNOWN_STATES = new Set([
  "active",
  "completed",
  "maintenance",
  "paused",
  "archived",
  "planned",
]);

/**
 * ProjectsSection — the project shelf as a multi-card scroller:
 * three cards on desktop, two on a tablet, one on a phone,
 * moving one card at a time with arrows, keyboard, or swipe.
 * The arrows flank the track and disable at the ends; on phones
 * they hide and the shelf is swiped instead. Autoplay wraps
 * back to the start instead of stalling there.
 */
export function ProjectsSection({ shelf }: { shelf: ProjectShelfData }) {
  const projects = Array.isArray(shelf.projects) ? shelf.projects : [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(3);
  const sectionRef = useRef<HTMLElement | null>(null);
  const startX = useRef<number | null>(null);

  /* The visible count follows the window width, on the same
     breakpoints the stylesheet sizes the cards at. */
  useEffect(() => {
    const measure = () => {
      setVisible(visibleProjectCount(window.innerWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const max = maxScrollerIndex(projects.length, visible);

  /* A resize that shows more cards can strand the index past
     the new end — pull it back. */
  useEffect(() => {
    setIndex((current) => Math.min(current, max));
  }, [max]);

  const next = useCallback(() => {
    setIndex((current) => Math.min(current + 1, max));
  }, [max]);
  const prev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  /* Autoplay runs only when the config key is on (true means 5
     seconds), with more than one position to visit, and while
     the pointer is not over the shelf and nothing inside it has
     focus. It wraps to the start at the end; the timer restarts
     on every step, so a manual switch gives the new card its
     full interval. */
  const delay = autoplayDelayMs(projectAutoplaySeconds(shelf.autoplay));
  useEffect(() => {
    if (delay === null || paused || max <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => nextSlideIndex(current, max + 1, true));
    }, delay);
    return () => window.clearInterval(timer);
  }, [delay, paused, max, index]);

  /* Arrow keys move one card, Home and End jump to the ends.
     When the key came from inside a card (a focused link), focus
     moves to the section itself after the switch: the card just
     went inert, and focus would otherwise drop to the page.
     Buttons keep their focus. */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    if (event.key === "ArrowRight") {
      next();
    } else if (event.key === "ArrowLeft") {
      prev();
    } else if (event.key === "Home") {
      setIndex(0);
    } else {
      setIndex(max);
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      typeof target.closest === "function" &&
      !target.closest("button")
    ) {
      sectionRef.current?.focus();
    }
  };

  /* Swipe is touch only: a mouse drag would fight text selection.
     The viewport's touch-action leaves vertical scrolling to the
     browser and hands horizontal drags to these handlers. */
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }
    startX.current = event.clientX;
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || startX.current === null) {
      return;
    }
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (delta <= -CAROUSEL_SWIPE_THRESHOLD_PX) {
      next();
    } else if (delta >= CAROUSEL_SWIPE_THRESHOLD_PX) {
      prev();
    }
  };
  const handlePointerCancel = () => {
    startX.current = null;
  };

  if (!isProjectsVisible(shelf)) {
    return null;
  }

  const showArrows = projects.length > visible;
  const trackStyle = {
    "--porto-scroller-offset": `${-index * (100 / visible)}%`,
  } as CSSProperties;

  return (
    <section
      id="projects"
      className="porto-projects-section"
      role="region"
      aria-roledescription="carousel"
      aria-label={shelf.heading || "My Projects"}
      tabIndex={0}
      ref={sectionRef}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="porto-projects__container">
        <div className="porto-projects__header">
          <h2 className="porto-projects__heading">
            {shelf.heading || "My Projects"}
          </h2>
          {shelf.subheading && (
            <p className="porto-projects__subheading">{shelf.subheading}</p>
          )}
        </div>
        <div className="porto-projects__scroller">
          {showArrows && (
            <button
              type="button"
              className="porto-projects__arrow porto-projects__arrow--prev"
              aria-label="Previous project"
              disabled={index === 0}
              onClick={prev}
            >
              <SiteIcon icon="lu:chevron-left" size="1.8rem" />
            </button>
          )}
          <div
            className="porto-projects__viewport"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <div className="porto-projects__track" style={trackStyle}>
              {projects.map((project, i) => {
                const tags = Array.isArray(project.tags)
                  ? project.tags.filter(
                      (tag): tag is string => typeof tag === "string",
                    )
                  : [];
                const extraTags = tags.length - 3;
                const state =
                  typeof project.state === "string"
                    ? project.state.toLowerCase()
                    : "";
                const inView = i >= index && i < index + visible;
                return (
                  <div
                    key={project.title || i}
                    className="porto-projects__card-wrap"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} of ${projects.length}`}
                    inert={!inView}
                  >
                    <article className="porto-projects__card">
                      <div
                        className="porto-projects__tile"
                        style={
                          project.bg
                            ? { backgroundColor: project.bg }
                            : undefined
                        }
                      >
                        {project.icon && (
                          <div className="porto-projects__tile-icon">
                            <SiteIcon icon={project.icon} />
                          </div>
                        )}
                        {state !== "" && (
                          <span
                            className={
                              KNOWN_STATES.has(state)
                                ? `porto-projects__state porto-projects__state--${state}`
                                : "porto-projects__state"
                            }
                          >
                            {project.state}
                          </span>
                        )}
                        {project.featured && (
                          <span
                            className="porto-projects__featured"
                            title="Featured"
                          >
                            <SiteIcon icon="lu:star" />
                          </span>
                        )}
                        {tags.length > 0 && (
                          <div className="porto-projects__tags">
                            {tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="porto-projects__tag">
                                {tag}
                              </span>
                            ))}
                            {extraTags > 0 && (
                              <span
                                className="porto-projects__tag porto-projects__tag--extra"
                                title={tags.slice(3).join(", ")}
                              >
                                +{extraTags}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="porto-projects__content">
                        <h3 className="porto-projects__title">
                          {project.title}
                        </h3>
                        {project.desc && (
                          <p className="porto-projects__desc">{project.desc}</p>
                        )}
                      </div>
                      {(project.website || project.repo || project.demo) && (
                        <div className="porto-projects__links">
                          {project.website && (
                            <a
                              href={project.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="porto-projects__link"
                            >
                              <SiteIcon icon="lu:globe" size="0.95rem" />
                              Website
                            </a>
                          )}
                          {project.repo && (
                            <a
                              href={project.repo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="porto-projects__link"
                            >
                              <SiteIcon icon="lu:code-xml" size="0.95rem" />
                              Source
                            </a>
                          )}
                          {project.demo && (
                            <a
                              href={project.demo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="porto-projects__link"
                            >
                              <SiteIcon icon="lu:play" size="0.95rem" />
                              Demo
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
          {showArrows && (
            <button
              type="button"
              className="porto-projects__arrow porto-projects__arrow--next"
              aria-label="Next project"
              disabled={index === max}
              onClick={next}
            >
              <SiteIcon icon="lu:chevron-right" size="1.8rem" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
