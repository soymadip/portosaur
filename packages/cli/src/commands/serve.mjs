import path from "path";
import {
  runDocusaurus,
  validateProject,
  Paths,
  writeConfigShim,
} from "../utils/index.mjs";
import { logger } from "@portosaur/logger";
import { loadUserConfig } from "@portosaur/core";

/**
 * Serves the built Portosaur site locally.
 */
export async function serveCommand(siteDir, options = {}, extraArgs = []) {
  if (siteDir && siteDir.startsWith("-")) {
    extraArgs.unshift(siteDir);
    siteDir = undefined;
  }

  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // Ensure extraArgs is always an array (in case options object is passed)
  const argsArray = Array.isArray(extraArgs) ? extraArgs : [];

  // ------- Setup -------

  validateProject(UserRoot);

  const portoPaths = {
    root: Paths.root,
    assets: path.join(Paths.theme, "assets"),
    theme: path.join(Paths.theme, "theme"),
    plugins: path.join(Paths.theme, "src/plugins"),
  };

  try {
    logger.info("Serving built site...");

    // Generate config shim so Docusaurus can locate site configuration
    const configPath = writeConfigShim(UserRoot, portoPaths);

    // Load user config to check for custom build dir
    const userConfig = loadUserConfig(UserRoot, portoPaths);
    const customBuildDir = options.outDir || userConfig.site?.build?.output_dir;

    if (customBuildDir && customBuildDir !== "build") {
      // Docusaurus serve uses --dir instead of --out-dir
      const dirIndex = argsArray.findIndex((arg) => arg === "--dir");
      if (dirIndex === -1) {
        argsArray.push("--dir", customBuildDir);
      }
    }

    // Docusaurus serve looks for the 'build' directory by default.
    await runDocusaurus("serve", UserRoot, configPath, argsArray);
  } catch (error) {
    logger.error(`Failed to serve site: ${error.message}`);
    process.exit(1);
  }
}
