import { isExperienceVisible } from "../../../lib/portfolio-home.ts";

/** One timeline entry, as the config delivers it. */
export interface ExperienceEntry {
  company?: string;
  role?: string;
  duration?: string;
  desc?: string;
}

/** The experience section's config, as `buildSiteConfig` delivers it. */
export interface ExperienceData {
  enable?: boolean;
  heading?: string;
  subheading?: string;
  list?: ExperienceEntry[];
}

/**
 * ExperienceSection — a vertical timeline of jobs, newest first
 * (the list order in config). The old site never built this
 * section — it showed a "Coming Soon" box — so the timeline is
 * new. Hidden when disabled (it defaults off) or empty.
 */
export function ExperienceSection({
  experience,
}: {
  experience: ExperienceData;
}) {
  if (!isExperienceVisible(experience)) {
    return null;
  }
  const entries = experience.list ?? [];
  return (
    <section
      id="experience"
      className="porto-experience-section"
      role="region"
      aria-label="Experience section"
    >
      <div className="porto-experience__container">
        <div className="porto-experience__header">
          <h2 className="porto-experience__heading">
            {experience.heading || "Experience"}
          </h2>
          {experience.subheading && (
            <p className="porto-experience__subheading">
              {experience.subheading}
            </p>
          )}
        </div>
        <ol className="porto-experience__timeline">
          {entries.map((entry, index) => (
            <li key={entry.company || index} className="porto-experience__item">
              <div className="porto-experience__marker" aria-hidden="true" />
              <div className="porto-experience__body">
                {entry.role && (
                  <h3 className="porto-experience__role">{entry.role}</h3>
                )}
                <p className="porto-experience__meta">
                  {entry.company && (
                    <span className="porto-experience__company">
                      {entry.company}
                    </span>
                  )}
                  {entry.company && entry.duration && (
                    <span className="porto-experience__separator"> · </span>
                  )}
                  {entry.duration && (
                    <span className="porto-experience__duration">
                      {entry.duration}
                    </span>
                  )}
                </p>
                {entry.desc && (
                  <p className="porto-experience__desc">{entry.desc}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
