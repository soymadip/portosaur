import useBaseUrl from "@docusaurus/useBaseUrl";
import { iconMap } from "../config/iconMappings.jsx";

/**
 * Resolves an icon string against the iconMap.
 * Returns the iconMap entry ({ icon, color }) if found,
 * or an object with the raw string as icon if not in the map,
 * or null if no iconStr is provided.
 *
 * @param {string|null|undefined} iconStr - The icon identifier from frontmatter
 * @returns {{ icon: any, color?: string } | null}
 */
export function resolveIconFromMap(iconStr) {
  if (!iconStr) {
    return null;
  }

  const entry = iconMap[iconStr.toLowerCase()];
  if (entry) {
    return entry;
  }

  return null;
}

/**
 * Renders a JSX icon element from a resolved icon value.
 * Supports React components, image URLs, raw SVG strings, and emoji/text.
 *
 * @param {object} options
 * @param {any} options.iconVal - The resolved icon value (component, string URL, SVG, text)
 * @param {string} [options.color] - CSS color to apply to React component icons
 * @param {string} [options.className] - CSS class for the rendered element
 * @param {object} [options.style] - Inline styles for the rendered element
 * @param {string} [options.alt] - Alt text for img icons
 * @returns {JSX.Element|string|null}
 */
export function renderIconElement({
  iconVal,
  color,
  className,
  style,
  alt = "",
  withBaseUrl,
}) {
  if (!iconVal) {
    return null;
  }

  if (
    typeof iconVal === "function" ||
    (typeof iconVal === "object" &&
      iconVal !== null &&
      !iconVal.src &&
      !iconVal.fallback)
  ) {
    const IconComp = iconVal;
    return (
      <IconComp
        className={className}
        style={{ color: color || "var(--ifm-color-primary)", ...style }}
      />
    );
  }

  const isFallbackObj =
    typeof iconVal === "object" &&
    iconVal !== null &&
    (iconVal.src || iconVal.fallback);

  const iconStr = isFallbackObj ? iconVal.src : iconVal;

  if (typeof iconStr === "string") {
    if (iconStr.startsWith("/") || iconStr.startsWith("http")) {
      const resolveUrl = withBaseUrl || ((url) => url);
      const imgSrc = iconStr.startsWith("/") ? resolveUrl(iconStr) : iconStr;

      return (
        <img
          src={imgSrc}
          className={className}
          width="24"
          height="24"
          style={style}
          alt={alt}
          onError={
            isFallbackObj && iconVal.fallback
              ? (e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = resolveUrl(iconVal.fallback);
                }
              : undefined
          }
        />
      );
    }

    if (iconVal.trim().startsWith("<svg")) {
      return (
        <div
          className={className}
          style={style}
          dangerouslySetInnerHTML={{ __html: iconVal }}
          aria-hidden="true"
        />
      );
    }

    return (
      <span className={className} style={style}>
        {iconVal}
      </span>
    );
  }

  return null;
}
