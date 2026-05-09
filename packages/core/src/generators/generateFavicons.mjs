import fs from "fs";
import path from "path";
import { favicons } from "favicons";
import { downloadImage } from "../utils/imageDownloader.mjs";
import { reshapeImage } from "../utils/imageProcessor.mjs";
import { extractSvg } from "../utils/iconExtractor.mjs";
import { logger } from "@portosaur/logger";

//  Helper Functions

function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  return false;
}

function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {}
  }
  return false;
}

function processManifest(manifestFile, outputDir, appVersion) {
  try {
    const manifest = JSON.parse(manifestFile.contents);
    manifest.version = appVersion;
    fs.writeFileSync(
      path.join(outputDir, manifestFile.name),
      JSON.stringify(manifest, null, 2),
    );
    return true;
  } catch (err) {
    logger.error(`Failed to process manifest: ${err.message}`);
    fs.writeFileSync(
      path.join(outputDir, manifestFile.name),
      manifestFile.contents,
    );
    return false;
  }
}

/**
 * Converts a raw HTML tag string from the favicons library into a Docusaurus
 * headTag object: { tagName, attributes }.
 *
 * Example input:  '<link rel="icon" href="/favicon/favicon.ico">'
 * Example output: { tagName: 'link', attributes: { rel: 'icon', href: '/favicon/favicon.ico' } }
 */
function parseHtmlTagString(htmlString) {
  const tagMatch = htmlString.match(/^<(\w+)/);
  if (!tagMatch) {
    return null;
  }

  const tagName = tagMatch[1];
  const attributes = {};
  const attrRegex = /([\w-]+)(?:=["']([^"']*)["'])?/g;

  // Skip past the opening tag name to only match attributes
  attrRegex.lastIndex = tagName.length + 1;
  let match;
  while ((match = attrRegex.exec(htmlString)) !== null) {
    if (match[0] === tagName) {
      continue;
    }
    attributes[match[1]] = match[2] ?? "";
  }

  return { tagName, attributes };
}

//  Main Generation Function

export async function generateFavicons(siteDir, options = {}) {
  logger.info("Generating favicons...");

  // Setup options and paths
  const profilePicUrl = options.imagePath || "img/icon.png";
  const appVersion = options.appVersion || "1.0";
  const circular = options.circular !== false;
  const shape = options.shape || "circle";
  const proxies = options.proxies || [];
  const staticBaseDir = path.resolve(siteDir, "static");
  const imgDir = path.join(staticBaseDir, "img", "svg");
  const outputDir = path.join(
    siteDir,
    ".docusaurus/portosaur",
    options.outputPath || "favicon",
  );
  const configHash = Buffer.from(
    JSON.stringify({
      profilePicUrl,
      shape,
      circular,
      outputPath: options.outputPath,
    }),
  ).toString("base64");
  const hashFilePath = path.join(outputDir, ".favicon.hash");

  // Check cache hash and skip if unchanged
  if (fs.existsSync(hashFilePath)) {
    const existingHash = fs.readFileSync(hashFilePath, "utf-8");
    if (existingHash === configHash) {
      const htmlFilePath = path.join(outputDir, ".favicon.html");
      if (fs.existsSync(path.join(outputDir, "favicon.ico"))) {
        logger.info("Favicons are up to date, skipping generation.");
        try {
          const cachedHtml = JSON.parse(fs.readFileSync(htmlFilePath, "utf-8"));
          const headTags = cachedHtml.map(parseHtmlTagString).filter(Boolean);
          return { success: true, html: headTags };
        } catch (e) {
          return { success: true, html: [] };
        }
      }
    }
  }

  const cacheDir = path.join(siteDir, ".docusaurus", "portosaur", "cache");
  createDirectoryIfNotExists(cacheDir);
  const reshapedImagePath = path.join(cacheDir, "profile_pic_reshaped.png");
  const tempFiles = [];

  try {
    // Setup theme colors and configuration
    const primaryColor = options.themeColor || "#3578e5";
    const bgColor = options.backgroundColor || "#ffffff";
    const iconColor = { color: primaryColor };
    const iconsToGenerate = ["note", "blog"];
    for (const icon of iconsToGenerate) {
      try {
        await extractSvg(icon, imgDir, {
          ...iconColor,
          assetsDir: options.portoAssetsDir,
        });
      } catch (e) {}
    }

    // Build favicon configuration
    const configuration = {
      path: `/${options.outputPath || "favicon"}/`,
      appName: options.siteTitle || "Portfolio",
      appDescription: options.siteTagline || "Portfolio",
      background: bgColor,
      theme_color: primaryColor,
      appleStatusBarStyle: "black-translucent",
      display: "standalone",
      scope: "/",
      start_url: "/",
      version: appVersion,
      orientation: "natural",
      logging: false,
      loadManifestWithCredentials: true,
      manifestMaskable: true,
      icons: {
        android: {
          offset: 0,
          background: false,
          mask: true,
          overlayGlow: false,
          androidPlayStore: true,
        },
        favicons: true,
        appleIcon: true,
        appleStartup: false,
        windows: false,
        yandex: false,
      },
    };

    // Resolve image source (remote or local)
    let downloadedRes;
    const isRemote = /^https?:\/\//.test(profilePicUrl);
    if (isRemote) {
      downloadedRes = await downloadImage(
        profilePicUrl,
        cacheDir,
        "profile_pic_src.png",
        { proxies, cacheDir: path.join(cacheDir, "downloads") },
      );
      tempFiles.push(downloadedRes);
    } else {
      let localPath = null;
      const staticDirs = options.staticDirs || ["static"];
      for (const sDir of staticDirs) {
        const fullPath = path.resolve(siteDir, sDir, profilePicUrl);
        if (fs.existsSync(fullPath)) {
          localPath = fullPath;
          break;
        }
      }
      if (!localPath && options.portoAssetsDir) {
        const portoPath = path.resolve(options.portoAssetsDir, profilePicUrl);
        if (fs.existsSync(portoPath)) {
          localPath = portoPath;
        }
      }
      if (!localPath) {
        throw new Error(`Local profile picture not found: ${profilePicUrl}`);
      }
      downloadedRes = localPath;
    }

    // Process image shape and dimensions
    let finalImagePath = downloadedRes;
    if (circular) {
      finalImagePath = await reshapeImage(
        downloadedRes,
        reshapedImagePath,
        shape,
      );
      if (finalImagePath !== downloadedRes) {
        tempFiles.push(finalImagePath);
      }
    }

    // Generate favicon assets using favicons library
    createDirectoryIfNotExists(outputDir);
    logger.info(`Generating favicon assets from ${finalImagePath}`);
    const response = await favicons(finalImagePath, configuration);

    // Process generated images and files
    let imageCount = 0,
      fileCount = 0;
    if (Array.isArray(response.images)) {
      for (const image of response.images) {
        fs.writeFileSync(path.join(outputDir, image.name), image.contents);
        imageCount++;
      }
    }
    if (Array.isArray(response.files)) {
      for (const file of response.files) {
        if (file.name.includes("manifest")) {
          processManifest(file, outputDir, appVersion);
        } else {
          fs.writeFileSync(path.join(outputDir, file.name), file.contents);
        }
        fileCount++;
      }
    }

    // Update cache and cleanup temporary files
    logger.success(
      `Generated ${imageCount} favicon images and ${fileCount} support files`,
    );
    fs.writeFileSync(hashFilePath, configHash, "utf-8");
    const htmlFilePath = path.join(outputDir, ".favicon.html");
    fs.writeFileSync(htmlFilePath, JSON.stringify(response.html), "utf-8");
    tempFiles.forEach(cleanupFile);
    const headTags = (response.html || [])
      .map(parseHtmlTagString)
      .filter(Boolean);
    return { success: true, html: headTags };
  } catch (error) {
    logger.warn(`Favicon generation skipped: ${error.message}`);
    tempFiles.forEach(cleanupFile);
    const htmlFilePath = path.join(outputDir, ".favicon.html");
    if (fs.existsSync(htmlFilePath)) {
      try {
        const cachedHtml = JSON.parse(fs.readFileSync(htmlFilePath, "utf-8"));
        const headTags = cachedHtml.map(parseHtmlTagString).filter(Boolean);
        return { success: false, html: headTags };
      } catch (e) {}
    }
    return { success: false, html: [] };
  }
}
