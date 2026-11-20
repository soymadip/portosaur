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
  icon: DynamicIconValue;
  slug?: string;
  fallbackIcon?: string;
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
