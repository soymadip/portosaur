import type { CSSProperties } from "react";
import {
  socialIconColor,
  type SocialLink,
} from "../../../lib/portfolio-home.ts";
import { SiteIcon } from "../../SiteIcon.tsx";

/**
 * SocialLinks — the hero's row of social icons, from
 * `home_page.hero.social`. Each link shows its icon (an explicit
 * `icon` value, or the icon map's guess from the name) with the
 * name as the tooltip. The icons show in the site accent and
 * take the link's brand color on hover. Links without a URL
 * render nothing.
 */
export function SocialLinks({ links }: { links?: SocialLink[] }) {
  const shown = (links ?? []).filter(
    (link): link is SocialLink & { url: string } =>
      typeof link.url === "string" && link.url !== "",
  );
  if (shown.length === 0) {
    return null;
  }
  return (
    <div className="porto-social-links" role="list" aria-label="Social links">
      {shown.map((link, index) => {
        const hoverColor = socialIconColor(link);
        return (
          <a
            key={link.name || link.url || index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="porto-social-links__link"
            style={
              hoverColor
                ? ({ "--hover-color": hoverColor } as CSSProperties)
                : undefined
            }
            title={link.name}
            aria-label={link.name ? `Open ${link.name}` : "Open social link"}
            role="listitem"
          >
            <SiteIcon
              icon={link.icon}
              slug={link.name}
              fallbackIcon="lu:circle-help"
              size="1.5rem"
            />
          </a>
        );
      })}
    </div>
  );
}
