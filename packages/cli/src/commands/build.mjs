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
  generateRobotsTxt,
  resolveSiteUrl,
  resolveBasePath,
  generateSiteAssets,
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

  const portoPaths = Paths.portoPaths;

  try {
    const userConfig = loadUserConfig(UserRoot, { portoRoot: Paths.theme });

    // ------- Asset Generation -------

    const configContext = await generateSiteAssets({
      UserRoot,
      userConfig,
      portoPaths,
    });
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

    const resolvedSiteUrl = resolveSiteUrl(userConfig.site?.url || "auto");
    const resolvedBaseUrl = resolveBasePath(
      userConfig.site?.base_url || "auto",
    );

    await generateRobotsTxt(UserRoot, {
      enable: userConfig.site?.robots_txt?.enable,
      rules: userConfig.site?.robots_txt?.rules,
      customLines: userConfig.site?.robots_txt?.custom_lines,
      siteUrl: resolvedSiteUrl,
      baseUrl: resolvedBaseUrl,
      outDir: finalOutDir,
    });

    logger.success("Build completed successfully!");
  } catch (error) {
    logger.error(`Build failed: ${error.message}`);
    process.exit(1);
  }
}
