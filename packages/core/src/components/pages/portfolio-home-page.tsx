import type { PortosaurOptions } from "../../lib/config.ts";
import {
  localImageDimensions,
  staticDirsForConfig,
} from "../../lib/image-size.ts";
import { withBase } from "../../lib/pageUrl.ts";
import {
  isAboutVisible,
  isContactVisible,
  isExperienceVisible,
  isProjectsVisible,
  learnMoreTarget,
  visibleSectionIds,
  type SizedImage,
  type VisibleSections,
} from "../../lib/portfolio-home.ts";
import { SiteShell } from "./frame/SiteShell.tsx";
import { AboutSection } from "./sections/AboutSection.tsx";
import { ContactSection } from "./sections/ContactSection.tsx";
import { ExperienceSection } from "./sections/ExperienceSection.tsx";
import { HeroSection } from "./sections/HeroSection.tsx";
import { NavArrow } from "./sections/NavArrow.tsx";
import { ProjectsSection } from "./sections/ProjectsSection.tsx";

/**
 * PortfolioHomePage — the portfolio home: hero, about, projects,
 * experience, and contact sections from `config.homePage`,
 * stacked in the old order inside the site shell. A section with
 * `enable: false`, or with nothing to show, renders nothing and
 * leaves no gap.
 *
 * Async: the hero and about images are sized from the local file
 * when the build can read it (remote URLs and unsizable files
 * fall back to 400x400 via `HeroImage`).
 */
export async function PortfolioHomePage({
  config,
}: {
  config: PortosaurOptions;
}) {
  const homePage = config.homePage ?? {};
  const hero = homePage.heroSection ?? {};
  const about = homePage.aboutSection ?? {};
  const shelf = homePage.projectShelf ?? {};
  const experience = homePage.experienceSection ?? {};
  const social = homePage.socialSection ?? {};

  const visible: VisibleSections = {
    about: isAboutVisible(about),
    projects: isProjectsVisible(shelf),
    experience: isExperienceVisible(experience),
    contact: isContactVisible(social),
  };

  const [profilePic, aboutImage] = await Promise.all([
    sizedImage(hero.profilePic, config),
    sizedImage(about.image, config),
  ]);

  return (
    <SiteShell config={config} isHome isPortfolioHome>
      <div className="porto-portfolio-home">
        <HeroSection
          hero={hero}
          nextId={learnMoreTarget(visible)}
          profilePic={profilePic}
        />
        {visible.about && <AboutSection about={about} image={aboutImage} />}
        {visible.projects && <ProjectsSection shelf={shelf} />}
        {visible.experience && <ExperienceSection experience={experience} />}
        {visible.contact && <ContactSection social={social} />}
        <NavArrow sections={visibleSectionIds(visible)} />
      </div>
    </SiteShell>
  );
}

/** Resolves a config image value (a path, or a remote URL with a
 * fallback) to a renderable image: base-prefixed source and
 * fallback, plus measured dimensions when the build can read
 * the local file. Null when the value names no image. */
async function sizedImage(
  value: unknown,
  config: PortosaurOptions,
): Promise<SizedImage | null> {
  const rawSrc =
    typeof value === "string"
      ? value
      : (value as { src?: unknown } | null | undefined)?.src;
  if (typeof rawSrc !== "string" || rawSrc === "") {
    return null;
  }
  const base = config.site.baseUrl;
  const fallback =
    typeof value === "object" &&
    value !== null &&
    typeof (value as { fallback?: unknown }).fallback === "string"
      ? withBase((value as { fallback: string }).fallback, base)
      : undefined;
  const dims = await localImageDimensions(rawSrc, staticDirsForConfig(config));
  return {
    src: withBase(rawSrc, base),
    fallback,
    width: dims?.width,
    height: dims?.height,
  };
}
