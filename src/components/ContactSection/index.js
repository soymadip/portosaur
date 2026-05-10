import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { iconMap } from "@site/src/config/iconMappings";
import { FaQuestionCircle } from "react-icons/fa";
import styles from './styles.module.css';

const sortEmail = (links) => {
  return [...links].sort((a, b) => {
    const isEmailA = a.url?.startsWith('mailto:') || 
                    a.icon?.toLowerCase().includes('email') || 
                    a.name?.toLowerCase().includes('email');

    const isEmailB = b.url?.startsWith('mailto:') || 
                    b.icon?.toLowerCase().includes('email') || 
                    b.name?.toLowerCase().includes('email');

    if (isEmailA && !isEmailB) return -1;
    if (!isEmailA && isEmailB) return 1;

    return 0;
  });
};

export default function ContactSection({ id, className, title, subtitle }) {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig;
  let socialLinks = customFields.socialLinks.links || [];
  
  socialLinks = sortEmail(socialLinks);

  return (
    <div id={id} className={`${styles.contactSection} ${className || ''}`} role="region" aria-label="Contact section">
      <div className={styles.contactContainer}>
        <div className={styles.contactHeader}>
          <h2 className={styles.contactTitle}>
            {title || "Get In Touch"}
          </h2>
          <p className={styles.contactSubtitle}>
            {subtitle || "Feel free to reach out for collaborations, questions, or just to say hello!"}
          </p>
        </div>
        
        {/* SocialCard */}
        <div className={styles.gridWrapper}>
          <div className={styles.socialGrid} role="list" aria-label="Social media and contact links">
            {socialLinks.map((social, index) => {
              const iconData = iconMap[social.icon] || {};
              
              const name = social.name || "?";
              const Icon = iconData.icon || FaQuestionCircle;
              const iconColor = iconData.color || "var(--ifm-color-primary)";
              const description = name === "?" ? "" : (social.desc || `Connect with me on ${name}`);
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
                  aria-label={`Connect with me on ${name}: ${description}`}
                  role="listitem"
                >
                  {Icon && (
                    <div className={styles.socialIcon}>
                      <Icon aria-hidden="true" />
                    </div>
                  )}
                  <h3 className={styles.socialTitle}>
                    {name}
                  </h3>
                  <p className={styles.socialDesc}>
                    {description}
                  </p>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
