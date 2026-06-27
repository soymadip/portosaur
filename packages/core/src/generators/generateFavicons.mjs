import fs from "fs";
import path from "path";
import { getPortoDotDir } from "../utils/fs.mjs";
import { downloadImage } from "../utils/imageDownloader.mjs";
import { reshapeImage } from "../utils/imageProcessor.mjs";
import { processSvg } from "../utils/svgProcessor.mjs";
import { logger } from "@portosaur/logger";
import sharp from "sharp";

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
 *
 * @param {string} siteDir - The root directory of the Docusaurus site.
 * @param {Object} options - Configuration options for generation.
 * @param {string} [options.baseUrl="/"] - Base URL of the site.
 * @param {string} [options.imagePath="img/icon.png"] - Path or URL to the source image.
 * @param {string} [options.appVersion="1.0"] - Version of the application.
 * @param {string} [options.shape="squircle"] - Shape of the generated favicons ("circle", "squircle", "none").
 * @param {string} [options.outputPath="favicon"] - Directory name inside .porto/ to store generated assets.
 * @param {string} [options.themeColor="#3cd759"] - Primary theme color for the PWA.
 * @param {string} [options.backgroundColor="#ffffff"] - Background color for the PWA manifest.
 * @param {string} [options.siteTitle="Portfolio"] - Site title for the manifest.
 * @param {string} [options.siteTagline="Portfolio"] - Site description for the manifest.
 * @param {Array} [options.proxies=[]] - Optional proxies for downloading remote images.
 * @param {Array} [options.staticDirs=["static"]] - Static directories to search for local images.
 * @param {string} [options.portoAssetsDir] - Path to the @portosaur/theme assets directory.
 * @param {string} [options.notesRoute="notes"] - Route path for the notes shortcut.
 * @param {string} [options.blogRoute="blog"] - Route path for the blog shortcut.
 * @param {boolean} [options.tasksEnabled=false] - Whether tasks are enabled (adds a tasks shortcut).
 * @returns {Promise<{success: boolean, html: Array<{tagName: string, attributes: Object}>}>}
 */
export async function generateFavicons(
  siteDir,
  {
    baseUrl = "/",
    imagePath = "img/icon.png",
    appVersion = "1.0",
    shape = "squircle",
    outputPath = "favicon",
    themeColor = "#3cd759",
    backgroundColor = "#1d2c1e",
    siteTitle = "Portfolio",
    siteTagline = "Portfolio",
    proxies = [],
    staticDirs = ["static"],
    portoAssetsDir,
    notesRoute = "notes",
    blogRoute = "blog",
    tasksEnabled = false,
  } = {},
) {
  logger.info("Generating favicons...");

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

  if (!isRemote) {
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

  const hashFilePath = path.join(outputDir, ".favicon.hash");
  const configHash = Buffer.from(
    JSON.stringify({
      imagePath,
      shape,
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
        href: `${cleanBaseUrl}${outputPath}/manifest.webmanifest`,
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
        return { success: true, html: headTags };
      }
    }
  }

  const cacheDir = path.join(getPortoDotDir(siteDir), "cache");

  fs.mkdirSync(cacheDir, { recursive: true });

  const reshapedImagePath = path.join(cacheDir, "profile_pic_reshaped.png");
  const tempFiles = [];

  try {
    const iconColor = { color: themeColor };
    for (const icon of shortcutIcons) {
      try {
        const srcPath = path.resolve(portoAssetsDir, "svg", icon);
        const destPath = path.join(cacheDir, icon);

        await processSvg(srcPath, destPath, iconColor);
      } catch (e) {}
    }

    // Resolve image source
    let downloadedRes;
    const isRemote = /^https?:\/\//.test(imagePath);

    if (isRemote) {
      downloadedRes = await downloadImage(
        imagePath,
        cacheDir,
        "profile_pic_src.png",
        { proxies, cacheDir: path.join(cacheDir, "downloads") },
      );
      tempFiles.push(downloadedRes);
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
          await sharp(svgPath).resize(192, 192).png().toFile(pngPath);
        } catch (e) {
          throw new Error(
            `Failed to generate PNG for shortcut: ${icon}. ${e.message}`,
          );
        }
      }
    }

    //-------- Process screenshots --------
    const screenshotsDir = path.join(siteDir, "assets", "screenshots");
    let manifestScreenshots = [];

    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      const outScreenshotsDir = path.join(outputDir, "screenshots");

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
            src: `${cleanBaseUrl}${outputPath}/screenshots/${destFileName}`,
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
    const manifest = {
      name: siteTitle,
      short_name: siteTitle,
      description: siteTagline,
      version: appVersion,
      id: `${cleanBaseUrl}?source=pwa`,
      start_url: `${cleanBaseUrl}?source=pwa`,
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
      path.join(outputDir, "manifest.webmanifest"),
      JSON.stringify(manifest, null, 2),
    );

    // Save cache and cleanup
    fs.writeFileSync(hashFilePath, configHash, "utf-8");
    tempFiles.forEach(cleanupFile);

    logger.success("Generated Favicon assets successfully.");
    return { success: true, html: headTags };
  } catch (error) {
    logger.error(`Favicon generation failed: ${error.message}`);
    tempFiles.forEach(cleanupFile);
    throw error;
  }
}
