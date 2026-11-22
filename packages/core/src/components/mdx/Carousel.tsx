"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  CAROUSEL_SWIPE_THRESHOLD_PX,
  autoplayDelayMs,
  nextSlideIndex,
  normalizeSlides,
  prevSlideIndex,
  slideCaption,
} from "../../lib/carousel.ts";
import { SiteIcon } from "../SiteIcon.tsx";

/**
 * Carousel — one slide at a time: images, cards, or any MDX
 * content, switched by arrows, dots, keyboard, or swipe. The
 * slides are the children, one element each. A bare image slide
 * shows its alt text as a caption underneath.
 *
 * The track position is a CSS variable (`--porto-carousel-index`),
 * not an inline transform, so the stylesheet can flip the slide
 * direction for right-to-left pages.
 */
export function Carousel({
  children,
  showArrows = true,
  showDots = true,
  autoplay = 0,
  loop = true,
}: {
  children?: ReactNode;
  /** Show the prev/next arrow buttons. */
  showArrows?: boolean;
  /** Show the dot indicators under the slides. */
  showDots?: boolean;
  /** Seconds between slides. 0 turns autoplay off. */
  autoplay?: number;
  /** Wrap from the last slide back to the first. */
  loop?: boolean;
}) {
  /* Whitespace-only text between slides is dropped, and a
     paragraph of consecutive images splits into one slide per
     image — see normalizeSlides. */
  const slides = normalizeSlides(children);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const startX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) {
        return;
      }
      setIndex(((next % count) + count) % count);
    },
    [count],
  );
  const next = useCallback(() => {
    setIndex((current) => nextSlideIndex(current, count, loop));
  }, [count, loop]);
  const prev = useCallback(() => {
    setIndex((current) => prevSlideIndex(current, count, loop));
  }, [count, loop]);

  /* Autoplay runs only when asked (a delay above zero), with more
     than one slide, and while the pointer is not over the
     carousel and nothing inside it has focus. The timer restarts
     on every slide change, so a manual switch gives the new
     slide its full interval. */
  const delay = autoplayDelayMs(autoplay);
  useEffect(() => {
    if (delay === null || paused || count <= 1) {
      return;
    }
    const timer = window.setInterval(next, delay);
    return () => window.clearInterval(timer);
  }, [delay, paused, count, next, index]);

  /* Arrow keys move between slides, Home and End jump to the
     first and last. When the key came from inside a slide (a
     focused image), focus moves to the carousel itself after the
     switch: the image just went inert with its slide, and focus
     would otherwise drop to the page. Buttons keep their focus. */
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
      goTo(0);
    } else {
      goTo(count - 1);
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

  if (count === 0) {
    return null;
  }

  const single = count === 1;
  const atStart = index === 0;
  const atEnd = index === count - 1;
  const trackStyle = {
    "--porto-carousel-index": index,
  } as CSSProperties;

  return (
    <section
      className="porto-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Carousel"
      tabIndex={0}
      ref={sectionRef}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="porto-carousel__viewport"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="porto-carousel__track" style={trackStyle}>
          {slides.map((slide, i) => {
            const caption = slideCaption(slide);
            const active = i === index;
            return (
              <div
                key={i}
                className="porto-carousel__slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                inert={!active}
              >
                {slide}
                {caption !== null && (
                  <p className="porto-carousel__caption">{caption}</p>
                )}
              </div>
            );
          })}
        </div>
        {!single && showArrows && (
          <>
            <button
              type="button"
              className="porto-carousel__arrow porto-carousel__arrow--prev"
              aria-label="Previous slide"
              disabled={!loop && atStart}
              onClick={prev}
            >
              <SiteIcon icon="lu:chevron-left" size="1.25rem" />
            </button>
            <button
              type="button"
              className="porto-carousel__arrow porto-carousel__arrow--next"
              aria-label="Next slide"
              disabled={!loop && atEnd}
              onClick={next}
            >
              <SiteIcon icon="lu:chevron-right" size="1.25rem" />
            </button>
          </>
        )}
      </div>
      {!single && showDots && (
        <div className="porto-carousel__dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className="porto-carousel__dot"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index ? true : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
