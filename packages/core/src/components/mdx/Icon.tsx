import { SiteIcon } from "../SiteIcon.tsx";

/**
 * Icon — renders a single Iconify icon by id (`md:book`,
 * `fa7-solid:font`, …) as inline SVG, from the site's generated
 * icon map. The `:prefix:name:` shortcode in prose becomes this
 * element (`remarkIcons`).
 */
export function Icon({
  id,
  size,
  color,
  className,
}: {
  /** The icon id, like `lu:star`. */
  id: string;
  /** The icon size, as a CSS length. */
  size?: string;
  /** The icon color. */
  color?: string;
  /** Extra classes on the icon. */
  className?: string;
}) {
  return (
    <span>
      <SiteIcon icon={id} size={size} color={color} className={className} />
    </span>
  );
}
