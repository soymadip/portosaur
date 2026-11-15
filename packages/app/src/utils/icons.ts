/**
 * Icon rendering for sections and routes (Phase 3).
 *
 * The `porto:icons` virtual module is stubbed empty until Phase 4, so
 * sections render icons directly from the installed `@iconify-json`
 * packs with `@iconify/utils` — the same `getIconData` + `iconToSVG`
 * pair the old Docusaurus icons plugin used. Phase 4's icon system may
 * reuse or replace this helper; the API is intentionally small:
 *
 * - `techMap` — name -> { icon, color } (ported from the old Icon).
 * - `renderIcon(id, options)` — an inline SVG string for an Iconify id
 *   (`"md:home"`) or a techMap name (`"github"`); `""` when not found.
 * - `renderDynamicIcon(iconStr, options)` — the old DynamicIcon logic:
 *   raw SVG, image path, emoji, Iconify id, techMap/devicon guess by
 *   slug, then a fallback icon.
 * - `collectSidebarSprite(items)` / `renderSidebarIcon(...)` — the
 *   sidebar's deduplicated icons: icons that repeat across sidebar
 *   rows render as `<use>` references into a per-page sprite, while
 *   single-use icons keep rendering inline (a symbol + reference
 *   costs more bytes than the inline SVG when the icon appears
 *   once). The sprite only ever shrinks a page — see the section
 *   comment above `collectSidebarSprite`.
 * - `withBase(path, baseUrl)` — base-aware asset URL (the old
 *   `withBaseUrl`); absolute URLs, protocol-relative URLs, and hashes
 *   pass through unchanged.
 *
 * Icons render at build time (frontmatter only — never import this from
 * a client script). Callers wrap the returned HTML in a template element
 * carrying the CSS class and inject it with `set:html`; Astro's scoped
 * styles cannot target classes on injected markup, so sizing goes on the
 * wrapper (the SVG is `1em`, so the wrapper's `font-size` scales it).
 */

import { getIconData, iconToSVG } from "@iconify/utils";
import type { IconifyIcon } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";
import lucideIcons from "@iconify-json/lucide/icons.json" with { type: "json" };
import octiconIcons from "@iconify-json/octicon/icons.json" with { type: "json" };
import simpleIcons from "@iconify-json/simple-icons/icons.json" with { type: "json" };
import logosIcons from "@iconify-json/logos/icons.json" with { type: "json" };
import mdiIcons from "@iconify-json/mdi/icons.json" with { type: "json" };
import lineMdIcons from "@iconify-json/line-md/icons.json" with { type: "json" };
import deviconIcons from "@iconify-json/devicon/icons.json" with { type: "json" };
import streamlineIcons from "@iconify-json/streamline-sharp/icons.json" with { type: "json" };
import fa7SolidIcons from "@iconify-json/fa7-solid/icons.json" with { type: "json" };

import { getPrefixMap } from "./iconPrefixes.ts";

const prefixMap = getPrefixMap();

const collections: Record<string, IconifyJSON> = {
  lucide: lucideIcons,
  octicon: octiconIcons,
  "simple-icons": simpleIcons,
  logos: logosIcons,
  mdi: mdiIcons,
  "line-md": lineMdIcons,
  devicon: deviconIcons,
  "streamline-sharp": streamlineIcons,
  "fa7-solid": fa7SolidIcons,
};

export interface TechMapEntry {
  icon: string;
  color: string;
}

/**
 * Name -> icon id + brand color, ported verbatim from the old
 * `components/Icon/index.jsx`. Keys are lowercase; lookups lowercase
 * their input. Used for icon guessing (a note titled "Python" gets the
 * Python icon) and for the hover/accent color of social and note cards.
 */
export const techMap: Record<string, TechMapEntry> = {
  react: { icon: "si:react", color: "#61dafb" },
  reactjs: { icon: "si:react", color: "#61dafb" },
  javascript: { icon: "si:javascript", color: "#f7df1e" },
  js: { icon: "si:javascript", color: "#f7df1e" },
  typescript: { icon: "si:typescript", color: "#3178c6" },
  ts: { icon: "si:typescript", color: "#3178c6" },
  python: { icon: "si:python", color: "#3776ab" },
  py: { icon: "si:python", color: "#3776ab" },
  node: { icon: "si:nodedotjs", color: "#339939" },
  nodejs: { icon: "si:nodedotjs", color: "#339939" },
  html: { icon: "si:html5", color: "#e34f26" },
  css: { icon: "si:css3", color: "#1572b6" },
  git: { icon: "si:git", color: "#f05032" },
  linux: { icon: "si:linux", color: "#fcc624" },
  docker: { icon: "si:docker", color: "#2496ed" },
  java: { icon: "di:java", color: "#007396" },
  cpp: { icon: "si:cplusplus", color: "#00599c" },
  csharp: { icon: "si:csharp", color: "#239120" },
  go: { icon: "si:go", color: "#00add8" },
  rust: { icon: "si:rust", color: "#dea584" },
  ruby: { icon: "si:ruby", color: "#cc342d" },
  php: { icon: "si:php", color: "#777bb4" },
  sql: { icon: "si:mysql", color: "#003b57" },
  mysql: { icon: "si:mysql", color: "#4479a1" },
  postgres: { icon: "si:postgresql", color: "#336791" },
  mongodb: { icon: "si:mongodb", color: "#47a248" },
  aws: { icon: "si:amazonwebservices", color: "#ff9900" },
  bash: { icon: "lu:terminal", color: "#4eaa25" },
  terminal: { icon: "lu:terminal", color: "#4eaa25" },
  vue: { icon: "si:vuedotjs", color: "#4fc08d" },
  angular: { icon: "si:angular", color: "#dd0031" },
  nextjs: { icon: "si:nextdotjs", color: "#000000" },
  kubernetes: { icon: "si:kubernetes", color: "#326ce5" },
  tailwind: { icon: "si:tailwindcss", color: "#38bdf8" },
  graphql: { icon: "si:graphql", color: "#e10098" },
  redis: { icon: "si:redis", color: "#dc382d" },

  // Non-Tech / Generic Mappings
  guide: { icon: "md:book-open", color: "#3b82f6" },
  tutorial: { icon: "md:school", color: "#8b5cf6" },
  about: { icon: "md:information", color: "#10b981" },
  blog: { icon: "md:pencil", color: "#f59e0b" },
  "getting-started": { icon: "md:rocket-launch", color: "#ef4444" },
  setup: { icon: "md:cog", color: "#64748b" },
  faq: { icon: "md:help-circle", color: "#0ea5e9" },
  features: { icon: "md:star", color: "#eab308" },
  contact: { icon: "md:email", color: "#14b8a6" },
  portfolio: { icon: "md:briefcase", color: "#6366f1" },
  home: { icon: "md:home", color: "#3b82f6" },

  // Specific Topics
  "machine-learning": { icon: "md:robot", color: "#ec4863ff" }, // pink
  ml: { icon: "md:robot", color: "#ec4899" },
  economics: { icon: "md:chart-line", color: "#10b981" }, // emerald
  dbms: { icon: "md:database", color: "#3b82f6" }, // blue
  entrepreneurship: { icon: "md:lightbulb", color: "#f59e0b" }, // amber
  "data-mining": { icon: "md:database-search", color: "#8b5cf6" }, // purple
  warehouse: { icon: "md:warehouse", color: "#64748b" }, // slate

  // Social / Contact
  github: { icon: "md:github", color: "#333333" },
  gitlab: { icon: "md:gitlab", color: "#fc6d26" },
  mail: { icon: "md:email", color: "#ef4444" },
  email: { icon: "md:email", color: "#ef4444" },
  anilist: { icon: "si:anilist", color: "#02A9FF" },
  linkedin: { icon: "md:linkedin", color: "#0a66c2" },
  telegram: { icon: "md:telegram", color: "#26a5e4" },
  twitter: { icon: "md:twitter", color: "#1da1f2" },
  x: { icon: "md:twitter", color: "#1da1f2" },
  discord: { icon: "md:discord", color: "#5865f2" },
  instagram: { icon: "md:instagram", color: "#E1306C" },
  facebook: { icon: "md:facebook", color: "#1877F2" },
  youtube: { icon: "md:youtube", color: "#FF0000" },
  tiktok: { icon: "si:tiktok", color: "#ff0050" },
  reddit: { icon: "md:reddit", color: "#FF4500" },
  twitch: { icon: "md:twitch", color: "#9146FF" },
  pinterest: { icon: "md:pinterest", color: "#E60023" },
  snapchat: { icon: "md:snapchat", color: "#FFFC00" },
  whatsapp: { icon: "md:whatsapp", color: "#25D366" },
  spotify: { icon: "md:spotify", color: "#1DB954" },
  medium: { icon: "md:medium", color: "#000000" },
  dribbble: { icon: "md:dribbble", color: "#EA4C89" },
  behance: { icon: "md:behance", color: "#1769FF" },
};

// Missing-icon warnings, deduplicated so a bad id warns once per build
// instead of once per page that uses it.
const warnedIds = new Set<string>();
const renderCache = new Map<string, string>();

/** Escapes a value for an HTML attribute (double-quoted). */
function escapeAttr(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Resolves an icon id (`"md:home"`, shorthand or canonical prefix) to
 * its icon data, or null. Warns once per unknown id unless `silent`
 * (the devicon guess is a guess, not an error).
 */
function resolveIconData(iconId: string, silent = false): IconifyIcon | null {
  const parts = iconId.split(":");
  if (parts.length !== 2) {
    if (!silent && !warnedIds.has(iconId)) {
      warnedIds.add(iconId);
      console.warn(`[Icons] Malformed icon id: ${iconId}`);
    }
    return null;
  }
  const [rawPrefix, name] = parts;
  const prefix = prefixMap[rawPrefix];
  const collection = collections[prefix];
  if (!collection) {
    if (!silent && !warnedIds.has(iconId)) {
      warnedIds.add(iconId);
      console.warn(`[Icons] Unknown icon prefix in id: ${iconId}`);
    }
    return null;
  }
  const iconData = getIconData(collection, name);
  if (!iconData) {
    if (!silent && !warnedIds.has(iconId)) {
      warnedIds.add(iconId);
      console.warn(`[Icons] Icon not found: ${iconId}`);
    }
    return null;
  }
  return iconData;
}

export interface RenderIconOptions {
  size?: string;
  color?: string;
  className?: string;
}

/**
 * The `class`/`style` attributes for an icon `<svg>`, shared by
 * `renderIcon` and `renderIconUse` — the two renderings must stay
 * identical apart from the body.
 */
function iconSvgExtraAttrs(options: RenderIconOptions): string {
  const styleBits = [];
  if (options.size) {
    styleBits.push(`font-size:${options.size}`);
  }
  if (options.color) {
    styleBits.push(`color:${options.color}`);
  }
  const classAttr = options.className
    ? ` class="${escapeAttr(options.className)}"`
    : "";
  const styleAttr =
    styleBits.length > 0 ? ` style="${escapeAttr(styleBits.join(";"))}"` : "";
  return `${classAttr}${styleAttr}`;
}

/**
 * Renders an icon as an inline SVG string.
 *
 * @param id - An Iconify id (`"md:home"`, shorthand or canonical
 *   prefix) or a techMap name (`"github"` — resolved through `techMap`
 *   first, like the old Icon component).
 * @param options.size - CSS font-size for the SVG (it is `1em`, so this
 *   scales it). Usually left to the wrapper's font-size.
 * @param options.color - CSS color for the SVG (`currentColor` by
 *   default — the icon inherits its wrapper's color).
 * @param options.className - Extra class on the `<svg>`.
 * @returns The `<svg>` markup, or `""` when the id is missing
 *   or unknown (with a one-time console warning).
 */
export function renderIcon(
  id: string | undefined,
  options: RenderIconOptions = {},
): string {
  if (!id || typeof id !== "string") {
    return "";
  }
  const cacheKey = `${id}|${options.size ?? ""}|${options.color ?? ""}|${options.className ?? ""}`;
  const cached = renderCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // A techMap name resolves to its icon id first (old Icon behavior).
  const mappedId = techMap[id.toLowerCase()]?.icon ?? id;
  const iconData = resolveIconData(mappedId);
  if (!iconData) {
    renderCache.set(cacheKey, "");
    return "";
  }

  const rendered = iconToSVG(iconData, { height: "1em", width: "1em" });
  if (!rendered) {
    renderCache.set(cacheKey, "");
    return "";
  }

  const attributes = Object.entries(rendered.attributes)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(" ");

  const svg = `<svg ${attributes}${iconSvgExtraAttrs(options)} aria-hidden="true">${rendered.body}</svg>`;
  renderCache.set(cacheKey, svg);
  return svg;
}

/**
 * Base-aware asset URL (the old `withBaseUrl`). Absolute URLs,
 * protocol-relative URLs, and hash links pass through unchanged;
 * anything else gets the site base prepended (and a leading slash).
 *
 * @param path - The asset path (`"img/icon.png"`, `"/img/x.png"`,
 *   or an absolute URL).
 * @param baseUrl - The site base (`config.site.baseUrl`).
 * @returns The base-prefixed URL.
 */
export function withBase(path: string, baseUrl = "/"): string {
  if (!path) {
    return path;
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) {
    return path;
  }
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (base && clean.startsWith(`${base}/`)) {
    return clean;
  }
  return `${base}${clean}`;
}

/** File extensions that mark a URL as an asset, not a page. */
const PAGE_EXCLUDED_EXTENSIONS = new Set([
  "atom",
  "avif",
  "css",
  "eot",
  "gif",
  "gz",
  "html",
  "ico",
  "jpeg",
  "jpg",
  "js",
  "json",
  "md",
  "mjs",
  "mp3",
  "mp4",
  "otf",
  "pdf",
  "png",
  "rss",
  "svg",
  "tar",
  "ttf",
  "txt",
  "webm",
  "webp",
  "woff",
  "woff2",
  "xml",
  "zip",
]);

/**
 * A trailing-slash page URL. Pages are built as `path/index.html`, so
 * the canonical URL ends in `/` — a slash-less link makes the host
 * answer with a 301 redirect to the slashed URL (an extra round-trip
 * on every navigation; Netlify does this, and the sitemap already
 * emits the slashed form). Apply to internal page links only, after
 * `withBase` — never to assets.
 *
 * Absolute URLs, hash links, already-slashed paths, and asset URLs
 * (a known file extension on the last segment) pass through
 * unchanged; a `?query`/`#hash` suffix is preserved after the slash.
 */
export function pageHref(path: string): string {
  if (!path) {
    return path;
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) {
    return path;
  }
  const hashIndex = path.indexOf("#");
  const queryIndex = path.indexOf("?");
  let end = path.length;
  if (hashIndex !== -1) {
    end = Math.min(end, hashIndex);
  }
  if (queryIndex !== -1) {
    end = Math.min(end, queryIndex);
  }
  const pathname = path.slice(0, end);
  const suffix = path.slice(end);
  if (pathname.endsWith("/")) {
    return path;
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
    if (PAGE_EXCLUDED_EXTENSIONS.has(ext)) {
      return path;
    }
  }
  return `${pathname}/${suffix}`;
}

/** A frontmatter/config icon value: a path, id, emoji, SVG — or an image with a fallback. */
export type DynamicIconValue = string | { src: string; fallback?: string };

export interface RenderDynamicIconOptions {
  slug?: string;
  fallbackIcon?: string;
  base?: string;
  size?: string;
}

/**
 * Resolves a frontmatter/config icon value to HTML — the old DynamicIcon
 * logic, in resolution order:
 *
 * 1. Raw inline SVG (a string starting with `<svg`) — passed through in
 *    a centering span.
 * 2. Image path / `{ src, fallback }` object (contains `.` or `/`) — an
 *    `<img>` with the fallback swapped in on error, like the old
 *    `onError` handler.
 * 3. Emoji — a plain span (sized by the wrapper's font-size).
 * 4. Anything else — an Iconify id or techMap name, via `renderIcon`.
 * 5. No `iconStr` but a `slug` — the techMap guess, then a `di:<slug>`
 *    devicon guess when that icon exists in the devicon pack.
 * 6. `fallbackIcon` — the last resort; `""` when nothing resolves.
 *
 * @param iconStr - The raw icon value.
 * @param options.slug - Slug used for the techMap/devicon
 *   guess when no explicit icon is given.
 * @param options.fallbackIcon - Iconify id used when nothing
 *   else resolves.
 * @param options.base - Site base for image URLs.
 * @param options.size - Passed to `renderIcon` for the
 *   Iconify branches.
 * @returns The icon HTML, or `""` when nothing resolves.
 */
export function renderDynamicIcon(
  iconStr?: DynamicIconValue,
  options: RenderDynamicIconOptions = {},
): string {
  const { slug, fallbackIcon, base = "/", size } = options;

  if (iconStr) {
    if (typeof iconStr === "string" && iconStr.trim().startsWith("<svg")) {
      // 1. Raw inline SVG support
      return (
        `<span style="display:inline-flex;align-items:center;` +
        `justify-content:center" aria-hidden="true">${iconStr}</span>`
      );
    }
    if (
      typeof iconStr === "object" ||
      iconStr.includes(".") ||
      iconStr.includes("/")
    ) {
      // 2. Image path / SVG file support
      const src = typeof iconStr === "string" ? iconStr : iconStr.src;
      const fallback =
        typeof iconStr === "object" ? iconStr.fallback : undefined;
      const onError = fallback
        ? ` onerror="this.onerror=null;this.src='${escapeAttr(withBase(fallback, base))}'"`
        : "";
      return `<img src="${escapeAttr(withBase(src, base))}" alt="icon"${onError} />`;
    }
    if (/\p{Emoji}/u.test(iconStr)) {
      // 3. Emoji support (sized by the wrapper's font-size)
      return (
        `<span style="display:inline-flex;align-items:center;` +
        `justify-content:center" role="img" aria-hidden="true">${iconStr}</span>`
      );
    }
    // 4. Explicit Iconify id / techMap name
    return renderIcon(iconStr, { size });
  }

  if (slug) {
    // 5. Devicon guessing via techMap or dynamic devicon
    const slugLower = slug.toLowerCase();
    if (techMap[slugLower]) {
      return renderIcon(techMap[slugLower].icon, { size });
    }
    const potentialDevicon = `di:${slugLower}`;
    if (resolveIconData(potentialDevicon, true)) {
      return renderIcon(potentialDevicon, { size });
    }
  }

  // 6. Final fallback
  return renderIcon(fallbackIcon, { size });
}

/**
 * Sidebar icon sprite — deduplicated inline SVGs.
 *
 * The sidebar inlines one full Iconify SVG per row, and the same
 * icon repeats across rows (the folder/notebook fallbacks most of
 * all) — every docs page re-downloads all of it on every
 * navigation. Rows whose icon repeats render as a `<use>` reference
 * into a per-page sprite instead; single-use icons keep rendering
 * inline, because a symbol + reference costs more bytes than the
 * inline SVG when the icon appears once.
 *
 * The sprite only ever shrinks a page: an icon joins it only when
 * serving its rows from the sprite is strictly smaller than
 * inlining them (measured on the exact strings, not estimated),
 * and the sprite is emitted only when the total saving covers its
 * container. A page with no repeated icons gets no sprite at all
 * and renders byte-identically to before. Non-Iconify rows (emoji,
 * images, raw SVG) are untouched — they never enter the sprite.
 */

/**
 * The sprite's `<symbol>` id for an Iconify id. The `:` is kept —
 * it is legal in an HTML id and in a fragment reference (`<use
 * href="#...">` matches by string, not by CSS selector, so it needs
 * no escaping); keeping the id verbatim also makes collisions
 * impossible, where replacing `:` with `-` could merge two ids.
 */
export function spriteSymbolId(iconId: string): string {
  return `porto-icon-${iconId}`;
}

/**
 * The parts of an icon's SVG a `<symbol>` needs: its viewBox (each
 * icon keeps its own — viewBoxes vary: 24x24, 128x128, wide logos)
 * and its body, verbatim (fills, strokes and gradient defs all live
 * in the body, so a symbol renders exactly like the inline SVG).
 */
interface IconSvgParts {
  viewBox: string;
  body: string;
}

const svgPartsCache = new Map<string, IconSvgParts | null>();

function iconSvgParts(iconId: string): IconSvgParts | null {
  const cached = svgPartsCache.get(iconId);
  if (cached !== undefined) {
    return cached;
  }
  const iconData = resolveIconData(iconId, true);
  const rendered = iconData ? iconToSVG(iconData) : null;
  const viewBox = rendered?.attributes?.viewBox;
  const parts =
    rendered && viewBox
      ? { viewBox: String(viewBox), body: rendered.body }
      : null;
  svgPartsCache.set(iconId, parts);
  return parts;
}

/**
 * Renders an icon as a sprite `<symbol>` — the icon's body under
 * its own viewBox, so `<use>` references scale it exactly like the
 * inline SVG. Returns `""` when the id is unknown.
 */
export function renderIconSymbol(iconId: string): string {
  const parts = iconSvgParts(iconId);
  if (!parts) {
    return "";
  }
  return (
    `<symbol id="${escapeAttr(spriteSymbolId(iconId))}" ` +
    `viewBox="${escapeAttr(parts.viewBox)}">${parts.body}</symbol>`
  );
}

/**
 * Renders an icon as a `<use>` reference into the sidebar sprite —
 * the same 1em `<svg>` `renderIcon` emits, with the body replaced by
 * a reference to the icon's symbol. The symbol carries the viewBox,
 * so the reference scales identically (including non-square icons,
 * which letterbox the same way). `size`/`color`/`className` behave
 * exactly as in `renderIcon` (currentColor flows through `<use>`).
 */
export function renderIconUse(
  iconId: string,
  options: RenderIconOptions = {},
): string {
  return (
    `<svg width="1em" height="1em"${iconSvgExtraAttrs(options)} aria-hidden="true">` +
    `<use href="#${escapeAttr(spriteSymbolId(iconId))}"/></svg>`
  );
}

/**
 * Resolves a frontmatter/config icon value to the Iconify id that
 * would render — the same resolution order as `renderDynamicIcon`,
 * but returning the canonical id (after techMap mapping) instead of
 * HTML. Returns null for every non-Iconify case (raw SVG, image,
 * emoji) and when nothing resolves (unknown id, unknown slug, no
 * fallback). Checks are silent: the fallback `renderDynamicIcon`
 * call still warns once for an unknown explicit id, exactly as
 * before.
 */
export function resolveDynamicIconId(
  iconStr?: DynamicIconValue,
  options: RenderDynamicIconOptions = {},
): string | null {
  const { slug, fallbackIcon } = options;

  if (iconStr) {
    if (typeof iconStr === "string" && iconStr.trim().startsWith("<svg")) {
      return null;
    }
    if (
      typeof iconStr === "object" ||
      iconStr.includes(".") ||
      iconStr.includes("/")
    ) {
      return null;
    }
    if (/\p{Emoji}/u.test(iconStr)) {
      return null;
    }
    const mappedId = techMap[iconStr.toLowerCase()]?.icon ?? iconStr;
    return resolveIconData(mappedId, true) ? mappedId : null;
  }

  if (slug) {
    const slugLower = slug.toLowerCase();
    if (techMap[slugLower]) {
      const mappedId = techMap[slugLower].icon;
      return resolveIconData(mappedId, true) ? mappedId : null;
    }
    const potentialDevicon = `di:${slugLower}`;
    if (resolveIconData(potentialDevicon, true)) {
      return potentialDevicon;
    }
  }

  if (fallbackIcon) {
    const mappedId = techMap[fallbackIcon.toLowerCase()]?.icon ?? fallbackIcon;
    return resolveIconData(mappedId, true) ? mappedId : null;
  }
  return null;
}

/** A sidebar tree node, as far as icon collection needs to see it. */
export interface SidebarSpriteItem {
  icon?: DynamicIconValue;
  label?: string;
  type?: string;
  items?: SidebarSpriteItem[];
}

/** A collected sprite: its markup and the ids it contains. */
export interface SidebarSprite {
  html: string;
  ids: Set<string>;
}

/**
 * The sprite wrapper: a zero-size, absolutely positioned `<svg>`
 * (never `display: none` — a hidden sprite still has to be
 * referenceable, and zero-size + overflow hidden is bulletproof for
 * `<use>` in every browser). `aria-hidden` — the symbols are
 * referenced by the rows' own `aria-hidden` svgs.
 */
const SPRITE_OPEN =
  `<svg aria-hidden="true" data-porto-sprite ` +
  `style="position:absolute;width:0;height:0;overflow:hidden">`;
const SPRITE_CLOSE = "</svg>";

/**
 * Collects the icon sprite for a sidebar tree: walks every row,
 * counts how often each resolved Iconify id occurs, and keeps the
 * icons whose rows are strictly smaller served from the sprite than
 * inlined (measured on the exact rendered strings). The sprite is
 * emitted only when the total saving covers its container — so a
 * tree with no repeated icons yields an empty sprite and the page
 * renders exactly as before.
 *
 * @param items - The sidebar tree (top-level items; children are
 *   walked recursively).
 * @returns The sprite markup ("" when no sprite is worthwhile) and
 *   the set of icon ids it contains, for `renderSidebarIcon`.
 */
export function collectSidebarSprite(
  items: SidebarSpriteItem[],
): SidebarSprite {
  const empty: SidebarSprite = { html: "", ids: new Set<string>() };
  const counts = new Map<string, number>();
  const visit = (nodes: SidebarSpriteItem[] | undefined) => {
    for (const item of nodes ?? []) {
      const id = resolveDynamicIconId(item.icon, {
        slug: item.label,
        fallbackIcon: item.type === "category" ? "md:folder" : "md:notebook",
      });
      if (id) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      visit(item.items);
    }
  };
  visit(items);

  const members: string[] = [];
  let totalSaving = 0;
  for (const [id, count] of counts) {
    if (count < 2) {
      continue;
    }
    const saving =
      count * renderIcon(id).length -
      (count * renderIconUse(id).length + renderIconSymbol(id).length);
    if (saving > 0) {
      members.push(id);
      totalSaving += saving;
    }
  }
  if (
    members.length === 0 ||
    totalSaving <= SPRITE_OPEN.length + SPRITE_CLOSE.length
  ) {
    return empty;
  }
  const symbols = members.map((id) => renderIconSymbol(id)).join("");
  return {
    html: `${SPRITE_OPEN}${symbols}${SPRITE_CLOSE}`,
    ids: new Set(members),
  };
}

/**
 * Renders a sidebar row's icon: a `<use>` reference when the icon
 * is in the page's sprite, `renderDynamicIcon` otherwise (emoji,
 * images, raw SVG, single-use and unknown icons all render exactly
 * as before).
 *
 * @param iconStr - The raw icon value.
 * @param options - The same options as `renderDynamicIcon`.
 * @param spriteIds - The ids in the page's sprite, from
 *   `collectSidebarSprite`.
 */
export function renderSidebarIcon(
  iconStr?: DynamicIconValue,
  options: RenderDynamicIconOptions = {},
  spriteIds: Set<string> = new Set<string>(),
): string {
  const id = resolveDynamicIconId(iconStr, options);
  if (id && spriteIds.has(id)) {
    return renderIconUse(id, { size: options.size });
  }
  return renderDynamicIcon(iconStr, options);
}
