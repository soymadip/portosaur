/**
 * Navbar entries, shared by `Navbar.astro` (desktop bar + non-docs
 * mobile menu) and `MobileMenuFooter.astro` (the nav links inside the
 * docs sidebar popover on mobile).
 *
 * Port of the navbar items the old Docusaurus config assembled in
 * `themeConfig.navbar.items`:
 *
 *   - Docs (docs mode) / About Me, Projects, Experience, Contact
 *     anchors (portfolio mode, when each section is enabled)
 *   - custom `theme.navigation.navbar_items` (links + dropdowns)
 *   - "More" dropdown: Notes (portfolio mode), Blog, Tasks (when
 *     enabled), Portosaur version link (unless disabled)
 */

import type { PortosaurOptions } from "../integration.ts";

export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
  external?: boolean;
}

export interface NavDropdown {
  label: string;
  items: NavLink[];
  className?: string;
}

export type NavEntry = NavLink | NavDropdown;

export function isDropdown(entry: NavEntry): entry is NavDropdown {
  return (entry as NavDropdown).items !== undefined;
}

/** The Portosaur project's own homepage (not part of PortosaurOptions). */
export const PORTO_HOMEPAGE = "https://soymadip.github.io/portosaur";

export interface NavEntries {
  leftEntries: NavEntry[];
  rightEntries: NavEntry[];
  moreItems: NavLink[];
  showProjectLink: boolean;
  versionLabel: string;
}

export function buildNavEntries(
  config: PortosaurOptions,
  pathname: string,
): NavEntries {
  const site = config.site;
  const theme = config.theme;
  const siteMode = config.siteMode;
  const homePage = config.homePage ?? {};
  const tasks = config.tasks ?? {};

  const base = site.baseUrl ?? "/";
  const basePrefix = base === "/" ? "" : base.replace(/\/+$/, "");
  const withBase = (path: string) =>
    `${basePrefix}${path.startsWith("/") ? path : `/${path}`}`;

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  function isActivePath(href: string): boolean {
    const normalized = href.replace(/\/+$/, "") || "/";
    if (normalized === "/") {
      return normalizedPath === "/";
    }
    return (
      normalizedPath === normalized ||
      normalizedPath.startsWith(`${normalized}/`)
    );
  }

  // Anchor items never show active (the old config gave them
  // `activeBasePath: "/never-match"`).
  const leftEntries: NavEntry[] = [];
  const rightEntries: NavEntry[] = [];

  if (siteMode === "docs") {
    rightEntries.push({
      label: "Docs",
      href: withBase(`/${site.notesRoute}`),
      active: isActivePath(`/${site.notesRoute}`),
    });
  } else {
    if (homePage.aboutSection?.enable) {
      rightEntries.push({ label: "About Me", href: withBase("/#about") });
    }
    if (homePage.projectShelf?.enable) {
      rightEntries.push({ label: "Projects", href: withBase("/#projects") });
    }
    if (homePage.experienceSection?.enable) {
      rightEntries.push({
        label: "Experience",
        href: withBase("/#experience"),
      });
    }
    if (homePage.socialSection?.enable) {
      rightEntries.push({ label: "Contact", href: withBase("/#contact") });
    }
  }

  // Custom navbar items: `{ label, to?, href?, position?, items? }`.
  // `items` (an array of `{ label, to?, href? }`) renders a dropdown.
  for (const item of theme.navbarItems ?? []) {
    const target = item.position === "left" ? leftEntries : rightEntries;
    const toLink = (entry: any): NavLink => ({
      label: entry.label,
      href: entry.to ? withBase(entry.to) : (entry.href ?? "#"),
      active: entry.to ? isActivePath(entry.to) : false,
      external: !entry.to && /^https?:\/\//.test(entry.href ?? ""),
    });
    if (Array.isArray(item.items) && item.items.length > 0) {
      target.push({
        label: item.label,
        items: item.items.map(toLink),
      });
    } else {
      target.push(toLink(item));
    }
  }

  const showProjectLink = !theme.disableProjectLink;
  const versionLabel = `Portosaur v${config.portoVersion}`;

  const moreItems: NavLink[] = [];
  if (siteMode !== "docs") {
    moreItems.push({
      label: "Notes",
      href: withBase(`/${site.notesRoute}`),
      active: isActivePath(`/${site.notesRoute}`),
    });
  }
  moreItems.push({
    label: "Blog",
    href: withBase(`/${site.blogRoute}`),
    active: isActivePath(`/${site.blogRoute}`),
  });
  if (tasks.enable) {
    moreItems.push({
      label: "Tasks",
      href: withBase("/tasks"),
      active: isActivePath("/tasks"),
    });
  }
  if (showProjectLink) {
    moreItems.push({
      label: versionLabel,
      href: PORTO_HOMEPAGE,
      external: true,
    });
  }

  return {
    leftEntries,
    rightEntries,
    moreItems,
    showProjectLink,
    versionLabel,
  };
}
