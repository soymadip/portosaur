import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import SocialLinks from "@site/src/components/SocialLinks";
import styles from './styles.module.css';

export default function HeroSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig;

  const intro = customFields.heroSection.intro;
  const title = customFields.heroSection.title;
  const subtitle = customFields.heroSection.subtitle;
  const profession = customFields.heroSection.profession;
  const description = customFields.heroSection.description;
  const profilePic = customFields.heroSection.profilePic;
  const learnMoreButtonText = customFields.heroSection.learnMoreButtonTxt;

  return (
    <div
        className={`${styles.hero} ${className || ''}`}
        id={id} 
        role="region" 
        aria-label="Hero section"
    >
      <div className={styles.container}>
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
          <p className={styles.description}>
            {description}
          </p>
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
            <SocialLinks />
          </div>
        </div>
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
