import { techMap } from "./techmap.ts";

/**
 * Portfolio home helpers — the pure logic behind the portfolio
 * home page (section visibility, the project scroller's index
 * math, the contact list's email-first order). The page and the
 * sections both read these, so the "Learn More" jump target and
 * the floating arrow never disagree with what actually renders.
 */

/** Section anchor ids, in page order. */
export const PORTFOLIO_SECTION_IDS = [
  "me",
  "about",
  "projects",
  "experience",
  "contact",
] as const;

/** A project as the config delivers it. */
export interface PortfolioProject {
  title?: string;
  icon?: string | { src: string; fallback?: string } | null;
  bg?: string;
  state?: string;
  desc?: string;
  tags?: string[];
  featured?: boolean;
  website?: string;
  repo?: string;
  demo?: string;
}

/** A social link as the config delivers it. */
export interface SocialLink {
  name?: string;
  url?: string;
  icon?: string;
  desc?: string;
  color?: string;
}

/** An image resolved for rendering: a base-prefixed source, an
 * optional fallback, and measured dimensions when the build
 * could read the local file. */
export interface SizedImage {
  src: string;
  fallback?: string;
  width?: number;
  height?: number;
}

/** Which sections render, for the "Learn More" jump and the
 * floating arrow. The hero always shows, so it is not listed. */
export interface VisibleSections {
  about: boolean;
  projects: boolean;
  experience: boolean;
  contact: boolean;
}

/** The bio as paragraphs: the config is usually a list, but a
 * lone string renders as one paragraph, the way the old home
 * handled it. */
export function bioParagraphs(bio: unknown): string[] {
  if (typeof bio === "string") {
    return bio === "" ? [] : [bio];
  }
  if (!Array.isArray(bio)) {
    return [];
  }
  return bio.filter((paragraph): paragraph is string =>
    typeof paragraph === "string",
  );
}

/** Whether the resume value names a file: a non-empty string
 * other than "none". */
export function isResumeFile(resume: unknown): boolean {
  return (
    typeof resume === "string" &&
    resume.trim() !== "" &&
    resume.trim().toLowerCase() !== "none"
  );
}

/** The About section shows when it is on and has something to
 * say: bio paragraphs, skills, or a resume. The photo alone is
 * not enough — it always has a fallback image. */
export function isAboutVisible(about: {
  enable?: boolean;
  bio?: unknown;
  skills?: unknown;
  resume?: unknown;
}): boolean {
  if (about.enable === false) {
    return false;
  }
  const skills = Array.isArray(about.skills) ? about.skills : [];
  return (
    bioParagraphs(about.bio).length > 0 ||
    skills.length > 0 ||
    isResumeFile(about.resume)
  );
}

/** The Projects section shows when it is on and the shelf holds
 * at least one project. */
export function isProjectsVisible(shelf: {
  enable?: boolean;
  projects?: unknown;
}): boolean {
  if (shelf.enable === false) {
    return false;
  }
  return Array.isArray(shelf.projects) && shelf.projects.length > 0;
}

/** The Experience section shows only when it is on — it defaults
 * off — and the list holds at least one entry. */
export function isExperienceVisible(experience: {
  enable?: boolean;
  list?: unknown;
}): boolean {
  if (experience.enable !== true) {
    return false;
  }
  return Array.isArray(experience.list) && experience.list.length > 0;
}

/** The Contact section shows when it is on and holds at least
 * one link. */
export function isContactVisible(social: {
  enable?: boolean;
  links?: unknown;
}): boolean {
  if (social.enable === false) {
    return false;
  }
  return Array.isArray(social.links) && social.links.length > 0;
}

/** The section the hero's "Learn More" button jumps to: the
 * first visible section below the hero, or null when no section
 * below it renders. */
export function learnMoreTarget(visible: VisibleSections): string | null {
  if (visible.about) {
    return "about";
  }
  if (visible.projects) {
    return "projects";
  }
  if (visible.experience) {
    return "experience";
  }
  if (visible.contact) {
    return "contact";
  }
  return null;
}

/** The anchor ids of the sections that render, hero first, for
 * the floating arrow to step through. */
export function visibleSectionIds(visible: VisibleSections): string[] {
  const ids = ["me"];
  if (visible.about) {
    ids.push("about");
  }
  if (visible.projects) {
    ids.push("projects");
  }
  if (visible.experience) {
    ids.push("experience");
  }
  if (visible.contact) {
    ids.push("contact");
  }
  return ids;
}

/** How many project cards fit side by side: three on desktop,
 * two on a tablet, one on a phone. The stylesheet's card widths
 * use the same breakpoints, so the two never disagree. */
export function visibleProjectCount(width: number): number {
  if (width <= 600) {
    return 1;
  }
  if (width <= 1024) {
    return 2;
  }
  return 3;
}

/** The last scroller position: the index that puts the final
 * card at the row's end. Zero when every card already fits. */
export function maxScrollerIndex(count: number, visible: number): number {
  return Math.max(0, count - visible);
}

/** Autoplay in seconds for the project scroller: the config key
 * is true/false, and true means 5 seconds. */
export function projectAutoplaySeconds(autoplay: unknown): number {
  return autoplay === true ? 5 : 0;
}

/** Whether a social link is an email link: a mailto: URL, or an
 * icon or name mentioning email. */
function isEmailLink(link: {
  url?: string;
  icon?: string;
  name?: string;
}): boolean {
  return (
    link.url?.startsWith("mailto:") === true ||
    link.icon?.toLowerCase().includes("email") === true ||
    link.name?.toLowerCase().includes("email") === true
  );
}

/** The contact links with email first, everything else in
 * config order. A stable sort, so equal links keep their order. */
export function sortEmailFirst<T extends { url?: string; icon?: string; name?: string }>(
  links: T[],
): T[] {
  return [...links].sort((a, b) => {
    const emailA = isEmailLink(a);
    const emailB = isEmailLink(b);
    if (emailA && !emailB) {
      return -1;
    }
    if (!emailA && emailB) {
      return 1;
    }
    return 0;
  });
}

/** The icon color for a social link: the link's own `color`
 * first, then the icon map's brand color for the site name,
 * then nothing (the stylesheet's default). */
export function socialIconColor(link: {
  color?: string;
  name?: string;
}): string | undefined {
  if (link.color) {
    return link.color;
  }
  const mapped = link.name
    ? techMap[link.name.toLowerCase()]?.color
    : undefined;
  return mapped;
}
