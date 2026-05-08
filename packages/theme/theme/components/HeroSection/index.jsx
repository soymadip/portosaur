import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import SocialLinks from "../SocialLinks/index.jsx";
import styles from "./styles.module.css";

export default function HeroSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const brokenLinks = useBrokenLinks();

  if (id) {
    brokenLinks.collectAnchor(id);
  }

  const { customFields } = siteConfig;
  const { heroSection } = customFields;

  const intro = heroSection.intro;
  const title = heroSection.title;
  const subtitle = heroSection.subtitle;
  const profession = heroSection.profession;
  const desc = heroSection.desc;
  const profilePic = heroSection.profilePic;
  const learnMoreButtonText = heroSection.learnMoreButtonTxt;

  return (
    <div
      id={id}
      className={`${styles.hero} ${className || ""}`}
      role="region"
      aria-label="Hero section"
    >
      <div className={styles.container}>
        {/* Left: text content */}
        <div className={styles.leftSection}>
          <p className={styles.intro}>{intro}</p>

          <h1 className={styles.title}>
            {title}
            <span className={styles.titleComma}>,</span>
          </h1>

          <div className={styles.subtitleWrapper}>
            <span className={styles.subtitle}>{subtitle}</span>
            <h2 className={styles.profession}>{profession}</h2>
            <span className={styles.subtitle}>.</span>
          </div>

          <p className={styles.description}>{desc}</p>

          <div className={styles.actionRow}>
            <div className={styles.cta}>
              <a
                href="#about"
                className={styles.ctaButton}
                aria-label="Learn more about me"
              >
                {learnMoreButtonText}
              </a>
            </div>
            <SocialLinks links={heroSection.social} />
          </div>
        </div>

        {/* Right: profile picture */}
        <div className={styles.rightSection}>
          <img
            src={`${profilePic}`}
            alt="profile"
            className={styles.profilePic}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
