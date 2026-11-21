import { SiteIcon } from "../SiteIcon.tsx";
import type { DynamicIconValue } from "../../lib/site-icons.ts";

/**
 * DynamicIcon — renders a frontmatter `icon` value, which may be
 * an Iconify id, a local image path, a remote URL, or an emoji.
 */
export function DynamicIcon({
  icon,
  slug,
  fallbackIcon,
  size,
}: {
  /** The icon value — an id, an emoji, or an image source. */
  icon: DynamicIconValue;
  /** Guesses an icon from the page slug when no icon is given. */
  slug?: string;
  /** Shown when the icon cannot be resolved. */
  fallbackIcon?: string;
  /** The icon size, as a CSS length. */
  size?: string;
}) {
  return (
    <span>
      <SiteIcon
        icon={icon}
        slug={slug}
        fallbackIcon={fallbackIcon}
        size={size}
      />
    </span>
  );
}
