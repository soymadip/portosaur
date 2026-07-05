import fs from "fs";
import path from "path";
import sharp from "sharp";
import { logger } from "@portosaur/logger";
import crypto from "crypto";
import dns from "dns";

import { getPortoDotDir } from "../utils/fs.mjs";
import {
  downloadImage,
  fetchRemoteFileState,
} from "../utils/imageDownloader.mjs";
import { reshapeImage } from "../utils/imageProcessor.mjs";
import { processSvg } from "../utils/svgProcessor.mjs";
import { getCssVar } from "../utils/cssExtractor.mjs";
import { resolveSiteCssFiles, resolveBasePath } from "../utils/docusaurus.mjs";

function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Generates modern favicon assets and PWA manifests using pure sharp.
 * Resolves necessary parameters from the user's configuration and theme CSS.
 *
 * @param {Object} options - Configuration options.
 * @param {string} options.UserRoot - The root directory of the Docusaurus site.
 * @param {Object} options.userConfig - The user configuration object.
 * @param {Object} options.portoPaths - The resolved paths object for the theme/core.
 * @returns {Promise<{extraHeadTags: string}>}
 */
export async function generateSiteAssets({ UserRoot, userConfig, portoPaths }) {
  const cssFilesToParse = resolveSiteCssFiles(
    UserRoot,
    userConfig,
    portoPaths.theme,
  );

  const primaryColor = getCssVar("--ifm-color-primary", cssFilesToParse);
  const backgroundColor = getCssVar("--ifm-background-color", cssFilesToParse);
  const themeColor = getCssVar(
    "--ifm-navbar-background-color",
    cssFilesToParse,
  );

  if (!themeColor) {
    throw new Error(
      "Failed to resolve PWA theme color from CSS variables (--ifm-navbar-background-color).",
    );
  }
  if (!backgroundColor) {
    throw new Error(
      "Failed to resolve PWA background color from CSS variables (--ifm-background-color).",
    );
  }

  const fallbackTargets = [
    ...(userConfig.home_page?.project_shelf?.projects || []).map((p) => p.icon),
  ];

  const siteDir = UserRoot;
  const baseUrl = resolveBasePath(userConfig.site?.base_url || "auto");

  const siteTitle =
    userConfig.site?.title || userConfig.home_page?.hero?.title || "Portfolio";

  const siteTagline =
    userConfig.site?.tagline ||
    userConfig.home_page?.hero?.desc ||
    "Welcome to my Portfolio";

  const imagePath =
    userConfig.site?.favicon ||
    userConfig.home_page?.hero?.profile_pic ||
    "img/icon.png";

  const notesRoute = userConfig.site?.notes?.route || "notes";
  const blogRoute = userConfig.site?.blog?.route || "blog";
  const tasksEnabled = userConfig.tasks?.enable || false;

  const staticDirs = ["static", portoPaths.static];
  const portoAssetsDir = portoPaths.assets;
  const screenshotsDir = path.join(siteDir, "assets", "screenshots");

  const outputPath = "favicon";
  const shape = "circle";
  const fitMode = siteMode === "docs" ? "contain" : "cover";
  const appVersion = "1.0";
  const proxies = [];

  logger.info("Generating Site Assets...");

  const shortcutIcons = ["icon-note.svg", "icon-blog.svg", "icon-tasks.svg"];
  const outputDir = path.join(getPortoDotDir(siteDir), "static", outputPath);

  const getFileState = (filePath) => {
    try {
      const stat = fs.statSync(filePath);
      return `${filePath}:${stat.mtimeMs}:${stat.size}`;
    } catch {
      return `${filePath}:missing`;
    }
  };

  const fileStates = [];

  if (portoAssetsDir) {
    for (const icon of shortcutIcons) {
      const srcPath = path.resolve(portoAssetsDir, "svg", icon);
      fileStates.push(getFileState(srcPath));
    }
  }

  const isRemote = /^https?:\/\//.test(imagePath);
  let remoteState = null;

  // Resolve offline state once before doing any network activities
  let isOffline = false;
  if (
    isRemote ||
    fallbackTargets.some((url) => url && /^https?:\/\//.test(url))
  ) {
    isOffline = await new Promise((resolve) => {
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
    let localPath = null;
    for (const sDir of staticDirs) {
      const fullPath = path.resolve(siteDir, sDir, imagePath);
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
  logger.info("Generating fallback images...");

  const remoteFallbacks = [];

  const addFallback = (url) => {
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

  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  const headTags = [
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
    {
      tagName: "meta",
      attributes: {
        name: "theme-color",
        content: themeColor,
      },
    },
  ];

  if (fs.existsSync(hashFilePath)) {
    const existingHash = fs.readFileSync(hashFilePath, "utf-8");

    if (existingHash === configHash) {
      if (fs.existsSync(path.join(outputDir, "favicon.ico"))) {
        logger.info("Favicons are up to date, skipping generation.");
        return { extraHeadTags: headTags };
      }
    }
  }

  const cacheDir = path.join(getPortoDotDir(siteDir), "cache");

  fs.mkdirSync(cacheDir, { recursive: true });

  const reshapedImagePath = path.join(cacheDir, "profile_pic_reshaped.png");
  const tempFiles = [];

  logger.info("Generating Shortcut icons...");
  try {
    const iconColor = { color: primaryColor };

    for (const icon of shortcutIcons) {
      try {
        const srcPath = path.resolve(portoAssetsDir, "svg", icon);
        const destPath = path.join(cacheDir, icon);

        await processSvg(srcPath, destPath, iconColor);
      } catch (e) {}
    }

    const fallbacksDir = path.join(
      getPortoDotDir(siteDir),
      "static",
      "fallbacks",
    );

    if (remoteFallbacks.length > 0) {
      if (isOffline) {
        logger.warn(
          `System is offline. Skipping all offline fallback downloads.`,
        );
      } else {
        logger.info("Downloading images for offline fallbacks...");
        fs.mkdirSync(fallbacksDir, { recursive: true });
      }
    }

    for (const fallback of remoteFallbacks) {
      if (isOffline) {
        continue;
      }
      logger.info(`Downloading offline fallback: ${fallback.url}`);

      try {
        const downloaded = await downloadImage({
          url: fallback.url,
          destDir: cacheDir,
          fileName: fallback.name,
          proxies,
          cacheDir: path.join(cacheDir, "downloads"),
          remoteState: fallback.state,
        });
        fs.copyFileSync(downloaded, path.join(fallbacksDir, fallback.name));
        tempFiles.push(downloaded);
      } catch (e) {
        const stillOffline = await new Promise((resolve) => {
          dns.lookup("dns.google", (err) => resolve(!!err));
        });

        if (stillOffline) {
          logger.warn(
            `System is offline. Skipping offline fallback download for: ${fallback.url}`,
          );
        } else {
          throw new Error(
            `Broken image URL detected in config: ${fallback.url} (${e.message})`,
          );
        }
      }
    }

    // Resolve image source
    let downloadedRes;
    const isRemote = /^https?:\/\//.test(imagePath);

    if (isRemote) {
      if (isOffline) {
        const downloadsDir = path.join(cacheDir, "downloads");
        let foundCached = null;
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
          logger.info("System is offline. Using cached profile picture.");
          const destPath = path.join(cacheDir, "profile_pic_src.png");
          fs.copyFileSync(foundCached, destPath);
          downloadedRes = destPath;
        } else {
          logger.warn(
            `System is offline and profile picture is not cached. Falling back to default theme icon for asset generation.`,
          );

          // fallback to default image
          downloadedRes = path.resolve(
            portoPaths.theme,
            "static",
            "img",
            "icon.png",
          );
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
          });
          tempFiles.push(downloadedRes);
        } catch (e) {
          const stillOffline = await new Promise((resolve) => {
            dns.lookup("dns.google", (err) => resolve(!!err));
          });

          if (stillOffline) {
            const downloadsDir = path.join(cacheDir, "downloads");
            let foundCached = null;
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
              logger.info("System is offline. Using cached profile picture.");
              const destPath = path.join(cacheDir, "profile_pic_src.png");
              fs.copyFileSync(foundCached, destPath);
              downloadedRes = destPath;
            } else {
              logger.warn(
                `System is offline and profile picture is not cached. Falling back to default theme icon for asset generation.`,
              );

              // fallback to default image
              downloadedRes = path.resolve(
                portoPaths.theme,
                "static",
                "img",
                "icon.png",
              );
            }
          } else {
            throw new Error(
              `Failed to download profile picture: ${imagePath} (${e.message})`,
            );
          }
        }
      }
    } else {
      let localPath = null;
      for (const sDir of staticDirs) {
        const fullPath = path.resolve(siteDir, sDir, imagePath);
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
      fitMode
    );
    if (finalImagePath !== downloadedRes) {
      tempFiles.push(finalImagePath);
    }

    fs.mkdirSync(outputDir, { recursive: true });

    //
    // -------- Generate Favicon Pics ------------

    logger.info(`Generating assets from ${finalImagePath}...`);

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
      const svgPath = path.join(cacheDir, icon);

      const baseName = icon.replace(/\.svg$/, "");
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
            `Failed to generate PNG for shortcut: ${icon}. ${e.message}`,
          );
        }
      }
    }

    //-------- Process screenshots --------
    logger.info("Processing PWA screenshots...");
    let manifestScreenshots = [];

    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      const outScreenshotsDir = path.join(
        getPortoDotDir(siteDir),
        "static",
        "screenshots",
      );

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
            metadata.width > metadata.height ? "wide" : "narrow";

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

          if (aIsHome && !bIsHome) return -1;
          if (!aIsHome && bIsHome) return 1;

          return a.src.localeCompare(b.src);
        });
      }
    }

    // Generate manifest.webmanifest
    logger.info("Generating Web App Manifest...");
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
      path.join(getPortoDotDir(siteDir), "static", "manifest.webmanifest"),
      JSON.stringify(manifest, null, 2),
    );

    // Save cache and cleanup
    fs.writeFileSync(hashFilePath, configHash, "utf-8");
    tempFiles.forEach(cleanupFile);

    logger.success("Generated Favicon assets successfully.");
    return { extraHeadTags: headTags };
  } catch (error) {
    logger.error(`Favicon generation failed: ${error.message}`);
    tempFiles.forEach(cleanupFile);
    throw error;
  }
}
