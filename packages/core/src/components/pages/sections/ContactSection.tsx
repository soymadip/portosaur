import type { CSSProperties } from "react";
import {
  isContactVisible,
  socialIconColor,
  sortEmailFirst,
  type SocialLink,
} from "../../../lib/portfolio-home.ts";
import { SiteIcon } from "../../SiteIcon.tsx";

/** The social section's config, as `buildSiteConfig` delivers it. */
export interface SocialData {
  enable?: boolean;
  heading?: string;
  subheading?: string;
  links?: SocialLink[];
}

/**
 * ContactSection — the social links as a grid of cards, one per
 * link: icon, name, description. Email links come first. The
 * icon shows in the site accent and takes the link's own `color`
 * (or the icon map's brand color for the site name) on hover.
 * Hidden when disabled or empty.
 */
export function ContactSection({ social }: { social: SocialData }) {
  if (!isContactVisible(social)) {
    return null;
  }
  const links = sortEmailFirst(
    (social.links ?? []).filter(
      (link): link is SocialLink & { url: string } =>
        typeof link.url === "string" && link.url !== "",
    ),
  );
  if (links.length === 0) {
    return null;
  }
  return (
    <section
      id="contact"
      className="porto-contact-section"
      role="region"
      aria-label="Contact section"
    >
      <div className="porto-contact__container">
        <div className="porto-contact__header">
          <h2 className="porto-contact__heading">
            {social.heading || "Get In Touch"}
          </h2>
          {social.subheading && (
            <p className="porto-contact__subheading">{social.subheading}</p>
          )}
        </div>
        <div
          className="porto-contact__grid"
          role="list"
          aria-label="Social media and contact links"
        >
          {links.map((link, index) => {
            const name = link.name || "";
            const desc = link.desc || `Connect with me on ${name}`;
            const hoverColor = socialIconColor(link);
            return (
              <a
                key={name || link.url || index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="porto-contact__card"
                style={
                  hoverColor
                    ? ({ "--icon-hover-color": hoverColor } as CSSProperties)
                    : undefined
                }
                aria-label={`Connect with me on ${name}: ${desc}`}
                role="listitem"
              >
                <div className="porto-contact__icon">
                  <SiteIcon
                    icon={link.icon}
                    slug={name}
                    fallbackIcon="lu:circle-help"
                  />
                </div>
                <h3 className="porto-contact__name">{name}</h3>
                <p className="porto-contact__desc">{desc}</p>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
