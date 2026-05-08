import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useScrollReveal from "../../hooks/useScrollReveal";
import { FaDownload } from "react-icons/fa";
import { Pv } from "../Preview/index.jsx";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import styles from "./styles.module.css";

export default function AboutSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const brokenLinks = useBrokenLinks();

  if (id) {
    brokenLinks.collectAnchor(id);
  }

  const { customFields } = siteConfig;
  const aboutMe = customFields.aboutSection || {};

  if (aboutMe.enable === false) {
    return null;
  }

  const [sectionRef, isVisible] = useScrollReveal();

  return (
    <div
      id={id}
      ref={sectionRef}
      className={`${styles.aboutSection} ${isVisible ? "is-visible" : ""} ${className || ""}`}
      role="region"
      aria-label="About me section"
    >
      <div className={styles.aboutContainer}>
        {/* Heading */}
        <div className={styles.aboutHeader}>
          <h2 className={styles.aboutHeading}>
            {aboutMe.heading || "About Me"}
          </h2>
        </div>

        {/* Content */}
        <div className={styles.aboutContent}>
          <div className={styles.aboutCard}>
            {/* Image + Resume */}
            <div className={styles.bioImageContainer}>
              {aboutMe.image && (
                <div className={styles.imageWrapper}>
                  <img
                    src={aboutMe.image}
                    alt={aboutMe.name || "About Me"}
                    className={styles.aboutImage}
                  />
                </div>
              )}
              {aboutMe.resume && (
                <div className={styles.resumeContainer}>
                  <Pv href={aboutMe.resume} title="My Resume">
                    <span className={styles.resumeButton}>
                      <FaDownload /> View Resume
                    </span>
                  </Pv>
                </div>
              )}
            </div>

            {/* Bio + Skills */}
            <div className={styles.bioTextContainer}>
              <div className={styles.bioText}>
                {Array.isArray(aboutMe.bio) ? (
                  aboutMe.bio.map((paragraph, index) => (
                    <p key={index} className={styles.aboutParagraph}>
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className={styles.aboutParagraph}>{aboutMe.bio}</p>
                )}
              </div>

              {aboutMe.skills && aboutMe.skills.length > 0 && (
                <div className={styles.skillsContainer}>
                  <h3 className={styles.skillsTitle}>
                    {aboutMe.skillsHeading || "My Skills"}
                  </h3>
                  <div className={styles.skillsGrid}>
                    {aboutMe.skills.map((skill, index) => (
                      <span
                        key={index}
                        className={styles.skillTag}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
