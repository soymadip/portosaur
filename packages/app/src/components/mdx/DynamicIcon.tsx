import { renderDynamicIcon } from "../../lib/icons.ts";
import type { DynamicIconValue } from "../../lib/icons.ts";

/**
 * DynamicIcon — renders a frontmatter `icon` value, which may be
 * an Iconify id, a local image path, a remote URL, or an emoji.
 * Server component (see `Icon` for why).
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
    <span
      dangerouslySetInnerHTML={{
        __html: renderDynamicIcon(icon, { slug, fallbackIcon, size }),
      }}
    />
  );
}
