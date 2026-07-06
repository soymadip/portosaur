import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./styles.module.css";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useIsBrowser from "@docusaurus/useIsBrowser";
import Hint from "../Hint";
import DynamicIcon, { techMap } from "@theme/components/DynamicIcon";

const DEFAULT_ICON_ID = "md:help-circle";
const DEFAULT_COLOR = "var(--ifm-color-primary)";

export default function SocialIcons({ showAll = false, links = null }) {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig;
  const isBrowser = useIsBrowser();
  const [animationDelays, setAnimationDelays] = useState({});

  const allSocialLinks = customFields.homePage?.socialSection?.links || [];
  const socialLinks = useMemo(() => {
    if (links) return links;
    return showAll ? allSocialLinks : allSocialLinks.filter((link) => link.pin);
  }, [allSocialLinks, showAll, links]);

  const calculateDelays = useCallback(() => {
    if (!isBrowser) {
      return {};
    }

    const isTablet = window.innerWidth <= 768;
    const isMobile = window.innerWidth <= 480;
    const delays = {};
    const baseDelay = isMobile ? 0.7 : isTablet ? 0.9 : 1.3;
    const incrementDelay = 0.1;
    socialLinks.forEach((_, index) => {
      delays[index] = `${baseDelay + index * incrementDelay}s`;
    });
    return delays;
  }, [isBrowser, socialLinks]);

  useEffect(() => {
    if (!isBrowser) return;
    setAnimationDelays(calculateDelays());
    const handleResize = () => setAnimationDelays(calculateDelays());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isBrowser, calculateDelays]);

  if (socialLinks.length === 0) {
    return null;
  }

  return (
    <div className={styles.socialIcons}>
      {socialLinks.map((social, index) => {
        const href = social.url || "#";
        const slugLower = (social.name || "").toLowerCase();
        const mappedColor = techMap[slugLower]?.color;
        const displayColor =
          social.color || mappedColor || "var(--ifm-color-primary)";

        return (
          <Hint
            key={index}
            msg={social.desc || social.name || social.icon || "Link"}
            top
            bg={displayColor}
            noUl
            gap={17}
          >
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              style={{
                "--hover-color": displayColor,
                animationDelay: animationDelays[index] || "0s",
              }}
              aria-label={social.name || social.icon || "social link"}
            >
              <DynamicIcon
                iconStr={social.icon}
                slug={social.name}
                fallbackIcon="md:help-circle"
                size={24}
              />
            </a>
          </Hint>
        );
      })}
    </div>
  );
}
