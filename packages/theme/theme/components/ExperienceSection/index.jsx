import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import styles from "./styles.module.css";

export default function ExperienceSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const brokenLinks = useBrokenLinks();

  if (id) {
    brokenLinks.collectAnchor(id);
  }

  const experience = siteConfig.customFields?.experienceSection || {};

  if (experience.enable === false) {
    return null;
  }

  const displayHeading = experience.heading;
  const displaySubheading = experience.subheading;

  return (
    <div
      id={id}
      className={`${styles.experienceSection} ${className || ""}`}
      role="region"
      aria-label="Experience section"
    >
      <div className={styles.experienceContainer}>
        {/* Heading */}
        <div className={styles.experienceHeader}>
          <h2 className={styles.experienceTitle}>{displayHeading}</h2>
          <p className={styles.experienceSubtitle}>{displaySubheading}</p>
        </div>

        {/* Placeholder */}
        <div className={styles.noticeWrapper}>
          <div className={styles.noticeBox} role="status" aria-live="polite">
            <p className={styles.noticeText}>Coming Soon!</p>
            <p className={styles.noticeDesc}>
              This section is under construction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
