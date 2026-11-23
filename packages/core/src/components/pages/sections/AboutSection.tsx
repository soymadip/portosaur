import {
  bioParagraphs,
  isAboutVisible,
  isResumeFile,
  type SizedImage,
} from "../../../lib/portfolio-home.ts";
import { Pv } from "../../mdx/Pv.tsx";
import { SiteIcon } from "../../SiteIcon.tsx";
import { HeroImage } from "../HeroImage.tsx";

/** The about section's config, as `buildSiteConfig` delivers it. */
export interface AboutData {
  enable?: boolean;
  heading?: string;
  name?: string;
  bio?: unknown;
  skills?: unknown;
  skillsHeading?: string;
  resume?: unknown;
}

/**
 * AboutSection — the old home's card: a rounded panel with the
 * photo (falling back to the hero profile picture at the config
 * level) and a "View Resume" button in a tinted column on the
 * side, and the bio paragraphs and skills tag grid beside it.
 * Hidden when disabled or when it has nothing to show.
 */
export function AboutSection({
  about,
  image,
}: {
  about: AboutData;
  image: SizedImage | null;
}) {
  if (!isAboutVisible(about)) {
    return null;
  }
  const paragraphs = bioParagraphs(about.bio);
  const skills = Array.isArray(about.skills)
    ? about.skills.filter((skill): skill is string => typeof skill === "string")
    : [];
  const resume = isResumeFile(about.resume) ? (about.resume as string) : null;
  return (
    <section
      id="about"
      className="porto-about-section"
      role="region"
      aria-label="About me section"
    >
      <div className="porto-about__container">
        <div className="porto-about__header">
          <h2 className="porto-about__heading">
            {about.heading || "About Me"}
          </h2>
        </div>
        <div className="porto-about__card">
          <div className="porto-about__image-col">
            {image && (
              <div className="porto-about__image-wrap">
                <HeroImage
                  src={image.src}
                  fallback={image.fallback}
                  width={image.width}
                  height={image.height}
                  alt={about.name || "About Me"}
                />
              </div>
            )}
            {resume && (
              <div className="porto-about__resume">
                <Pv href={resume}>
                  <span className="porto-about__resume-button">
                    <SiteIcon icon="lu:download" size="1rem" />
                    View Resume
                  </span>
                </Pv>
              </div>
            )}
          </div>
          <div className="porto-about__text-col">
            <div className="porto-about__text">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="porto-about__paragraph">
                  {paragraph}
                </p>
              ))}
            </div>
            {skills.length > 0 && (
              <div className="porto-about__skills">
                <h3 className="porto-about__skills-title">
                  {about.skillsHeading || "My Skills"}
                </h3>
                <div className="porto-about__skills-grid">
                  {skills.map((skill, index) => (
                    <span key={index} className="porto-about__skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
