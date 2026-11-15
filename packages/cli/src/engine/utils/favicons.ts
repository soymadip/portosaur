import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { PortosaurOptions } from "../generators/siteConfig.ts";

/**
 * Per-site favicon generation (ported from the Astro app's
 * `generateSiteAssets`, favicon part only — fallbacks, screenshots,
 * shortcut icons, and the sample resume are Phase 4 PWA scope).
 *
 * The site icon resolves like OG: docs mode reads
 * `docs_home.icon`, portfolio mode reads the hero profile picture,
 * and both fall back to `img/icon.png` (the Portosaur dino). The
 * icon is circle-cropped (cover fit for portfolio, contain with
 * 15% padding for docs) and rendered at 32px (favicon.ico), 192px,
 * 512px, and 180px (apple-touch-icon), plus a `manifest.webmanifest`
 * with the icon entries.
 *
 * Outputs land in the generated root's `public/` dir (see
 * `ensurePublicUnion`), so Next.js serves them in dev and copies
 * them into the static export at build time — no post-build copy
 * step needed. A stamp file (`favicon/.favicon.source.json`)
 * records the source image's state so regeneration is a no-op
 * when nothing changed (dev regenerates the root often).
 *
 * A user-provided `static/favicon/` always wins: the union links
 * it into `public/` first, and generation skips when
 * `public/favicon` is a symlink.
 */

/** A logger with the methods the favicon pipeline uses (all optional). */
export interface FaviconLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
  success?: (message: string) => void;
}

function normalizeLogger(
  logger?: FaviconLogger | null,
): Required<FaviconLogger> {
  const fallback: Required<FaviconLogger> = {
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    success: console.info.bind(console),
  };
  if (!logger) {
    return fallback;
  }
  return {
    info: logger.info?.bind(logger) ?? fallback.info,
    warn: logger.warn?.bind(logger) ?? fallback.warn,
    error: logger.error?.bind(logger) ?? fallback.error,
    success:
      logger.success?.bind(logger) ??
      logger.info?.bind(logger) ??
      fallback.success,
  };
}

/** A config image value: a plain local path, or a `{ src, fallback }` object for remote images. */
type ImageValue =
  string | { src?: string; fallback?: string } | null | undefined;

/** Unwrap a config image value to the raw URL/path the pipeline expects. */
function unwrapImage(value: ImageValue): string | null | undefined {
  if (!value) {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.src ?? null;
}

/**
 * The site icon spec (a local path relative to `static/`, or a
 * remote URL): docs mode reads `docs_home.icon`, portfolio mode
 * reads the hero profile picture, and both fall back to
 * `img/icon.png`.
 */
export function resolveSiteIconSpec(options: PortosaurOptions): string {
  const raw =
    options.siteMode === "docs"
      ? options.docsHome?.icon
      : options.homePage?.heroSection?.profilePic;
  return unwrapImage(raw) || "img/icon.png";
}

/**
 * Find a local icon file, searching the user's `static/` dir first,
 * then the app's own static dir, then the app's assets dir.
 * Returns the absolute path, or `null` when the file is nowhere.
 */
export function findLocalIcon(
  iconSpec: string,
  searchDirs: string[],
): string | null {
  for (const dir of searchDirs) {
    const fullPath = path.resolve(dir, iconSpec);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Download a remote icon into the cache dir (keyed by URL hash),
 * returning the cached file's absolute path. A cached download is
 * reused; any failure returns `null` (the caller falls back to the
 * default icon).
 */
export async function downloadIcon(
  url: string,
  cacheDir: string,
): Promise<string | null> {
  try {
    const hash = crypto
      .createHash("sha256")
      .update(url)
      .digest("hex")
      .slice(0, 16);
    const ext = path.extname(new URL(url).pathname).match(/^\.[a-z0-9]+$/i)
      ? path.extname(new URL(url).pathname)
      : ".png";
    const cached = path.join(cacheDir, `remote-icon-${hash}${ext}`);
    if (fs.existsSync(cached)) {
      return cached;
    }
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
    return cached;
  } catch {
    return null;
  }
}

/**
 * Circle-crop an image: resize to a square (cover crops to the
 * smaller side, contain fits the larger side with 15% padding so
 * the image doesn't touch the circle's edges), then mask with a
 * circle. Writes a PNG and returns its path.
 */
export async function reshapeToCircle(
  inputPath: string,
  outputPath: string,
  fitMode: "cover" | "contain",
): Promise<string> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not extract image metadata (width/height)");
  }

  let finalSize: number;
  let resizeSize: number;
  let padding = 0;
  if (fitMode === "contain") {
    finalSize = Math.max(metadata.width, metadata.height);
    // 15% padding so the image doesn't touch the edges of the
    // circle (matches the Astro PWA logic).
    padding = Math.floor(finalSize * 0.15);
    resizeSize = finalSize - padding * 2;
  } else {
    finalSize = Math.min(metadata.width, metadata.height);
    resizeSize = finalSize;
  }

  let pipeline = image.resize({
    width: resizeSize,
    height: resizeSize,
    fit: fitMode,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const radius = finalSize / 2;
  const circleSvg = Buffer.from(
    `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" /></svg>`,
  );
  pipeline = pipeline.composite([{ input: circleSvg, blend: "dest-in" }]);

  await pipeline.png().toFile(outputPath);
  return outputPath;
}

/** Read a CSS custom property's value out of a list of CSS files. */
function readCssVar(varName: string, cssFiles: string[]): string | null {
  const pattern = new RegExp(
    `${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`,
  );
  for (const file of cssFiles) {
    try {
      const match = pattern.exec(fs.readFileSync(file, "utf-8"));
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
 * Build the generated root's `public/` dir as a union: a real
 * directory holding a symlink per entry of the user's `static/`
 * (refreshed here — new entries linked, removed entries pruned)
 * plus the generated files (`favicon/`, `manifest.webmanifest`).
 * Next.js follows symlinks when it copies `public/` (verified in
 * its `recursive-copy.js`), so dev and the static export serve
 * the same files.
 *
 * A legacy whole-dir `public` symlink (the pre-union wiring) is
 * replaced. A real file/dir in the way of a user entry is removed
 * — the user's own files always win over generated ones. Stale
 * pruning only ever removes symlinks, never real files.
 *
 * Returns the linked user entries.
 */
export function ensurePublicUnion({
  projectDir,
  publicDir,
}: {
  projectDir: string;
  publicDir: string;
}): string[] {
  try {
    if (fs.lstatSync(publicDir).isSymbolicLink()) {
      fs.rmSync(publicDir, { force: true });
    }
  } catch {
    // Missing — the dir is created below.
  }
  fs.mkdirSync(publicDir, { recursive: true });

  const staticDir = path.join(projectDir, "static");
  if (!fs.existsSync(staticDir)) {
    return [];
  }
  const entries = fs.readdirSync(staticDir);
  for (const entry of entries) {
    const linkPath = path.join(publicDir, entry);
    const target = `../../static/${entry}`;
    let existing: fs.Stats | null = null;
    try {
      existing = fs.lstatSync(linkPath);
    } catch {
      // Missing — the link is created below.
    }
    if (existing?.isSymbolicLink()) {
      if (fs.readlinkSync(linkPath) !== target) {
        fs.rmSync(linkPath, { force: true });
        fs.symlinkSync(target, linkPath);
      }
    } else if (existing) {
      // A real file/dir is in the way: the user added this entry
      // after generation created it — user wins.
      fs.rmSync(linkPath, { recursive: true, force: true });
      fs.symlinkSync(target, linkPath);
    } else {
      fs.symlinkSync(target, linkPath);
    }
  }
  for (const name of fs.readdirSync(publicDir)) {
    const entryPath = path.join(publicDir, name);
    try {
      if (fs.lstatSync(entryPath).isSymbolicLink() && !entries.includes(name)) {
        fs.rmSync(entryPath, { force: true });
      }
    } catch {
      // Gone already.
    }
  }
  return entries;
}

export interface GenerateFaviconsParams {
  projectDir: string;
  options: PortosaurOptions;
  /** The generated root's `public/` dir (union — see `ensurePublicUnion`). */
  publicDir: string;
  /** Scratch dir for downloads + the reshaped source (`.portosaur/cache`). */
  cacheDir: string;
  /** The app package's `static/` dir (default-icon fallback). */
  appStaticDir: string;
  /** The app package's `assets/` dir (last-resort icon search). */
  appAssetsDir?: string;
  logger?: FaviconLogger | null;
}

interface FaviconStamp {
  source: string;
  mtimeMs: number;
  size: number;
  fitMode: string;
}

const STAMP_FILE = ".favicon.source.json";

/**
 * Generate the per-site favicon set into `publicDir`: `favicon/`
 * (favicon.ico, icon-192x192.png, icon-512x512.png,
 * apple-touch-icon.png) + `manifest.webmanifest` at the public
 * root. Skips when the user provides their own `favicon/` (a
 * symlink from the union) or when the stamp shows the source is
 * unchanged. Any failure resolving the configured icon falls back
 * to the default dino with a warning — only a missing default
 * fails the build.
 */
export async function generateFavicons({
  projectDir,
  options,
  publicDir,
  cacheDir,
  appStaticDir,
  appAssetsDir,
  logger,
}: GenerateFaviconsParams): Promise<{ skipped: boolean; files: string[] }> {
  const log = normalizeLogger(logger);
  const outputDir = path.join(publicDir, "favicon");

  // A symlink here is the user's own favicon dir (linked by the
  // union) — user files always win.
  try {
    if (fs.lstatSync(outputDir).isSymbolicLink()) {
      log.info("Using the project's own favicon/ — skipping generation.");
      return { skipped: true, files: [] };
    }
  } catch {
    // Missing — generation proceeds.
  }

  const spec = resolveSiteIconSpec(options);
  const fitMode = options.siteMode === "docs" ? "contain" : "cover";
  const searchDirs = [
    path.join(projectDir, "static"),
    appStaticDir,
    ...(appAssetsDir ? [appAssetsDir] : []),
  ];

  let sourcePath: string | null = null;
  let sourceLabel = spec;
  if (/^https?:\/\//.test(spec)) {
    sourcePath = await downloadIcon(spec, cacheDir);
    if (!sourcePath) {
      log.warn(
        `Could not download site icon ${spec} — using the default icon.`,
      );
    }
  } else {
    sourcePath = findLocalIcon(spec, searchDirs);
    if (!sourcePath) {
      log.warn(`Site icon not found: ${spec} — using the default icon.`);
    }
  }
  if (!sourcePath) {
    sourcePath = findLocalIcon("img/icon.png", searchDirs);
    sourceLabel = "img/icon.png";
  }
  if (!sourcePath) {
    throw new Error("Default site icon not found: img/icon.png");
  }

  // Fast path: the stamp matches the source — nothing to do. The
  // stamp lives in the cache dir, not the output, so the export
  // carries no build artifacts.
  const stat = fs.statSync(sourcePath);
  const stamp: FaviconStamp = {
    source: sourceLabel,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    fitMode,
  };
  const stampPath = path.join(cacheDir, STAMP_FILE);
  try {
    const saved = JSON.parse(
      fs.readFileSync(stampPath, "utf-8"),
    ) as FaviconStamp;
    const outputs = [
      "favicon.ico",
      "icon-192x192.png",
      "icon-512x512.png",
      "apple-touch-icon.png",
    ].every((name) => fs.existsSync(path.join(outputDir, name)));
    if (
      outputs &&
      fs.existsSync(path.join(publicDir, "manifest.webmanifest")) &&
      saved.source === stamp.source &&
      saved.mtimeMs === stamp.mtimeMs &&
      saved.size === stamp.size &&
      saved.fitMode === stamp.fitMode
    ) {
      return { skipped: true, files: [] };
    }
  } catch {
    // No stamp, or unreadable — regenerate.
  }

  log.info(`Generating favicon assets from ${sourceLabel}...`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  // Legacy cleanup: the stamp used to live in the output dir.
  fs.rmSync(path.join(outputDir, STAMP_FILE), { force: true });
  const reshaped = await reshapeToCircle(
    sourcePath,
    path.join(cacheDir, "reshaped-icon.png"),
    fitMode,
  );
  const baseImage = await sharp(reshaped).png().toBuffer();
  const files = [
    { name: "favicon.ico", size: 32 },
    { name: "icon-192x192.png", size: 192 },
    { name: "icon-512x512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
  ];
  for (const file of files) {
    await sharp(baseImage)
      .resize(file.size, file.size)
      .toFile(path.join(outputDir, file.name));
  }

  const base = options.site.baseUrl;
  const cleanBase =
    !base || base === "/" ? "/" : base.endsWith("/") ? base : `${base}/`;
  const themeColor = readCssVar("--porto-color-bg", options.cssFiles ?? []);
  const manifest: Record<string, unknown> = {
    name: options.site.title || "My Site",
    short_name: options.site.title || "My Site",
    description: options.site.tagline || "A Portosaur Site",
    version: "1.0",
    id: `${cleanBase}?source=pwa`,
    start_url: cleanBase,
    lang: "en",
    scope: cleanBase,
    display: "standalone",
    orientation: "natural",
    icons: [
      {
        src: `${cleanBase}favicon/icon-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${cleanBase}favicon/icon-192x192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${cleanBase}favicon/icon-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${cleanBase}favicon/icon-512x512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  if (themeColor) {
    manifest.theme_color = themeColor;
    manifest.background_color = themeColor;
  }
  fs.writeFileSync(
    path.join(publicDir, "manifest.webmanifest"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);

  log.success("Generated favicon assets successfully.");
  return {
    skipped: false,
    files: [
      ...files.map((file) => `favicon/${file.name}`),
      "manifest.webmanifest",
    ],
  };
}
