import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { iconMap } from "../../config/iconMappings";
import { FaQuestionCircle } from "react-icons/fa";
import useScrollReveal from "../../hooks/useScrollReveal";
import useBrokenLinks from "@docusaurus/useBrokenLinks";
import styles from "./styles.module.css";

// Sort so email links appear first in the contact grid
const sortEmail = (links) => {
  return [...links].sort((a, b) => {
    const isEmailA =
      a.url?.startsWith("mailto:") ||
      a.icon?.toLowerCase().includes("email") ||
      a.name?.toLowerCase().includes("email");
    const isEmailB =
      b.url?.startsWith("mailto:") ||
      b.icon?.toLowerCase().includes("email") ||
      b.name?.toLowerCase().includes("email");
    if (isEmailA && !isEmailB) return -1;
    if (!isEmailA && isEmailB) return 1;
    return 0;
  });
};

export default function ContactSection({ id, className }) {
  const { siteConfig } = useDocusaurusContext();
  const brokenLinks = useBrokenLinks();

  if (id) {
    brokenLinks.collectAnchor(id);
  }

  const { customFields } = siteConfig;
  const socialLinksConfig = customFields.socialLinks || {};

  if (socialLinksConfig.enable === false) {
    return null;
  }

  let socialLinks = socialLinksConfig.links || [];
  const displayHeading = socialLinksConfig.heading;
  const displaySubheading = socialLinksConfig.subheading;
  const [sectionRef, isVisible] = useScrollReveal();

  socialLinks = sortEmail(socialLinks);

  return (
    <div
      id={id}
      ref={sectionRef}
      className={`${styles.contactSection} ${isVisible ? "is-visible" : ""} ${className || ""}`}
      role="region"
      aria-label="Contact section"
    >
      <div className={styles.contactContainer}>
        {/* Heading */}
        <div className={styles.contactHeader}>
          <h2 className={styles.contactTitle}>{displayHeading}</h2>
          <p className={styles.contactSubtitle}>{displaySubheading}</p>
        </div>

        {/* Social cards grid */}
        <div className={styles.gridWrapper}>
          <div
            className={styles.socialGrid}
            role="list"
            aria-label="Social media and contact links"
          >
            {socialLinks.map((social, index) => {
              const iconKey = (social.icon || social.name || "").toLowerCase();
              const iconData = iconMap[iconKey] || {};
              const name = social.name;
              const Icon = iconData.icon || FaQuestionCircle;
              const iconColor = iconData.color || "var(--ifm-color-primary)";
              const desc = social.desc || `Connect with me on ${name}`;
              const url = social.url;

              return (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialCard}
                  style={{
                    "--card-index": index,
                    "--icon-hover-color": iconColor,
                  }}
                  aria-label={`Connect with me on ${name}: ${desc}`}
                  role="listitem"
                >
                  {Icon && (
                    <div className={styles.socialIcon}>
                      <Icon aria-hidden="true" />
                    </div>
                  )}
                  <h3 className={styles.socialTitle}>{name}</h3>
                  <p className={styles.socialDesc}>{desc}</p>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
