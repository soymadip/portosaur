import type { PortosaurOptions } from "./config.ts";
import { localImageDimensions, staticDirsForConfig } from "./image-size.ts";

/**
 * Metadata helpers for the generated root — absolute URLs and sized
 * social images for the root layout, the doc/blog page metadata,
 * and the manifest.
 *
 * Server-only: sizing reads image files from disk at build time.
 * The generated code imports this from `@portosaur/core/lib/metadata`.
 */

/** The site origin (URL + base path, no trailing slash). */
export function siteOriginOf(config: PortosaurOptions): string {
  const base =
    config.site.baseUrl === "/" ? "" : config.site.baseUrl.replace(/\/$/, "");
  return `${config.site.url.replace(/\/$/, "")}${base}`;
}

/**
 * An image path as an absolute URL. Remote URLs pass through
 * unchanged; local paths (static-root-relative, with or without a
 * leading slash) get the origin, base path included.
 */
export function absoluteImageUrl(
  config: PortosaurOptions,
  src: string,
): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) {
    return src;
  }
  return `${siteOriginOf(config)}/${src.replace(/^\/+/, "")}`;
}

/** A social image as a metadata entry: absolute URL, sized when possible. */
export interface SizedSocialImage {
  url: string;
  width?: number;
  height?: number;
}

/**
 * Resolve a social image to its metadata entry: the absolute URL,
 * plus width and height when the file exists locally and can be
 * sized. Remote images and unsizable files get the URL alone.
 */
export async function sizedSocialImage(
  config: PortosaurOptions,
  src: string,
): Promise<SizedSocialImage> {
  const url = absoluteImageUrl(config, src);
  const size = await localImageDimensions(src, staticDirsForConfig(config));
  if (!size) {
    return { url };
  }
  return { url, width: size.width, height: size.height };
}
