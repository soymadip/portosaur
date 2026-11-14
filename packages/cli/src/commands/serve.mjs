import path from "path";
import {
  runAstro,
  validateProject,
  resolvePortoPaths,
  writeAstroShim,
} from "../utils/index.mjs";
import { logger } from "../logger/index.mjs";

/**
 * Serves the built Portosaur site locally via `astro preview`, which honors
 * the generated config's `outDir` (verified in Phase 2).
 */
export async function serveCommand(siteDir, options = {}) {
  const extraArgs = [];

  if (options.port) {
    extraArgs.push("--port", options.port);
  }
  if (options.host) {
    extraArgs.push("--host", options.host);
  }
  if (options.browser !== false) {
    extraArgs.push("--open");
  }

  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // ------- Setup -------

  validateProject(UserRoot);

  const portoPaths = resolvePortoPaths(UserRoot);

  try {
    logger.info("Serving built site...");

    // Regenerate the shim so preview reads the current config (including
    // a --out-dir override) for the output directory to serve.
    const { astroRoot } = writeAstroShim(UserRoot, portoPaths, {}, false, {
      outDir: options.outDir,
    });

    await runAstro("preview", UserRoot, astroRoot, extraArgs, portoPaths);
  } catch (error) {
    logger.error(`Failed to serve site: ${error.message}`);
    process.exit(1);
  }
}
