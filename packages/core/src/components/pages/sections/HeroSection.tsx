import { PAGE_TITLE_ID } from "../../../lib/docPage.ts";
import type { SizedImage, SocialLink } from "../../../lib/portfolio-home.ts";
import { HashLink } from "../../HashLink.tsx";
import { HeroImage } from "../HeroImage.tsx";
import { SocialLinks } from "./SocialLinks.tsx";

/** The hero section's config, as `buildSiteConfig` delivers it. */
export interface HeroData {
  intro?: string;
  title?: string;
  subtitle?: string;
  profession?: string;
  desc?: string;
  learnMoreButtonTxt?: string;
  social?: SocialLink[];
}

/**
 * HeroSection — the portfolio home's opening: intro line, name
 * as the page H1 (with the OG's trailing comma), subtitle +
 * profession, a short description, a "Learn More" button jumping
 * to the next visible section, the social icon row, and the
 * profile picture on the side. The hero always shows — it has
 * no enable key.
 */
export function HeroSection({
  hero,
  nextId,
  profilePic,
}: {
  hero: HeroData;
  /** The anchor id "Learn More" jumps to, or null when no
   * section below the hero renders. */
  nextId: string | null;
  profilePic: SizedImage | null;
}) {
  return (
    <section
      id="me"
      className="porto-hero-section"
      role="region"
      aria-label="Hero section"
    >
      <div className="porto-hero__container">
        <div className="porto-hero__text">
          {hero.intro && <p className="porto-hero__intro">{hero.intro}</p>}
          <h1 className="porto-hero__title" id={PAGE_TITLE_ID}>
            {hero.title}
            <span className="porto-hero__comma">,</span>
          </h1>
          <div className="porto-hero__subtitle-row">
            {hero.subtitle && (
              <span className="porto-hero__subtitle">{hero.subtitle}</span>
            )}
            {hero.profession && (
              <h2 className="porto-hero__profession">{hero.profession}</h2>
            )}
            <span className="porto-hero__subtitle">.</span>
          </div>
          {hero.desc && <p className="porto-hero__desc">{hero.desc}</p>}
          <div className="porto-hero__actions">
            {nextId && (
              <HashLink
                href={`#${nextId}`}
                className="porto-hero__cta"
                ariaLabel="Learn more about me"
              >
                {hero.learnMoreButtonTxt || "Learn More"}
              </HashLink>
            )}
            <SocialLinks links={hero.social} />
          </div>
        </div>
        {profilePic && (
          <div className="porto-hero__picture">
            <HeroImage
              src={profilePic.src}
              fallback={profilePic.fallback}
              width={profilePic.width}
              height={profilePic.height}
              alt="profile"
            />
          </div>
        )}
      </div>
    </section>
  );
}
