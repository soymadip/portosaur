import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Dimensions of a local (public-dir) image, for Astro's `<Image />`.
 *
 * Astro's `<Image />` needs `width` / `height` for images served from
 * `public/` (it cannot analyze them), and Portosaur's configured
 * images (hero profile picture, about image, docs home icon, author
 * avatars) are plain config strings — not imports — so the dimensions
 * have to be read from the file at build time. This runs in component
 * frontmatter (server-only), never in the browser.
 *
 * Lookup order mirrors the static merge the integration performs:
 * the project's `static/` first (user files win), then the theme
 * defaults (`portoPaths.static`), then the generated-asset staging
 * dir (`.portosaur/static`).
 *
 * Remote URLs, data URIs, and files that don't exist or can't be
 * sized (e.g. an SVG without dimensions) return `null` — callers
 * fall back to a plain `<img>` for those.
 */

export interface LocalImageDimensions {
  width: number;
  height: number;
}

const REMOTE_OR_SPECIAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i;

export async function localImageDimensions(
  src: string,
  staticDirs: string[],
): Promise<LocalImageDimensions | null> {
  if (!src || REMOTE_OR_SPECIAL_RE.test(src)) {
    return null;
  }
  // Config paths are static-root-relative (`img/icon.png`); absolute
  // site-root paths (`/avatars/x.png`) resolve the same way.
  const relative = src.replace(/^\/+/, "");
  for (const dir of staticDirs) {
    if (!dir) {
      continue;
    }
    const file = path.join(dir, relative);
    if (!fs.existsSync(file)) {
      continue;
    }
    try {
      const metadata = await sharp(file).metadata();
      if (metadata.width && metadata.height) {
        return { width: metadata.width, height: metadata.height };
      }
    } catch {
      // Not an image sharp can size — try the next static dir, else
      // the caller falls back to a plain <img>.
    }
  }
  return null;
}

/** The static directories a configured image path can resolve against. */
export function staticDirsForConfig(config: {
  projectDir?: string;
  portoPaths?: { static?: string };
}): string[] {
  const dirs: string[] = [];
  if (config.projectDir) {
    dirs.push(path.join(config.projectDir, "static"));
  }
  if (config.portoPaths?.static) {
    dirs.push(config.portoPaths.static);
  }
  if (config.projectDir) {
    dirs.push(path.join(config.projectDir, ".portosaur", "static"));
  }
  return dirs;
}
