import { renderIcon } from "../../lib/icons.ts";

/**
 * Icon — renders a single Iconify icon by id (`md:book`,
 * `fa7-solid:font`, …) as inline SVG. Server component: the icon
 * packs are megabytes of JSON and must never be imported from a
 * client component.
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
    <span
      dangerouslySetInnerHTML={{
        __html: renderIcon(id, { size, color, className }),
      }}
    />
  );
}
