import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBaseUrlUtils } from "@docusaurus/useBaseUrl";
import Link from "@docusaurus/Link";
import {
  renderIconElement,
  resolveIconFromMap,
} from "../../utils/iconUtils.jsx";
import styles from "./styles.module.css";

export default function DocsHomeSection() {
  const { siteConfig } = useDocusaurusContext();
  const { withBaseUrl } = useBaseUrlUtils();
  const { docsHome } = siteConfig.customFields || {};

  if (!docsHome) {
    return null;
  }

  const { title, tagline, desc, actions, features, image } = docsHome;

  return (
    <div className={styles.docsHome}>
      <header className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>{title}</h1>
            {tagline && <p className={styles.tagline}>{tagline}</p>}
            {desc && <p className={styles.description}>{desc}</p>}

            {actions && actions.length > 0 && (
              <div className={styles.actions}>
                {actions.map((action, index) => (
                  <Link
                    key={index}
                    className={`${styles.button} ${
                      index === 0 ? styles.buttonBrand : styles.buttonAlt
                    }`}
                    to={withBaseUrl(action.link)}
                  >
                    {action.icon &&
                      (() => {
                        const resolved = resolveIconFromMap(action.icon);
                        const iconVal = resolved ? resolved.icon : action.icon;
                        const color = resolved ? resolved.color : undefined;
                        return renderIconElement({
                          iconVal,
                          color,
                          withBaseUrl,
                        });
                      })()}
                    {action.label || action.text}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {image && (
            <div className={styles.heroImage}>
              <img
                src={withBaseUrl(typeof image === "string" ? image : image.src)}
                alt="Hero"
                loading="eager"
                fetchPriority="high"
                className={styles.image}
                onError={
                  typeof image === "object" && image.fallback
                    ? (e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = withBaseUrl(image.fallback);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </header>

      {features && features.length > 0 && (
        <section className={styles.featuresSection}>
          <div className={styles.featuresContainer}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                {feature.icon &&
                  (() => {
                    const resolved = resolveIconFromMap(feature.icon);
                    const iconVal = resolved ? resolved.icon : feature.icon;
                    const color = resolved ? resolved.color : undefined;
                    return (
                      <div className={styles.featureIcon}>
                        {renderIconElement({ iconVal, color, withBaseUrl })}
                      </div>
                    );
                  })()}
                <h2 className={styles.featureTitle}>{feature.title}</h2>
                <p className={styles.featureDesc}>
                  {feature.details || feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
