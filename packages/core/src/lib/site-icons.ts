/**
 * Runtime icon resolution — no icon packs here. The build-time
 * scan (`lib/icon-scan.ts`) writes the icons the site uses into
 * the generated `.portosaur/site-icons.ts` module; this file
 * resolves a frontmatter/config icon value against that map.
 * Ids are normalized to their canonical pack name before lookup
 * (`md:home` and `mdi:home` are the same icon).
 */

import { getPrefixMap } from "./iconPrefixes.ts";
import { withBase } from "./pageUrl.ts";
import { techMap } from "./techmap.ts";

/** One icon's SVG: its viewBox plus its body, verbatim. */
export interface SiteIconData {
  viewBox: string;
  body: string;
}

/** The generated per-site icon map: canonical id -> SVG. */
export type SiteIcons = Record<string, SiteIconData>;

/** A frontmatter/config icon value: a path, id, emoji, SVG — or an image with a fallback. */
export type DynamicIconValue = string | { src: string; fallback?: string };

/** A resolved icon value, ready for `SiteIcon` to render. */
export type ResolvedSiteIcon =
  | { kind: "icon"; id: string }
  | { kind: "emoji"; value: string }
  | { kind: "image"; src: string; fallback?: string }
  | { kind: "svg"; html: string };

const prefixMap = getPrefixMap();

/** Normalizes an icon id to its canonical form (`"md:home"` ->
 * `"mdi:home"`), or null when malformed or unknown. */
export function normalizeIconId(iconId: string): string | null {
  const parts = iconId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const [rawPrefix, name] = parts;
  const prefix = prefixMap[rawPrefix];
  if (!prefix || !name) {
    return null;
  }
  return `${prefix}:${name}`;
}

export interface ResolveSiteIconOptions {
  slug?: string;
  fallbackIcon?: string;
  base?: string;
}

/**
 * Resolves an icon value against the site's icon map, in order:
 * raw SVG, image, emoji, Iconify id or techMap name (unknown ids
 * resolve to nothing — the scan already warned), then a techMap
 * or `di:<slug>` guess from the slug, then `fallbackIcon`.
 * Null when nothing resolves.
 */
export function resolveSiteIcon(
  iconStr?: DynamicIconValue,
  options: ResolveSiteIconOptions = {},
  icons: SiteIcons = {},
): ResolvedSiteIcon | null {
  const { slug, fallbackIcon, base = "/" } = options;

  if (iconStr) {
    if (typeof iconStr === "string" && iconStr.trim().startsWith("<svg")) {
      return { kind: "svg", html: iconStr };
    }
    if (
      typeof iconStr === "object" ||
      iconStr.includes(".") ||
      iconStr.includes("/")
    ) {
      const src = typeof iconStr === "string" ? iconStr : iconStr.src;
      const fallback =
        typeof iconStr === "object" ? iconStr.fallback : undefined;
      return {
        kind: "image",
        src: withBase(src, base),
        fallback: fallback ? withBase(fallback, base) : undefined,
      };
    }
    // Emoji only when the value carries no colon: icon ids always
    // do (`prefix:name`), and digits carry the Emoji property, so
    // a bare contains-check read ids like `lu:maximize-2` as emoji
    // and rendered the raw id as text.
    if (!iconStr.includes(":") && /\p{Emoji}/u.test(iconStr)) {
      return { kind: "emoji", value: iconStr };
    }
    const mappedId = techMap[iconStr.toLowerCase()]?.icon ?? iconStr;
    const normalized = normalizeIconId(mappedId);
    if (normalized && icons[normalized]) {
      return { kind: "icon", id: normalized };
    }
    return null;
  }

  if (slug) {
    const slugLower = slug.toLowerCase();
    const guessed = techMap[slugLower]?.icon;
    const guessedId = guessed ? normalizeIconId(guessed) : null;
    if (guessedId && icons[guessedId]) {
      return { kind: "icon", id: guessedId };
    }
    const deviconId = `devicon:${slugLower}`;
    if (icons[deviconId]) {
      return { kind: "icon", id: deviconId };
    }
  }

  if (fallbackIcon) {
    const mappedId = techMap[fallbackIcon.toLowerCase()]?.icon ?? fallbackIcon;
    const normalized = normalizeIconId(mappedId);
    if (normalized && icons[normalized]) {
      return { kind: "icon", id: normalized };
    }
  }
  return null;
}
