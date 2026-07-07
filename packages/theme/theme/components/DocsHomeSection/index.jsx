import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useBaseUrlUtils } from "@docusaurus/useBaseUrl";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import { DynamicIcon } from "@theme/components/Icon";
import styles from "./styles.module.css";

export default function DocsHomeSection() {
  const { siteConfig } = useDocusaurusContext();
  const { withBaseUrl } = useBaseUrlUtils();
  const { docsHome } = siteConfig.customFields || {};

  if (!docsHome) {
    return null;
  }

  const { title, tagline, desc, actions, features, icon } = docsHome;

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
                    {action.icon && (
                      <DynamicIcon
                        iconStr={action.icon}
                        className={styles.actionImg}
                      />
                    )}
                    {action.label || action.text}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {icon && (
            <>
              <Head>
                <link
                  rel="preload"
                  as="image"
                  href={withBaseUrl(typeof icon === "string" ? icon : icon.src)}
                />
              </Head>
              <div className={styles.heroIcon}>
                <img
                  src={withBaseUrl(typeof icon === "string" ? icon : icon.src)}
                  alt="Hero"
                  loading="eager"
                  fetchPriority="high"
                  className={styles.icon}
                  onError={
                    typeof icon === "object" && icon.fallback
                      ? (e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = withBaseUrl(icon.fallback);
                        }
                      : undefined
                  }
                />
              </div>
            </>
          )}
        </div>
      </header>

      {features && features.length > 0 && (
        <section className={styles.featuresSection}>
          <div className={styles.featuresContainer}>
            {features.map((feature, index) => (
              <div
                key={index}
                className={styles.featureCard}
                style={{ "--animation-order": index }}
              >
                {feature.icon && (
                  <div className={styles.featureIcon}>
                    <DynamicIcon iconStr={feature.icon} />
                  </div>
                )}
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
