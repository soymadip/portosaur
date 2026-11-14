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
import lucideIcons from "@iconify-json/lucide/icons.json" with { type: "json" };
import octiconIcons from "@iconify-json/octicon/icons.json" with { type: "json" };
import simpleIcons from "@iconify-json/simple-icons/icons.json" with { type: "json" };
import logosIcons from "@iconify-json/logos/icons.json" with { type: "json" };
import mdiIcons from "@iconify-json/mdi/icons.json" with { type: "json" };
import lineMdIcons from "@iconify-json/line-md/icons.json" with { type: "json" };
import deviconIcons from "@iconify-json/devicon/icons.json" with { type: "json" };
import streamlineIcons from "@iconify-json/streamline-sharp/icons.json" with { type: "json" };
import fa7SolidIcons from "@iconify-json/fa7-solid/icons.json" with { type: "json" };

import { getPrefixMap } from "../utils/iconPrefixes.mjs";

const prefixMap = getPrefixMap();

const collections = {
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

/**
 * Name -> icon id + brand color, ported verbatim from the old
 * `components/Icon/index.jsx`. Keys are lowercase; lookups lowercase
 * their input. Used for icon guessing (a note titled "Python" gets the
 * Python icon) and for the hover/accent color of social and note cards.
 */
export const techMap = {
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
const warnedIds = new Set();
const renderCache = new Map();

/** Escapes a value for an HTML attribute (double-quoted). */
function escapeAttr(value) {
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
function resolveIconData(iconId, silent = false) {
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

/**
 * Renders an icon as an inline SVG string.
 *
 * @param {string} id - An Iconify id (`"md:home"`, shorthand or canonical
 *   prefix) or a techMap name (`"github"` — resolved through `techMap`
 *   first, like the old Icon component).
 * @param {object} [options]
 * @param {string} [options.size] - CSS font-size for the SVG (it is
 *   `1em`, so this scales it). Usually left to the wrapper's font-size.
 * @param {string} [options.color] - CSS color for the SVG (`currentColor`
 *   by default — the icon inherits its wrapper's color).
 * @param {string} [options.className] - Extra class on the `<svg>`.
 * @returns {string} The `<svg>` markup, or `""` when the id is missing
 *   or unknown (with a one-time console warning).
 */
export function renderIcon(id, options = {}) {
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

  const svg = `<svg ${attributes}${classAttr}${styleAttr} aria-hidden="true">${rendered.body}</svg>`;
  renderCache.set(cacheKey, svg);
  return svg;
}

/**
 * Base-aware asset URL (the old `withBaseUrl`). Absolute URLs,
 * protocol-relative URLs, and hash links pass through unchanged;
 * anything else gets the site base prepended (and a leading slash).
 *
 * @param {string} path - The asset path (`"img/icon.png"`, `"/img/x.png"`,
 *   or an absolute URL).
 * @param {string} [baseUrl="/"] - The site base (`config.site.baseUrl`).
 * @returns {string} The base-prefixed URL.
 */
export function withBase(path, baseUrl = "/") {
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
 * @param {string|object} [iconStr] - The raw icon value.
 * @param {object} [options]
 * @param {string} [options.slug] - Slug used for the techMap/devicon
 *   guess when no explicit icon is given.
 * @param {string} [options.fallbackIcon] - Iconify id used when nothing
 *   else resolves.
 * @param {string} [options.base="/"] - Site base for image URLs.
 * @param {string} [options.size] - Passed to `renderIcon` for the
 *   Iconify branches.
 * @returns {string} The icon HTML, or `""` when nothing resolves.
 */
export function renderDynamicIcon(iconStr, options = {}) {
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
