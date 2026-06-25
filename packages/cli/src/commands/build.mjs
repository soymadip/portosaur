import fs from "fs";
import path from "path";
import {
  Paths,
  writeConfigShim,
  logResolvedSiteLocation,
  runDocusaurus,
  validateProject,
  ensureContentDirs,
} from "../utils/index.mjs";
import { logger } from "@portosaur/logger";
import {
  loadUserConfig,
  generateFavicons,
  generateRobotsTxt,
  getCssVar,
} from "@portosaur/core";

/**
 * Builds the static Portosaur site.
 *
 * This involves:
 * 1. Validating the project structure.
 * 2. Generating dynamic assets (favicons, robots.txt).
 * 3. Compiling the site via Docusaurus.
 */
export async function buildCommand(siteDir, options = {}) {
  const extraArgs = [];

  if (options.bundleAnalyzer) {
    extraArgs.push("--bundle-analyzer");
  }
  if (options.minify === false) {
    extraArgs.push("--no-minify");
  }

  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // ------- Setup -------

  validateProject(UserRoot);
  ensureContentDirs(UserRoot);

  /*
   * ====================== Path Resolution ======================
   */

  const portoPaths = {
    root: Paths.root,
    assets: path.join(Paths.theme, "assets"),
    theme: path.join(Paths.theme, "theme"),
    plugins: path.join(Paths.theme, "src/plugins"),
  };

  try {
    const userConfig = loadUserConfig(UserRoot, { portoRoot: Paths.theme });

    // ------- Asset Generation -------

    logger.info("Generating site assets...");

    const cssFilesToParse = [
      path.join(portoPaths.theme, "css/custom.css"),
      path.join(portoPaths.theme, "css/overrides/variables.css"),
    ];

    const themeColor =
      getCssVar("--ifm-color-primary", cssFilesToParse) || "#3578e5";

    const faviconRes = await generateFavicons(UserRoot, {
      imagePath: userConfig.home_page?.hero?.profile_pic,
      siteTitle: userConfig.site?.title,
      siteTagline: userConfig.site?.tagline,
      staticDirs: ["static"],
      portoAssetsDir: portoPaths.assets,
      themeColor: themeColor,
    });

    const configContext = {
      extraHeadTags: faviconRes.html,
    };
    const configPath = writeConfigShim(UserRoot, portoPaths, configContext);
    logResolvedSiteLocation(UserRoot, portoPaths, configContext);

    // ------- Docusaurus Build -------

    logger.info("Building static site...");

    let outDirName = options.outDir || userConfig.site?.build_dir || "build";
    if (outDirName !== "build") {
      extraArgs.push("--out-dir", outDirName);
    }

    const finalOutDir = path.resolve(UserRoot, outDirName);

    await runDocusaurus("build", UserRoot, configPath, extraArgs);

    // ------- Post Build -------

    try {
      fs.writeFileSync(path.join(finalOutDir, ".nojekyll"), "");
    } catch (e) {
      logger.warn(`Failed to create .nojekyll in build dir: ${e.message}`);
    }

    await generateRobotsTxt(UserRoot, {
      enable: userConfig.site?.robots_txt?.enable,
      rules: userConfig.site?.robots_txt?.rules,
      customLines: userConfig.site?.robots_txt?.custom_lines,
      siteUrl: userConfig.site?.url,
      baseUrl: userConfig.site?.path,
      outDir: finalOutDir,
    });

    logger.success("Build completed successfully!");
  } catch (error) {
    logger.error(`Build failed: ${error.message}`);
    process.exit(1);
  }
}
