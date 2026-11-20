import {
  PortoIcons,
  type PortoIcon as PortoIconName,
} from "../lib/porto-icons.ts";

/**
 * A built-in Portosaur icon — the small icons the chrome itself
 * needs (theme select, sidebar carets, edit link). Renders an
 * inline `<svg>` from `lib/porto-icons.ts`, generated from the
 * Iconify packs.
 *
 * Content icons (frontmatter `icon`, note cards, feature icons) do
 * NOT come from here — those resolve through the generated site
 * icon map (`lib/site-icons.ts`) at build time. See the `Icon`
 * MDX component.
 */
export function PortoIcon({
  name,
  size = "1em",
  className,
  strokeWidth,
}: {
  name: PortoIconName;
  size?: string;
  className?: string;
  /** Overrides the pack's stroke width (stroke icons only). */
  strokeWidth?: number;
}) {
  const body = strokeWidth
    ? PortoIcons[name].replaceAll('stroke-width="2"', `stroke-width="${strokeWidth}"`)
    : PortoIcons[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export type { PortoIconName };
