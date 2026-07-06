import { useBaseUrlUtils } from "@docusaurus/useBaseUrl";
import { usePluginData } from "@docusaurus/useGlobalData";
import Icon, { techMap } from "@theme/components/Icon";

export { techMap };

/**
 * A highly robust Icon component that resolves icons from frontmatter strings,
 * including raw SVGs, image paths, mapped devicons via techMap, and fallback options.
 *
 * @param {object} props
 * @param {string|object} props.iconStr - The raw icon string/object from frontmatter
 * @param {string} props.slug - The slug/identifier used to guess devicons
 * @param {string} props.fallbackIcon - The Iconify ID to use if nothing else is found
 * @param {string} props.className - CSS classes to apply
 * @param {object} props.style - Inline styles to apply
 */
export default function DynamicIcon({
  iconStr,
  slug,
  fallbackIcon,
  className,
  style,
  ...props
}) {
  const { withBaseUrl } = useBaseUrlUtils();
  const generatedIcons = usePluginData("portosaur-icons-plugin") || {};

  let resolvedElement = null;

  if (iconStr) {
    if (typeof iconStr === "string" && iconStr.trim().startsWith("<svg")) {
      // 1. Raw Inline SVG Support
      resolvedElement = (
        <span
          className={className}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            ...style,
          }}
          dangerouslySetInnerHTML={{ __html: iconStr }}
          aria-hidden="true"
          {...props}
        />
      );
    } else if (
      typeof iconStr === "object" ||
      iconStr.includes(".") ||
      iconStr.includes("/")
    ) {
      // 2. Image Path / SVG File Support
      const src = typeof iconStr === "string" ? iconStr : iconStr.src;
      resolvedElement = (
        <img
          src={withBaseUrl(src)}
          alt="icon"
          className={className}
          style={style}
          {...props}
        />
      );
    } else {
      // 3. Explicit Iconify ID Support (e.g. "md:home")
      resolvedElement = (
        <Icon id={iconStr} className={className} style={style} {...props} />
      );
    }
  } else if (slug) {
    // 4. Devicon Guessing via techMap or dynamic devicon
    const slugLower = slug.toLowerCase();

    if (techMap[slugLower]) {
      resolvedElement = (
        <Icon
          id={techMap[slugLower].icon}
          className={className}
          style={style}
          {...props}
        />
      );
    } else {
      const potentialDevicon = `di:${slugLower}`;
      if (generatedIcons[potentialDevicon]) {
        resolvedElement = (
          <Icon
            id={potentialDevicon}
            className={className}
            style={style}
            {...props}
          />
        );
      }
    }
  }

  // 5. Final Fallback
  if (!resolvedElement) {
    resolvedElement = (
      <Icon id={fallbackIcon} className={className} style={style} {...props} />
    );
  }

  return resolvedElement;
}
