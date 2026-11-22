import { describe, test, expect } from "bun:test";
import { createElement } from "react";
import {
  autoplayDelayMs,
  nextSlideIndex,
  normalizeSlides,
  prevSlideIndex,
  slideCaption,
} from "../src/lib/carousel.ts";

/**
 * The carousel's index math, autoplay delay, and caption
 * extraction. The caption check looks at props, not at the
 * element type: a Markdown image arrives with its `src` as an
 * import object (`{ src, width, height }`), a raw `<img>` tag
 * arrives with a plain string, and MDX wraps a lone image in a
 * paragraph either way.
 */

describe("nextSlideIndex", () => {
  test("advances within the slides", () => {
    expect(nextSlideIndex(0, 3, true)).toBe(1);
    expect(nextSlideIndex(1, 3, false)).toBe(2);
  });

  test("wraps to the first slide when loop is on", () => {
    expect(nextSlideIndex(2, 3, true)).toBe(0);
  });

  test("stops at the last slide when loop is off", () => {
    expect(nextSlideIndex(2, 3, false)).toBe(2);
  });

  test("a single slide stays put", () => {
    expect(nextSlideIndex(0, 1, true)).toBe(0);
    expect(nextSlideIndex(0, 1, false)).toBe(0);
  });

  test("no slides stays at zero", () => {
    expect(nextSlideIndex(0, 0, true)).toBe(0);
  });
});

describe("prevSlideIndex", () => {
  test("goes back within the slides", () => {
    expect(prevSlideIndex(2, 3, true)).toBe(1);
    expect(prevSlideIndex(1, 3, false)).toBe(0);
  });

  test("wraps to the last slide when loop is on", () => {
    expect(prevSlideIndex(0, 3, true)).toBe(2);
  });

  test("stops at the first slide when loop is off", () => {
    expect(prevSlideIndex(0, 3, false)).toBe(0);
  });

  test("a single slide stays put", () => {
    expect(prevSlideIndex(0, 1, true)).toBe(0);
    expect(prevSlideIndex(0, 1, false)).toBe(0);
  });

  test("no slides stays at zero", () => {
    expect(prevSlideIndex(0, 0, true)).toBe(0);
  });
});

describe("autoplayDelayMs", () => {
  test("seconds become milliseconds, floats included", () => {
    expect(autoplayDelayMs(5)).toBe(5000);
    expect(autoplayDelayMs(2.5)).toBe(2500);
  });

  test("zero turns autoplay off", () => {
    expect(autoplayDelayMs(0)).toBeNull();
  });

  test("a negative value turns autoplay off", () => {
    expect(autoplayDelayMs(-3)).toBeNull();
  });

  test("not-a-number turns autoplay off", () => {
    expect(autoplayDelayMs(Number.NaN)).toBeNull();
  });
});

describe("slideCaption", () => {
  test("a raw img tag captions from its alt text", () => {
    const slide = createElement("img", {
      src: "/img/a.png",
      alt: "First screen",
    });
    expect(slideCaption(slide)).toBe("First screen");
  });

  test("a Markdown image captions from its alt text", () => {
    const slide = createElement("img", {
      src: { src: "/img/a.png", width: 1200, height: 675 },
      alt: "First screen",
    });
    expect(slideCaption(slide)).toBe("First screen");
  });

  test("a mapped image component captions from its alt text", () => {
    const ImageZoom = () => null;
    const slide = createElement(ImageZoom, {
      src: { src: "/img/a.png", width: 1200, height: 675 },
      alt: "First screen",
    });
    expect(slideCaption(slide)).toBe("First screen");
  });

  test("a paragraph-wrapped image captions from its alt text", () => {
    const slide = createElement(
      "p",
      null,
      createElement("img", { src: "/img/a.png", alt: "First screen" }),
    );
    expect(slideCaption(slide)).toBe("First screen");
  });

  test("a linked image captions from its alt text", () => {
    const slide = createElement(
      "a",
      { href: "/elsewhere" },
      createElement("img", { src: "/img/a.png", alt: "First screen" }),
    );
    expect(slideCaption(slide)).toBe("First screen");
  });

  test("a figure slide gets no auto-caption", () => {
    const slide = createElement(
      "figure",
      null,
      createElement("img", { src: "/img/a.png", alt: "First screen" }),
      createElement("figcaption", null, "The author's own caption"),
    );
    expect(slideCaption(slide)).toBeNull();
  });

  test("a card slide gets no caption", () => {
    const Card = () => null;
    const slide = createElement(
      Card,
      { title: "A card", icon: "lu:rocket" },
      "Card body",
    );
    expect(slideCaption(slide)).toBeNull();
  });

  test("an image without alt text gets no caption", () => {
    expect(
      slideCaption(createElement("img", { src: "/img/a.png" })),
    ).toBeNull();
  });

  test("an empty alt means decorative, so no caption", () => {
    expect(
      slideCaption(createElement("img", { src: "/img/a.png", alt: "" })),
    ).toBeNull();
  });

  test("a text slide gets no caption", () => {
    expect(slideCaption("Just words")).toBeNull();
    expect(slideCaption(null)).toBeNull();
  });

  test("a paragraph of text and an image gets no caption", () => {
    const slide = createElement(
      "p",
      null,
      "Look at this: ",
      createElement("img", { src: "/img/a.png", alt: "First screen" }),
    );
    expect(slideCaption(slide)).toBeNull();
  });
});

describe("normalizeSlides", () => {
  const img = (alt: string) => createElement("img", { src: "/img/a.png", alt });

  test("a paragraph of consecutive images splits into one slide each", () => {
    const children = createElement(
      "p",
      null,
      img("First"),
      img("Second"),
      img("Third"),
    );
    expect(normalizeSlides(children)).toHaveLength(3);
  });

  test("a paragraph of images with whitespace between them still splits", () => {
    const children = createElement(
      "p",
      null,
      img("First"),
      "\n  ",
      img("Second"),
    );
    expect(normalizeSlides(children)).toHaveLength(2);
  });

  test("bare images stay separate slides", () => {
    expect(normalizeSlides([img("First"), img("Second")])).toHaveLength(2);
  });

  test("a paragraph mixing text and images stays one slide", () => {
    const children = createElement(
      "p",
      null,
      "Look at this: ",
      img("First"),
      img("Second"),
    );
    expect(normalizeSlides(children)).toHaveLength(1);
  });

  test("a figure holding images is never split", () => {
    const children = createElement(
      "figure",
      null,
      img("First"),
      img("Second"),
      createElement("figcaption", null, "Both together"),
    );
    expect(normalizeSlides(children)).toHaveLength(1);
  });

  test("whitespace-only text between slides is dropped", () => {
    expect(
      normalizeSlides(["\n  ", img("First"), "\n  ", img("Second"), "\n"]),
    ).toHaveLength(2);
  });

  test("non-empty text stays a slide", () => {
    expect(normalizeSlides(["Just words"])).toHaveLength(1);
  });

  test("no children means no slides", () => {
    expect(normalizeSlides(null)).toHaveLength(0);
    expect(normalizeSlides(undefined)).toHaveLength(0);
  });
});
