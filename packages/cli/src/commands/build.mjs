import fs from "fs";
import path from "path";
import {
  Paths,
  writeConfigShim,
  runDocusaurus,
  validateProject,
  ensureContentDirs,
} from "../utils/index.mjs";
import { logger } from "@portosaur/logger";
import {
  loadUserConfig,
  generateFavicons,
  generateRobotsTxt,
} from "@portosaur/core";

/**
 * Builds the static Portosaur site.
 *
 * This involves:
 * 1. Validating the project structure.
 * 2. Generating dynamic assets (favicons, robots.txt).
 * 3. Compiling the site via Docusaurus.
 */
export async function buildCommand(siteDir, extraArgs = []) {
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
    const userConfig = loadUserConfig(UserRoot);

    // ------- Asset Generation -------

    logger.info("Generating site assets...");

    const faviconRes = await generateFavicons(UserRoot, {
      imagePath: userConfig.home_page?.hero?.profile_pic,
      siteTitle: userConfig.site?.title,
      siteTagline: userConfig.site?.tagline,
      staticDirs: ["static"],
      portoAssetsDir: portoPaths.assets,
    });

    const configPath = writeConfigShim(UserRoot, portoPaths, {
      extraHeadTags: faviconRes.html,
    });

    // ------- Docusaurus Build -------

    logger.info("Building static site...");

    await runDocusaurus("build", UserRoot, configPath, extraArgs);

    // ------- Post Build -------

    await generateRobotsTxt(UserRoot, {
      enable: userConfig.site?.robots_txt?.enable,
      rules: userConfig.site?.robots_txt?.rules,
      customLines: userConfig.site?.robots_txt?.custom_lines,
      siteUrl: userConfig.site?.url,
      baseUrl: userConfig.site?.path,
    });

    logger.success("Build completed successfully!");
  } catch (error) {
    logger.error(`Build failed: ${error.message}`);
    process.exit(1);
  }
}
