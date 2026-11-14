import fs from "fs";
import path from "path";
import {
  resolvePortoPaths,
  writeAstroShim,
  logResolvedSiteLocation,
  runAstro,
  validateProject,
  ensureContentDirs,
} from "../utils/index.mjs";
import { logger } from "../logger/index.mjs";

/**
 * Builds the static Portosaur site.
 *
 * Thin launcher (D13): validate → write the Astro shim + content config →
 * run `astro build`. Site assets, robots.txt, and the search index all run
 * inside the theme integration — no CLI pre-generation.
 */
export async function buildCommand(siteDir, options = {}) {
  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // ------- Setup -------

  validateProject(UserRoot);
  ensureContentDirs(UserRoot);

  /*
   * ====================== Path Resolution ======================
   */

  const portoPaths = resolvePortoPaths(UserRoot);

  try {
    const { astroRoot, outDir } = writeAstroShim(
      UserRoot,
      portoPaths,
      {},
      false,
      {
        outDir: options.outDir,
        minify: options.minify,
      },
    );

    logResolvedSiteLocation(UserRoot, portoPaths);

    // ------- Astro Build -------

    logger.info("Building static site...");

    await runAstro("build", UserRoot, astroRoot, [], portoPaths);

    // ------- Post Build -------

    try {
      fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
    } catch (e) {
      logger.warn(`Failed to create .nojekyll in build dir: ${e.message}`);
    }

    logger.success("Build completed successfully!");
  } catch (error) {
    logger.error(`Build failed: ${error.message}`);
    process.exit(1);
  }
}
