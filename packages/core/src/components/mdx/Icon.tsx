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
  id: string;
  size?: string;
  color?: string;
  className?: string;
}) {
  return (
    <span>
      <SiteIcon icon={id} size={size} color={color} className={className} />
    </span>
  );
}
