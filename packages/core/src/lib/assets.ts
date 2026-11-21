import fs from "node:fs";
import type { PortosaurOptions } from "./config.ts";

/**
 * Asset helpers for the generated root — the head tags for the
 * generated favicons/manifest.
 *
 * Ported from the Astro app (`packages/app/src/utils/assets.ts`):
 * `getAssetHeadTags` is the same function. Server-only (reads CSS
 * files from disk for the theme color).
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
