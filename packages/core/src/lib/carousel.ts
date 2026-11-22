import { Children, isValidElement, type ReactNode } from "react";

/** The drag distance that switches slides. */
export const CAROUSEL_SWIPE_THRESHOLD_PX = 50;

/** The next slide index: wraps to the first slide when loop is on,
    stops at the last slide when it is off. */
export function nextSlideIndex(
  current: number,
  count: number,
  loop: boolean,
): number {
  if (count <= 0) {
    return 0;
  }
  if (current >= count - 1) {
    return loop ? 0 : count - 1;
  }
  return current + 1;
}

/** The previous slide index: wraps to the last slide when loop is
    on, stops at the first slide when it is off. */
export function prevSlideIndex(
  current: number,
  count: number,
  loop: boolean,
): number {
  if (count <= 0) {
    return 0;
  }
  if (current <= 0) {
    return loop ? count - 1 : 0;
  }
  return current - 1;
}

/** Autoplay in seconds to a timer delay in ms. Zero, negative, or
    not-a-number means off. */
export function autoplayDelayMs(autoplay: number): number | null {
  if (!Number.isFinite(autoplay) || autoplay <= 0) {
    return null;
  }
  return autoplay * 1000;
}

/** Whether a slide prop is an image source: a plain URL string (a
    raw `<img>` tag, a remote image), or the import object
    Fumadocs' remarkImage turns a local Markdown image into
    (`{ src, width, height }`). */
function isImageSource(src: unknown): boolean {
  if (typeof src === "string") {
    return true;
  }
  return (
    typeof src === "object" &&
    src !== null &&
    typeof (src as { src?: unknown }).src === "string"
  );
}

/** Whether a node is an image element: it carries an image source
    in its props. The type is not checked — the site maps `img` to
    its zoom component, so a Markdown image never arrives as a
    plain `img` element. */
function isImageElement(node: ReactNode): boolean {
  if (!isValidElement(node)) {
    return false;
  }
  return isImageSource((node.props as { src?: unknown }).src);
}

/** The slides from the carousel's children. Whitespace-only text
    between slides (the newlines MDX leaves between elements) is
    dropped. A wrapper holding only images — the paragraph MDX
    makes of consecutive Markdown images without blank lines
    between them — splits into one slide per image, so each image
    is its own slide the way the author expects. A figure is never
    split: it renders as-is, with its own caption. */
export function normalizeSlides(children: ReactNode): ReactNode[] {
  const slides: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (typeof child === "string") {
      if (child.trim() !== "") {
        slides.push(child);
      }
      continue;
    }
    if (isValidElement(child) && child.type !== "figure") {
      const kids = Children.toArray(
        (child.props as { children?: ReactNode }).children,
      ).filter((kid) => !(typeof kid === "string" && kid.trim() === ""));
      if (kids.length >= 2 && kids.every(isImageElement)) {
        slides.push(...kids);
        continue;
      }
    }
    slides.push(child);
  }
  return slides;
}

/** The caption for one slide: the alt text when the slide is a bare
    image, null otherwise. The check looks at props, not at the
    element type: MDX wraps a lone image in a paragraph, and the
    site maps `img` to its zoom component, so the type is never a
    plain `img` by the time the slide arrives here. Single-child
    wrappers (the paragraph around the image, a link around it)
    are unwrapped first. A figure holds an image plus a caption of
    its own, so it is never unwrapped and never gains an
    auto-caption. An empty alt means decorative, so it captions
    nothing. */
export function slideCaption(slide: ReactNode): string | null {
  let node: ReactNode = slide;
  for (;;) {
    if (!isValidElement(node)) {
      return null;
    }
    const props = node.props as {
      src?: unknown;
      alt?: unknown;
      children?: ReactNode;
    };
    if (
      isImageSource(props.src) &&
      typeof props.alt === "string" &&
      props.alt !== ""
    ) {
      return props.alt;
    }
    const kids = Children.toArray(props.children);
    if (kids.length !== 1 || !isValidElement(kids[0])) {
      return null;
    }
    node = kids[0];
  }
}
