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
 * reused. Any failure returns `null` (the caller falls back to the
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

/** True when `dir` holds only symlinks (or is empty) — the mark of a dir the union built. */
function dirHoldsOnlySymlinks(dir: string): boolean {
  for (const name of fs.readdirSync(dir)) {
    try {
      if (!fs.lstatSync(path.join(dir, name)).isSymbolicLink()) {
        return false;
      }
    } catch {
      // Gone already — treat as a link.
    }
  }
  return true;
}

/** True when `target` exists and is a directory (following symlinks). */
function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Build a merged directory: a real dir holding a symlink per file
 * of the union of a user dir and an app dir, the user's files
 * winning per name, with nested directory collisions merged the
 * same way. Rebuilt from scratch on every run — it only ever
 * holds symlinks the union created, so a rebuild is safe; a real
 * file inside means something else owns the dir and it is left
 * alone.
 */
function linkMergedDir(userDir: string, appDir: string, destDir: string): void {
  let existing: fs.Stats | null = null;
  try {
    existing = fs.lstatSync(destDir);
  } catch {
    // Missing — created below.
  }
  if (existing?.isSymbolicLink()) {
    fs.rmSync(destDir, { force: true });
    existing = null;
  } else if (existing?.isDirectory()) {
    if (dirHoldsOnlySymlinks(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
      existing = null;
    } else {
      // Real files inside — something else owns this dir.
      return;
    }
  } else if (existing) {
    // A real file is in the way — the user dir wins.
    fs.rmSync(destDir, { force: true });
    existing = null;
  }
  fs.mkdirSync(destDir, { recursive: true });
  const userNames = fs.readdirSync(userDir);
  const appNames = fs.readdirSync(appDir);
  for (const name of userNames) {
    const userPath = path.join(userDir, name);
    const appPath = path.join(appDir, name);
    const linkPath = path.join(destDir, name);
    if (
      appNames.includes(name) &&
      isDirectory(userPath) &&
      isDirectory(appPath)
    ) {
      linkMergedDir(userPath, appPath, linkPath);
    } else {
      fs.symlinkSync(
        path.relative(destDir, userPath),
        linkPath,
        isDirectory(userPath) ? "dir" : "file",
      );
    }
  }
  for (const name of appNames) {
    if (userNames.includes(name)) {
      continue;
    }
    const appPath = path.join(appDir, name);
    fs.symlinkSync(
      path.relative(destDir, appPath),
      path.join(destDir, name),
      isDirectory(appPath) ? "dir" : "file",
    );
  }
}

/**
 * Build the generated root's `public/` dir as a union: a real
 * directory holding a symlink per entry of the user's `static/`
 * (refreshed here — new entries linked, removed entries pruned),
 * plus the core package's default static files (`img/icon.png`,
 * ...) where the user has no entry of the same name, plus the
 * generated files (`favicon/`, `manifest.webmanifest`). Next.js
 * follows symlinks when it copies `public/` (verified in its
 * `recursive-copy.js`), so dev and the static export serve the
 * same files.
 *
 * Where both sides have a directory of the same name (the user
 * has `static/img/` and the app ships `img/`), the two merge
 * per file into a real dir, the user's files winning per name —
 * the same precedence the build's post-copy uses, so a user
 * image never hides the app's other images. A file collision
 * keeps the user's file whole.
 *
 * A legacy whole-dir `public` symlink (the pre-union wiring) is
 * replaced. A real file/dir in the way of a user entry is removed
 * — the user's own files always win over generated ones. Stale
 * pruning only ever removes symlinks and merged dirs, never real
 * files.
 *
 * Returns the linked user entries.
 */
export function ensurePublicUnion({
  projectDir,
  publicDir,
  coreStaticDir,
}: {
  projectDir: string;
  publicDir: string;
  /** The core package's default static dir — linked where the user has no entry of the same name. */
  coreStaticDir?: string;
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
  const entries = fs.existsSync(staticDir) ? fs.readdirSync(staticDir) : [];
  const appEntries =
    coreStaticDir && fs.existsSync(coreStaticDir)
      ? fs.readdirSync(coreStaticDir)
      : [];

  // Link one top-level entry as a symlink, refreshed when its
  // target moved. A real file/dir in the way is removed for a
  // user entry (user wins); for an app entry only an
  // all-symlink dir is replaced — real content is never deleted
  // for a default file.
  const linkEntry = (linkPath: string, target: string, userEntry: boolean) => {
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
      if (
        userEntry ||
        (existing.isDirectory() && dirHoldsOnlySymlinks(linkPath))
      ) {
        fs.rmSync(linkPath, { recursive: true, force: true });
        fs.symlinkSync(target, linkPath);
      }
      // Otherwise a real file/dir stands in the way of an app
      // entry — it stays, the default file is skipped.
    } else {
      fs.symlinkSync(target, linkPath);
    }
  };

  for (const entry of entries) {
    const userPath = path.join(staticDir, entry);
    const appPath = coreStaticDir ? path.join(coreStaticDir, entry) : "";
    const linkPath = path.join(publicDir, entry);
    if (
      appEntries.includes(entry) &&
      isDirectory(userPath) &&
      isDirectory(appPath)
    ) {
      // Both sides have this directory — merge per file.
      linkMergedDir(userPath, appPath, linkPath);
    } else {
      // User-only, or a file collision — the user entry wins whole.
      linkEntry(linkPath, `../../static/${entry}`, true);
    }
  }
  for (const entry of appEntries) {
    if (entries.includes(entry)) {
      continue;
    }
    linkEntry(
      path.join(publicDir, entry),
      path.relative(publicDir, path.join(coreStaticDir as string, entry)),
      false,
    );
  }
  const keep = new Set([...entries, ...appEntries]);
  for (const name of fs.readdirSync(publicDir)) {
    if (keep.has(name)) {
      continue;
    }
    const entryPath = path.join(publicDir, name);
    try {
      const st = fs.lstatSync(entryPath);
      if (st.isSymbolicLink()) {
        fs.rmSync(entryPath, { force: true });
      } else if (st.isDirectory() && dirHoldsOnlySymlinks(entryPath)) {
        // A merged dir whose name left both static dirs.
        fs.rmSync(entryPath, { recursive: true, force: true });
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
  /** The core package's `static/` dir (default-icon fallback). */
  coreStaticDir: string;
  /** The core package's `assets/` dir (last-resort icon search). */
  coreAssetsDir?: string;
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
  coreStaticDir,
  coreAssetsDir,
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
    coreStaticDir,
    ...(coreAssetsDir ? [coreAssetsDir] : []),
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
