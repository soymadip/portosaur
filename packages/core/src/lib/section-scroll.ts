/** The navbar's marker — the header carries a `data-navbar` attribute. */
const NAVBAR_SELECTOR = "[data-navbar]";

/** What the landing calculation needs: the navbar's live height,
 * whether it hides on scroll, and where the jump starts and ends. */
export interface LandingInput {
  /** The navbar's measured height in px (`offsetHeight` — the hide
   * transform does not change it). 0 when there is no navbar. */
  navbarHeight: number;
  /** The theme's `hideNavbarOnScroll`: false means the navbar never hides. */
  hideOnScroll: boolean;
  /** The target element's top in document coordinates, in px. */
  targetTop: number;
  /** The scroll position when the jump starts, in px. */
  scrollY: number;
  /** The breathing gap under the navbar on landings that sit below it, in px (1rem). */
  gap: number;
}

/**
 * The offset to subtract from the target's top so a section jump
 * lands just below the navbar when the navbar will be showing, or
 * flush at the viewport top when it will be hidden. The navbar's
 * hide rule is the guide: it hides only while scrolling down past
 * one navbar-height, and shows again on any scroll up (or at the
 * top of the page). So the offset uses the navbar's END state,
 * not its state when clicked — scrolling down past the navbar's
 * height ends hidden (offset 0), anything else ends showing
 * (navbar height + gap).
 */
export function landingOffset(input: LandingInput): number {
  const { navbarHeight, hideOnScroll, targetTop, scrollY, gap } = input;
  if (!hideOnScroll) {
    return navbarHeight + gap;
  }
  if (targetTop <= scrollY || targetTop <= navbarHeight) {
    return navbarHeight + gap;
  }
  return 0;
}

/** Smooth scrolling, unless the reader asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "auto";
  }
  return "smooth";
}

/**
 * The element a jump aims at: the section's first heading when it
 * has one, else the section itself. A section's top padding puts
 * its heading well below its top edge (About: 80px), so aiming at
 * the section edge leaves a gap under the navbar even on a perfect
 * landing. Aiming at the heading lands the visible start of the
 * section just below the navbar, or flush at the top when the
 * navbar will be hidden.
 */
export function jumpTarget(section: Element): Element {
  return section.querySelector("h2") ?? section;
}

/**
 * Jumps to the element with this id, landing its heading just below
 * the navbar when the navbar will be showing at the end of the glide,
 * or flush at the viewport top when it will be hidden. Sections
 * without a heading land on their own top edge. The scroll goes
 * through `window.scrollTo` with an absolute top — NOT
 * `scrollIntoView`, which would also apply the CSS scroll padding
 * and double the offset. Returns false when no such element
 * exists, so the caller can fall back to the native jump.
 */
export function scrollToSection(
  id: string,
  options: { hideOnScroll: boolean },
): boolean {
  const element = document.getElementById(id);
  if (!element) {
    return false;
  }
  const navbar = document.querySelector(NAVBAR_SELECTOR);
  const navbarHeight = navbar instanceof HTMLElement ? navbar.offsetHeight : 0;
  const rem =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  const target = jumpTarget(element);
  const targetTop = target.getBoundingClientRect().top + scrollY;
  const offset = landingOffset({
    navbarHeight,
    hideOnScroll: options.hideOnScroll,
    targetTop,
    scrollY,
    gap: rem,
  });
  window.scrollTo({
    top: Math.max(0, targetTop - offset),
    behavior: scrollBehavior(),
  });
  return true;
}
