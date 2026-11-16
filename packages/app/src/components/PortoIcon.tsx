import {
  PortoIcons,
  type PortoIcon as PortoIconName,
} from "../lib/porto-icons.ts";

/**
 * A built-in Portosaur icon — the small SVG paths the chrome itself
 * needs (theme select, sidebar carets, pagination arrows, edit
 * link). Renders an inline `<svg>` from `lib/porto-icons.ts`.
 *
 * Content icons (frontmatter `icon`, note cards, feature icons) do
 * NOT come from here — those resolve through `lib/icons.ts`
 * (Iconify packs) at build time; see the `Icon` MDX component.
 */
export function PortoIcon({
  name,
  size = "1em",
  className,
}: {
  name: PortoIconName;
  size?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: PortoIcons[name] }}
    />
  );
}

export type { PortoIconName };
