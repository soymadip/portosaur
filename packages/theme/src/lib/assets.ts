import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import crypto from "node:crypto";
import dns from "node:dns";
import { fileURLToPath } from "node:url";

import { downloadImage, fetchRemoteFileState } from "./imageDownloader.ts";
import { reshapeImage } from "./imageProcessor.ts";
import { getCssVar } from "./cssExtractor.ts";
import type { PortosaurOptions } from "../integration.ts";

// Moved from the engine (D13): site-asset generation runs in the theme
// integration's `astro:build:start` hook. It reads the resolved
// `PortosaurOptions` object (no raw config access, no get() calls) and
// writes all generated files under the `stageDir` passed by the integration
// (`<project>/.portosaur/static`).

/** A logger with the methods the asset pipeline uses (all optional — missing ones fall back to console). */
export interface AssetLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
  success?: (message: string) => void;
}

/** One `<link>` / `<meta>` head tag (the layout renders these). */
export interface HeadTag {
  tagName: string;
  attributes: Record<string, string>;
}

export interface GenerateSiteAssetsParams {
  projectDir: string;
  options: PortosaurOptions;
  stageDir: string;
  logger?: AssetLogger | null;
}

// Theme package root, derived from this file's location:
// `packages/theme/src/lib/` -> `packages/theme/`.
const themeRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
// Theme input search dirs (read-only): the theme's own static files and
// bundled assets, used as fallbacks when resolving the profile picture,
// the default icon, and the sample resume.
const themeStaticDir = path.join(themeRoot, "static");
const themeAssetsDir = path.join(themeRoot, "assets");

function cleanupFile(filePath: string): boolean {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {}
  }
  return false;
}

/** A config image value: a plain local path, or a `{ src, fallback }` object for remote images. */
type ImageValue =
  string | { src?: string; fallback?: string } | null | undefined;

// The config resolver (`buildSiteConfig`) turns remote image URLs into
// `{ src, fallback }` objects via `genFallback`; local images stay plain
// strings. Unwrap to the raw URL/path the asset pipeline expects.
function unwrapImage(value: ImageValue): string | null | undefined {
  if (!value) {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.src ?? null;
}

// Normalize the caller-provided logger: any missing method falls back to
// the console equivalent. `success` maps to the logger's `info` when the
// logger has no `success` (Astro's logger doesn't) — success renders as
// info, same as the CLI logger — and only reaches `console.info` when
// there is no logger at all.
function normalizeLogger(logger?: AssetLogger | null): Required<AssetLogger> {
  const fallback: Required<AssetLogger> = {
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

function cleanBaseUrlOf(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/**
 * Builds the favicon/manifest head tags for the resolved site config,
 * without running any generation. The layout renders these links; the
 * files they point to are produced by `generateSiteAssets` during
 * `astro:build:start`.
 *
 * The `theme-color` meta tag is included only when the theme color can be
 * resolved from the site CSS files; generation itself throws in that case,
 * so a successful build always has it.
 *
 * @param options - The resolved `PortosaurOptions` object.
 * @returns The head tags (favicon, icons, manifest, theme-color).
 */
export function getAssetHeadTags(options: PortosaurOptions): HeadTag[] {
  const cleanBaseUrl = cleanBaseUrlOf(options.site.baseUrl);
  const outputPath = "favicon";
  const themeColor = getCssVar("--color-background", options.cssFiles ?? []);

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

/**
 * Generates modern favicon assets and PWA manifests using pure sharp.
 * Resolves necessary parameters from the resolved site config and theme CSS.
 *
 * All generated outputs are written under `stageDir`:
 * `favicon/`, `fallbacks/`, `screenshots/`, `manifest.webmanifest`,
 * `sample-resume.pdf`, and the `favicon/.favicon.hash` cache marker.
 * The temporary working cache lives next to it in `<stageDir>/../cache`
 * (i.e. `<project>/.portosaur/cache` when the integration passes
 * `<project>/.portosaur/static` as the stage dir).
 *
 * Skips regeneration when the hash of the inputs (source image state,
 * screenshot files, fallback states, colors, shape) is unchanged and the
 * favicon output already exists. When offline, remote images fall back to
 * the download cache (or the default theme icon for the profile picture)
 * and fallback downloads are skipped.
 *
 * @param params - Generation parameters.
 * @param params.projectDir - The absolute path to the user's project directory.
 * @param params.options - The resolved `PortosaurOptions` object.
 * @param params.stageDir - Absolute path to write generated files into.
 * @param params.logger - Logger with info/warn/error/success methods (defaults to console).
 */
export async function generateSiteAssets({
  projectDir,
  options,
  stageDir,
  logger,
}: GenerateSiteAssetsParams): Promise<{ extraHeadTags: HeadTag[] }> {
  const log = normalizeLogger(logger);

  const cssFilesToParse = options.cssFiles ?? [];

  const primaryColor = getCssVar(
    "--color-primary",
    cssFilesToParse,
    undefined,
    undefined,
    log,
  );
  const backgroundColor = getCssVar(
    "--color-background",
    cssFilesToParse,
    undefined,
    undefined,
    log,
  );
  const themeColor = getCssVar(
    "--color-background",
    cssFilesToParse,
    undefined,
    undefined,
    log,
  );

  if (!themeColor) {
    throw new Error(
      "Failed to resolve PWA theme color from CSS variables (--color-background).",
    );
  }
  if (!backgroundColor) {
    throw new Error(
      "Failed to resolve PWA background color from CSS variables (--color-background).",
    );
  }

  const siteMode = options.siteMode;

  const fallbackTargets = [
    ...(siteMode === "docs"
      ? [
          options.docsHome?.icon,
          ...(options.docsHome?.features || []).map((f: any) => f.icon),
          ...(options.docsHome?.actions || []).map((a: any) => a.icon),
        ]
      : [
          options.homePage?.heroSection?.profilePic,
          ...(options.homePage?.projectShelf?.projects || []).map(
            (p: any) => p.icon,
          ),
        ]),
  ]
    .map(unwrapImage)
    .filter(Boolean);

  const baseUrl = options.site.baseUrl;

  const siteTitle = options.site.title || "My Site";

  const siteTagline = options.site.tagline || "A Portosaur Site";

  const imagePath =
    unwrapImage(
      siteMode === "docs"
        ? options.docsHome?.icon
        : options.homePage?.heroSection?.profilePic,
    ) || "img/icon.png";

  const notesRoute = options.site.notesRoute;
  const blogRoute = options.site.blogRoute;
  const tasksEnabled = options.tasks?.enable || false;

  const staticDirs = [path.join(projectDir, "static"), themeStaticDir];
  const portoAssetsDir = themeAssetsDir;
  const screenshotsDir = path.join(projectDir, "assets", "screenshots");

  const outputPath = "favicon";
  const shape = "circle";
  const fitMode = siteMode === "docs" ? "contain" : "cover";
  const appVersion = "1.0";
  const proxies: string[] = [];

  log.info("Generating Site Assets...");

  const shortcutIcons = [
    { id: "mdi:notebook", name: "icon-note.svg" },
    { id: "fa7-solid:blog", name: "icon-blog.svg" },
    { id: "fa7-solid:tasks", name: "icon-tasks.svg" },
  ];
  const outputDir = path.join(stageDir, outputPath);

  const getFileState = (filePath: string): string => {
    try {
      const stat = fs.statSync(filePath);
      return `${filePath}:${stat.mtimeMs}:${stat.size}`;
    } catch {
      return `${filePath}:missing`;
    }
  };

  const fileStates: string[] = [];

  const isRemote = /^https?:\/\//.test(imagePath);
  let remoteState: string | null = null;

  // Resolve offline state once before doing any network activities
  let isOffline = false;
  if (
    isRemote ||
    fallbackTargets.some((url) => url && /^https?:\/\//.test(url))
  ) {
    isOffline = await new Promise<boolean>((resolve) => {
      dns.lookup("dns.google", (err) => resolve(!!err));
    });
  }

  if (isRemote) {
    if (isOffline) {
      remoteState = "remote:offline";
    } else {
      remoteState = await fetchRemoteFileState(imagePath);
    }
    fileStates.push(remoteState);
  } else {
    let localPath: string | null = null;
    for (const sDir of staticDirs) {
      const fullPath = path.resolve(sDir, imagePath);
      if (fs.existsSync(fullPath)) {
        localPath = fullPath;
        break;
      }
    }

    if (!localPath && portoAssetsDir) {
      const portoPath = path.resolve(portoAssetsDir, imagePath);
      if (fs.existsSync(portoPath)) {
        localPath = portoPath;
      }
    }
    if (localPath) {
      fileStates.push(getFileState(localPath));
    }
  }

  // Include screenshots directory state in the configHash to invalidate cache when screenshots change
  if (fs.existsSync(screenshotsDir)) {
    const screenshotFiles = fs.readdirSync(screenshotsDir);
    for (const file of screenshotFiles.sort()) {
      if (file.match(/\.(png|jpe?g|webp)$/i)) {
        fileStates.push(getFileState(path.join(screenshotsDir, file)));
      }
    }
  }

  // Collect remote images for offline fallbacks
  log.info("Generating fallback images...");

  const remoteFallbacks: { url: string; name: string; state?: string }[] = [];

  const addFallback = (url: string | null | undefined): void => {
    if (url && /^https?:\/\//.test(url)) {
      if (!remoteFallbacks.some((f) => f.url === url)) {
        remoteFallbacks.push({
          url,
          name: crypto.createHash("md5").update(url).digest("hex") + ".png",
        });
      }
    }
  };

  fallbackTargets.forEach(addFallback);

  for (const fallback of remoteFallbacks) {
    if (isOffline) {
      fallback.state = "remote:offline";
    } else {
      fallback.state = await fetchRemoteFileState(fallback.url);
    }
    fileStates.push(fallback.state);
  }

  const hashFilePath = path.join(outputDir, ".favicon.hash");
  const configHash = Buffer.from(
    JSON.stringify({
      imagePath,
      shape,
      fitMode,
      outputPath,
      themeColor,
      backgroundColor,
      fileStates,
    }),
  ).toString("base64");

  const cleanBaseUrl = cleanBaseUrlOf(baseUrl);

  const headTags = getAssetHeadTags(options);

  if (fs.existsSync(hashFilePath)) {
    const existingHash = fs.readFileSync(hashFilePath, "utf-8");

    if (existingHash === configHash) {
      if (fs.existsSync(path.join(outputDir, "favicon.ico"))) {
        log.info("Favicons are up to date, skipping generation.");
        return { extraHeadTags: headTags };
      }
    }
  }

  const cacheDir = path.resolve(stageDir, "..", "cache");

  fs.mkdirSync(cacheDir, { recursive: true });

  const reshapedImagePath = path.join(cacheDir, "profile_pic_reshaped.png");
  const tempFiles: string[] = [];

  log.info("Generating Shortcut icons...");
  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);

    for (const icon of shortcutIcons) {
      try {
        const destPath = path.join(cacheDir, icon.name);

        const [prefix, name] = icon.id.split(":");
        const jsonPath = require.resolve(`@iconify-json/${prefix}/icons.json`, {
          paths: [themeRoot],
        });

        const iconData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        const iconMeta = iconData.icons[name];

        if (!iconMeta) {
          continue;
        }

        const width =
          iconMeta.width || iconData.info?.width || iconData.width || 24;

        const height =
          iconMeta.height || iconData.info?.height || iconData.height || 24;

        // Apply primaryColor by replacing currentColor
        const body = iconMeta.body.replace(
          /currentColor/g,
          String(primaryColor),
        );

        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;

        fs.writeFileSync(destPath, svgContent, "utf-8");
      } catch (e) {
        log.warn(
          `Failed to generate shortcut icon ${icon.id}: ${(e as Error).message}`,
        );
      }
    }

    const fallbacksDir = path.join(stageDir, "fallbacks");

    if (remoteFallbacks.length > 0) {
      if (isOffline) {
        log.warn(`System is offline. Skipping all offline fallback downloads.`);
      } else {
        log.info("Downloading images for offline fallbacks...");
        fs.mkdirSync(fallbacksDir, { recursive: true });
      }
    }

    for (const fallback of remoteFallbacks) {
      if (isOffline) {
        continue;
      }
      log.info(`Downloading offline fallback: ${fallback.url}`);

      try {
        const downloaded = await downloadImage({
          url: fallback.url,
          destDir: cacheDir,
          fileName: fallback.name,
          proxies,
          cacheDir: path.join(cacheDir, "downloads"),
          remoteState: fallback.state,
          logger: log,
        });
        fs.copyFileSync(downloaded, path.join(fallbacksDir, fallback.name));
        tempFiles.push(downloaded);
      } catch (e) {
        const stillOffline = await new Promise<boolean>((resolve) => {
          dns.lookup("dns.google", (err) => resolve(!!err));
        });

        if (stillOffline) {
          log.warn(
            `System is offline. Skipping offline fallback download for: ${fallback.url}`,
          );
        } else {
          throw new Error(
            `Broken image URL detected in config: ${fallback.url} (${(e as Error).message})`,
          );
        }
      }
    }

    // Resolve image source
    let downloadedRes: string;

    if (isRemote) {
      if (isOffline) {
        const downloadsDir = path.join(cacheDir, "downloads");
        let foundCached: string | null = null;
        if (fs.existsSync(downloadsDir)) {
          try {
            const cachedFiles = fs.readdirSync(downloadsDir);
            const profilePicFile = cachedFiles.find((f) =>
              f.endsWith("-profile_pic_src.png"),
            );
            if (profilePicFile) {
              foundCached = path.join(downloadsDir, profilePicFile);
            }
          } catch (e) {}
        }

        if (foundCached && fs.existsSync(foundCached)) {
          log.info("System is offline. Using cached profile picture.");
          const destPath = path.join(cacheDir, "profile_pic_src.png");
          fs.copyFileSync(foundCached, destPath);
          downloadedRes = destPath;
        } else {
          log.warn(
            `System is offline and profile picture is not cached. Falling back to default theme icon for asset generation.`,
          );

          // fallback to default image
          downloadedRes = path.join(themeStaticDir, "img", "icon.png");
        }
      } else {
        try {
          downloadedRes = await downloadImage({
            url: imagePath,
            destDir: cacheDir,
            fileName: "profile_pic_src.png",
            proxies,
            cacheDir: path.join(cacheDir, "downloads"),
            remoteState,
            logger: log,
          });
          tempFiles.push(downloadedRes);
        } catch (e) {
          const stillOffline = await new Promise<boolean>((resolve) => {
            dns.lookup("dns.google", (err) => resolve(!!err));
          });

          if (stillOffline) {
            const downloadsDir = path.join(cacheDir, "downloads");
            let foundCached: string | null = null;
            if (fs.existsSync(downloadsDir)) {
              try {
                const cachedFiles = fs.readdirSync(downloadsDir);
                const profilePicFile = cachedFiles.find((f) =>
                  f.endsWith("-profile_pic_src.png"),
                );
                if (profilePicFile) {
                  foundCached = path.join(downloadsDir, profilePicFile);
                }
              } catch (e) {}
            }

            if (foundCached && fs.existsSync(foundCached)) {
              log.info("System is offline. Using cached profile picture.");
              const destPath = path.join(cacheDir, "profile_pic_src.png");
              fs.copyFileSync(foundCached, destPath);
              downloadedRes = destPath;
            } else {
              log.warn(
                `System is offline and profile picture is not cached. Falling back to default theme icon for asset generation.`,
              );

              // fallback to default image
              downloadedRes = path.join(themeStaticDir, "img", "icon.png");
            }
          } else {
            throw new Error(
              `Failed to download profile picture: ${imagePath} (${(e as Error).message})`,
            );
          }
        }
      }
    } else {
      let localPath: string | null = null;
      for (const sDir of staticDirs) {
        const fullPath = path.resolve(sDir, imagePath);
        if (fs.existsSync(fullPath)) {
          localPath = fullPath;
          break;
        }
      }

      if (!localPath && portoAssetsDir) {
        const portoPath = path.resolve(portoAssetsDir, imagePath);
        if (fs.existsSync(portoPath)) {
          localPath = portoPath;
        }
      }
      if (!localPath) {
        throw new Error(`Local profile picture not found: ${imagePath}`);
      }
      downloadedRes = localPath;
    }

    let finalImagePath = await reshapeImage(
      downloadedRes,
      reshapedImagePath,
      shape,
      fitMode,
      log,
    );
    if (finalImagePath !== downloadedRes) {
      tempFiles.push(finalImagePath);
    }

    fs.mkdirSync(outputDir, { recursive: true });

    //
    // -------- Generate Favicon Pics ------------

    log.info(`Generating assets from ${finalImagePath}...`);

    const baseImage = await sharp(finalImagePath).png().toBuffer();

    await sharp(baseImage)
      .resize(32, 32)
      .toFile(path.join(outputDir, "favicon.ico"));

    await sharp(baseImage)
      .resize(192, 192)
      .toFile(path.join(outputDir, "icon-192x192.png"));

    await sharp(baseImage)
      .resize(512, 512)
      .toFile(path.join(outputDir, "icon-512x512.png"));

    await sharp(baseImage)
      .resize(180, 180)
      .toFile(path.join(outputDir, "apple-touch-icon.png"));

    //
    // ---- Convert SVGs to PNG for shortcuts ---

    for (const icon of shortcutIcons) {
      const svgPath = path.join(cacheDir, icon.name);

      const baseName = icon.name.replace(/\.svg$/, "");
      const pngPath = path.join(outputDir, `${baseName}-192x192.png`);

      if (fs.existsSync(svgPath)) {
        try {
          // Add 24px padding to fix cropping in menu
          await sharp(svgPath)
            .resize(144, 144, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .extend({
              top: 24,
              bottom: 24,
              left: 24,
              right: 24,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toFile(pngPath);
        } catch (e) {
          throw new Error(
            `Failed to generate PNG for shortcut: ${icon.name}. ${(e as Error).message}`,
          );
        }
      }
    }

    //-------- Process screenshots --------
    log.info("Processing PWA screenshots...");
    let manifestScreenshots: {
      src: string;
      sizes: string;
      type: string;
      form_factor: string;
    }[] = [];

    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      const outScreenshotsDir = path.join(stageDir, "screenshots");

      fs.mkdirSync(outScreenshotsDir, { recursive: true });

      for (const file of files) {
        if (file.match(/\.(png|jpe?g|webp)$/i)) {
          const srcPath = path.join(screenshotsDir, file);
          const metadata = await sharp(srcPath).metadata();

          if (metadata.width === metadata.height) {
            throw new Error(
              `Screenshot "${file}" is square (${metadata.width}x${metadata.height}). PWA screenshots must be strictly wide (landscape) or narrow (portrait) to satisfy browser installability criteria.`,
            );
          }
          const formFactor =
            metadata.width! > metadata.height! ? "wide" : "narrow";

          const destFileName = file.replace(/\.[^.]+$/, ".webp");
          const destPath = path.join(outScreenshotsDir, destFileName);

          await sharp(srcPath).webp({ quality: 80 }).toFile(destPath);

          manifestScreenshots.push({
            src: `${cleanBaseUrl}screenshots/${destFileName}`,
            sizes: `${metadata.width}x${metadata.height}`,
            type: "image/webp",
            form_factor: formFactor,
          });
        }
      }

      if (manifestScreenshots.length > 0) {
        manifestScreenshots.sort((a, b) => {
          if (a.form_factor === "narrow" && b.form_factor !== "narrow") {
            return -1;
          }
          if (a.form_factor !== "narrow" && b.form_factor === "narrow") {
            return 1;
          }

          const aIsHome = a.src.match(/\/home-/i);
          const bIsHome = b.src.match(/\/home-/i);

          if (aIsHome && !bIsHome) {
            return -1;
          }
          if (!aIsHome && bIsHome) {
            return 1;
          }

          return a.src.localeCompare(b.src);
        });
      }
    }

    // --- Conditionally copy sample resume ---
    if (portoAssetsDir) {
      const resumeRef = options.homePage?.aboutSection?.resume;
      // Because `{{porto_static}}` resolves to `/`, the resolved path in config might be `/sample-resume.pdf`
      // Check if it ends with sample-resume.pdf and there isn't a custom http link
      if (
        resumeRef &&
        resumeRef.endsWith("sample-resume.pdf") &&
        !/^https?:\/\//.test(resumeRef)
      ) {
        const srcResume = path.resolve(portoAssetsDir, "sample-resume.pdf");
        const destResume = path.join(stageDir, "sample-resume.pdf");
        if (fs.existsSync(srcResume)) {
          fs.mkdirSync(path.dirname(destResume), { recursive: true });
          fs.copyFileSync(srcResume, destResume);
        }
      }
    }

    // Generate manifest.webmanifest
    log.info("Generating Web App Manifest...");
    const manifest = {
      name: siteTitle,
      short_name: siteTitle,
      description: siteTagline,
      version: appVersion,
      id: `${cleanBaseUrl}?source=pwa`,
      start_url: `${cleanBaseUrl}`,
      lang: "en",
      categories: ["social", "productivity", "lifestyle", "education"],
      scope: cleanBaseUrl,
      theme_color: themeColor,
      background_color: backgroundColor,
      display: "standalone",
      orientation: "natural",
      icons: [
        {
          src: `${cleanBaseUrl}${outputPath}/icon-192x192.png`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `${cleanBaseUrl}${outputPath}/icon-192x192.png`,
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: `${cleanBaseUrl}${outputPath}/icon-512x512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `${cleanBaseUrl}${outputPath}/icon-512x512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],

      screenshots:
        manifestScreenshots.length > 0 ? manifestScreenshots : undefined,

      shortcuts: [
        {
          name: "Notes",
          short_name: "Notes",
          description: "Read the Notes",
          url: `${cleanBaseUrl}${notesRoute}`,
          icons: [
            {
              src: `${cleanBaseUrl}${outputPath}/icon-note-192x192.png`,
              type: "image/png",
              sizes: "192x192",
              purpose: "any",
            },
          ],
        },
        {
          name: "Blog",
          short_name: "Blog",
          description: "Checkout latest Blog Posts",
          url: `${cleanBaseUrl}${blogRoute}`,
          icons: [
            {
              src: `${cleanBaseUrl}${outputPath}/icon-blog-192x192.png`,
              type: "image/png",
              sizes: "192x192",
              purpose: "any",
            },
          ],
        },
      ],
    };

    if (tasksEnabled) {
      manifest.shortcuts.push({
        name: "Tasks",
        short_name: "Tasks",
        description: "View my tasks",
        url: `${cleanBaseUrl}tasks`,
        icons: [
          {
            src: `${cleanBaseUrl}${outputPath}/icon-tasks-192x192.png`,
            type: "image/png",
            sizes: "192x192",
            purpose: "any",
          },
        ],
      });
    }

    fs.writeFileSync(
      path.join(stageDir, "manifest.webmanifest"),
      JSON.stringify(manifest, null, 2),
    );

    // Save cache and cleanup
    fs.writeFileSync(hashFilePath, configHash, "utf-8");
    tempFiles.forEach(cleanupFile);

    log.success("Generated Favicon assets successfully.");
    return { extraHeadTags: headTags };
  } catch (error) {
    log.error(`Favicon generation failed: ${(error as Error).message}`);
    tempFiles.forEach(cleanupFile);
    throw error;
  }
}
