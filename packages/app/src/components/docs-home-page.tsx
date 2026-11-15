import Link from "next/link";
import type { PortosaurOptions } from "../lib/config.ts";
import { PAGE_TITLE_ID } from "../lib/docPage.ts";
import { renderDynamicIcon, withBase } from "../lib/icons.ts";
import {
  localImageDimensions,
  staticDirsForConfig,
} from "../lib/image-size.ts";
import { pageHref } from "../lib/pageUrl.ts";
import { HeroImage } from "./HeroImage.tsx";
import { SiteShell } from "./SiteShell.tsx";

/**
 * DocsHomePage — the docs landing: OG two-column hero (text left,
 * image right + primary glow) + feature cards, from
 * `config.docsHome`. A port of the Astro DocsHomeSection (OG's
 * Docusaurus page translated to the token system).
 *
 * `docsHome` shape: `{ title, tagline?, desc?, icon?: string |
 * { src, fallback? }, actions?: [{ label|text, link, icon? }],
 * features?: [{ title, details|desc, icon?, link? }] }`. The
 * first action is brand, the rest alt; feature titles stay `<h2>`
 * (OG uses h2, and the heading list in the URL snapshots expects
 * it).
 *
 * Async: the hero image is sized from the local file when the
 * build can read it (remote URLs and unsizable files fall back
 * to 400×400 via `HeroImage`).
 */
export async function DocsHomePage({ config }: { config: PortosaurOptions }) {
  const docsHome = config.docsHome;
  const base = config.site.baseUrl;
  const icon = docsHome?.icon;
  const iconRawSrc = icon
    ? typeof icon === "string"
      ? icon
      : (icon.src as string | undefined)
    : null;
  const iconSrc = iconRawSrc ? withBase(iconRawSrc, base) : null;
  const iconFallback =
    icon && typeof icon === "object" && icon.fallback
      ? withBase(icon.fallback as string, base)
      : undefined;
  const iconDims = iconRawSrc
    ? await localImageDimensions(iconRawSrc, staticDirsForConfig(config))
    : null;

  if (!docsHome) {
    return null;
  }
  return (
    <SiteShell config={config} isHome>
      <div className="docs-home">
        <header className="hero-section">
          <div className="hero-container">
            <div className="hero-text">
              <h1 className="title" id={PAGE_TITLE_ID}>
                {docsHome.title}
              </h1>
              {docsHome.tagline && (
                <p className="tagline">{docsHome.tagline}</p>
              )}
              {docsHome.desc && <p className="description">{docsHome.desc}</p>}
              {docsHome.actions && docsHome.actions.length > 0 && (
                <div className="actions">
                  {docsHome.actions.map((action: any, index: number) => {
                    const href = pageHref(withBase(action.link, base));
                    const external = /^[a-z][a-z0-9+.-]*:/i.test(action.link);
                    const className = `button ${index === 0 ? "button-brand" : "button-alt"}`;
                    const inner = (
                      <>
                        {action.icon && (
                          <span
                            className="action-img"
                            dangerouslySetInnerHTML={{
                              __html: renderDynamicIcon(action.icon, { base }),
                            }}
                          />
                        )}
                        {action.label || action.text}
                      </>
                    );
                    return external ? (
                      <a
                        key={action.label || action.text || index}
                        href={href}
                        className={className}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inner}
                      </a>
                    ) : (
                      <Link
                        key={action.label || action.text || index}
                        href={href}
                        className={className}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            {icon && iconSrc && (
              <div className="hero-icon">
                <HeroImage
                  src={iconSrc}
                  fallback={iconFallback}
                  width={iconDims?.width}
                  height={iconDims?.height}
                />
              </div>
            )}
          </div>
        </header>

        {docsHome.features && docsHome.features.length > 0 && (
          <section className="features-section">
            <div className="features-container">
              {docsHome.features.map((feature: any, index: number) => {
                const inner = (
                  <>
                    {feature.icon && (
                      <div
                        className="feature-icon"
                        dangerouslySetInnerHTML={{
                          __html: renderDynamicIcon(feature.icon, { base }),
                        }}
                      />
                    )}
                    <div className="feature-content">
                      <h2 className="feature-title">{feature.title}</h2>
                      <p className="feature-desc">
                        {feature.details || feature.desc}
                      </p>
                    </div>
                  </>
                );
                const style = {
                  "--animation-order": index,
                } as React.CSSProperties;
                return feature.link ? (
                  <Link
                    key={feature.title}
                    href={pageHref(withBase(feature.link, base))}
                    className="feature-card"
                    style={style}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={feature.title}
                    className="feature-card"
                    style={style}
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
