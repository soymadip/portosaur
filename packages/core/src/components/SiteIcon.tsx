"use client";

import { useSiteIcons } from "../lib/porto-context.tsx";
import { resolveSiteIcon, type DynamicIconValue } from "../lib/site-icons.ts";

/**
 * Renders a frontmatter/config icon value as a real element: an
 * inline SVG from the site's icon map, an emoji, an image (its
 * fallback swaps in on error), or raw SVG passed through.
 * Nothing renders when the value resolves to no icon. The map
 * comes from the root layout's provider.
 */
export function SiteIcon({
  icon,
  slug,
  fallbackIcon,
  base,
  size,
  color,
  className,
  strokeWidth,
}: {
  icon?: DynamicIconValue;
  slug?: string;
  fallbackIcon?: string;
  base?: string;
  size?: string;
  color?: string;
  className?: string;
  /** Overrides the pack's stroke width (stroke icons only). */
  strokeWidth?: number;
}) {
  const icons = useSiteIcons();
  const resolved = resolveSiteIcon(icon, { slug, fallbackIcon, base }, icons);
  if (!resolved) {
    return null;
  }
  if (resolved.kind === "icon") {
    const data = icons[resolved.id];
    if (!data) {
      return null;
    }
    const body = strokeWidth
      ? data.body.replaceAll(
          'stroke-width="2"',
          `stroke-width="${strokeWidth}"`,
        )
      : data.body;
    const style: React.CSSProperties = {};
    if (size) {
      style.fontSize = size;
    }
    if (color) {
      style.color = color;
    }
    return (
      <svg
        viewBox={data.viewBox}
        width="1em"
        height="1em"
        fill="currentColor"
        aria-hidden="true"
        className={className}
        style={Object.keys(style).length > 0 ? style : undefined}
        dangerouslySetInnerHTML={{ __html: body }}
      />
    );
  }
  if (resolved.kind === "emoji") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        role="img"
        aria-hidden="true"
      >
        {resolved.value}
      </span>
    );
  }
  if (resolved.kind === "svg") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: resolved.html }}
      />
    );
  }
  return (
    <img
      src={resolved.src}
      alt="icon"
      /* Image-file icons (project tiles, contact icons) sit
         below the fold, so they load lazily instead of
         competing with the hero for bandwidth. */
      loading="lazy"
      decoding="async"
      onError={
        resolved.fallback
          ? (event) => {
              const target = event.currentTarget;
              target.onerror = null;
              target.src = resolved.fallback as string;
            }
          : undefined
      }
    />
  );
}
