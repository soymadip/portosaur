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
export async function serveCommand(siteDir, options = {}) {
  const extraArgs = [];

  if (options.port) {
    extraArgs.push("--port", options.port);
  }
  if (options.host) {
    extraArgs.push("--host", options.host);
  }
  if (options.browser === false) {
    extraArgs.push("--no-open");
  }

  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // ------- Setup -------

  validateProject(UserRoot);

  const portoPaths = Paths.portoPaths;

  try {
    logger.info("Serving built site...");

    // Generate config shim so Docusaurus can locate site configuration
    const configPath = writeConfigShim(UserRoot, portoPaths);

    // Load user config to check for custom build dir
    const userConfig = loadUserConfig(UserRoot, portoPaths);
    const customBuildDir = options.outDir || userConfig.site?.build?.output_dir;

    if (customBuildDir && customBuildDir !== "build") {
      extraArgs.push("--dir", customBuildDir);
    }

    // Docusaurus serve looks for the 'build' directory by default.
    await runDocusaurus("serve", UserRoot, configPath, extraArgs);
  } catch (error) {
    logger.error(`Failed to serve site: ${error.message}`);
    process.exit(1);
  }
}
