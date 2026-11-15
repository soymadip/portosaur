import fs from "node:fs";
import type { MetadataRoute } from "next";
import type { PortosaurOptions } from "./config.ts";
import { pageHref } from "./pageUrl.ts";

/**
 * Asset helpers for the generated root — the head tags for the
 * generated favicons/manifest, and the sitemap/robots data the
 * generated `app/sitemap.ts` / `app/robots.ts` return.
 *
 * Ported from the Astro app (`packages/app/src/utils/assets.ts`):
 * `getAssetHeadTags` is the same function; the sitemap/robots
 * helpers are new, shaped for Next.js's `MetadataRoute` types.
 * Server-only (reads CSS files from disk for the theme color).
 */

/** One head tag: `{ tagName, attributes, innerHTML? }`. */
export interface HeadTag {
  tagName: string;
  attributes: Record<string, string>;
  innerHTML?: string;
}

function cleanBaseUrlOf(baseUrl: string): string {
  if (!baseUrl || baseUrl === "/") {
    return "/";
  }
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/**
 * Reads a CSS custom property's value out of a list of CSS files —
 * the theme-color meta needs the resolved `--porto-color-bg`, which
 * lives in the scheme CSS. Returns `null` when no file defines it.
 */
export function getCssVar(varName: string, cssFiles: string[]): string | null {
  const pattern = new RegExp(
    `${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`,
  );
  for (const file of cssFiles) {
    try {
      const contents = fs.readFileSync(file, "utf-8");
      const match = pattern.exec(contents);
      if (match) {
        return match[1].trim();
      }
    } catch {
      // Missing or unreadable file — try the next one.
    }
  }
  return null;
}

/**
 * Favicon / manifest / theme-color links, computed from the resolved
 * config (the assets step generates the files they point to).
 */
export function getAssetHeadTags(options: PortosaurOptions): HeadTag[] {
  const cleanBaseUrl = cleanBaseUrlOf(options.site.baseUrl);
  const outputPath = "favicon";
  const themeColor = getCssVar("--porto-color-bg", options.cssFiles ?? []);

  const headTags: HeadTag[] = [
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        href: `${cleanBaseUrl}${outputPath}/favicon.ico`,
        sizes: "32x32",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/png",
        href: `${cleanBaseUrl}${outputPath}/icon-192x192.png`,
        sizes: "192x192",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "apple-touch-icon",
        href: `${cleanBaseUrl}${outputPath}/apple-touch-icon.png`,
        sizes: "180x180",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "manifest",
        href: `${cleanBaseUrl}manifest.webmanifest`,
      },
    },
  ];

  if (themeColor) {
    headTags.push({
      tagName: "meta",
      attributes: {
        name: "theme-color",
        content: themeColor,
      },
    });
  }

  return headTags;
}

/** One sitemap URL: the fields the generated `app/sitemap.ts` needs. */
export interface SitemapPage {
  url: string;
  lastModified?: string | Date;
}

/**
 * Builds the sitemap entries for the generated `app/sitemap.ts`:
 * every page URL, trailing-slashed and absolutized against the site
 * URL + base. Pages are the caller's list (loader pages + the static
 * routes); the home page is included by passing `"/"`.
 */
export function buildSitemapEntries(
  config: PortosaurOptions,
  pages: SitemapPage[],
): MetadataRoute.Sitemap {
  const siteUrl = (config.site.url ?? "").replace(/\/$/, "");
  const base = cleanBaseUrlOf(config.site.baseUrl);
  const basePrefix = base === "/" ? "" : base.replace(/\/$/, "");
  return pages.map((page) => {
    const slashed = pageHref(page.url);
    const path =
      slashed === "/"
        ? "/"
        : `${basePrefix}${slashed.startsWith("/") ? slashed : `/${slashed}`}`;
    return {
      url: `${siteUrl}${path}`,
      lastModified: page.lastModified,
    };
  });
}

/**
 * Builds the robots rules for the generated `app/robots.ts` from
 * `site.robots_txt` config (enable/rules). Returns `null` when
 * robots generation is disabled — the route then emits nothing.
 * The sitemap URL points at the generated sitemap.
 *
 * Limitation: Next.js's robots convention has no slot for the raw
 * `custom_lines` the Astro build appended to robots.txt — they are
 * dropped here. If a site needs them, the CLI must write a static
 * `robots.txt` into the output dir instead of the generated route.
 */
export function buildRobots(
  config: PortosaurOptions,
): MetadataRoute.Robots | null {
  const robots = config.site.robotsTxt;
  if (!robots?.enable) {
    return null;
  }
  const siteUrl = (config.site.url ?? "").replace(/\/$/, "");
  const base = cleanBaseUrlOf(config.site.baseUrl);
  const rules = (robots.rules ?? []).map((rule: any) => ({
    userAgent: rule.user_agent ?? rule.userAgent ?? "*",
    allow: rule.allow,
    disallow: rule.disallow,
  }));
  const result: MetadataRoute.Robots = {
    rules: rules.length > 0 ? rules : { userAgent: "*" },
    sitemap: `${siteUrl}${base}sitemap.xml`,
  };
  return result;
}
