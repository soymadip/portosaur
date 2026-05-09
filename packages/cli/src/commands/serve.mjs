import path from "path";
import {
  runDocusaurus,
  validateProject,
  Paths,
  writeConfigShim,
} from "../utils/index.mjs";
import { logger } from "@portosaur/logger";

/**
 * Serves the built Portosaur site locally.
 */
export async function serveCommand(siteDir, extraArgs = []) {
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

    // Docusaurus serve looks for the 'build' directory by default.
    await runDocusaurus("serve", UserRoot, configPath, argsArray);
  } catch (error) {
    logger.error(`Failed to serve site: ${error.message}`);
    process.exit(1);
  }
}
