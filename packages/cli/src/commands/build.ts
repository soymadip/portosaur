import fs from "node:fs";
import path from "node:path";
import {
  resolvePortoPaths,
  writeAstroShim,
  logResolvedSiteLocation,
  runAstro,
  validateProject,
  ensureContentDirs,
} from "../utils/index.ts";
import { logger } from "../logger/index.ts";

export interface BuildCommandOptions {
  outDir?: string;
  minify?: boolean;
}

/**
 * Builds the static Portosaur site.
 *
 * Thin launcher (D13): validate → write the Astro shim + content config →
 * run `astro build`. Site assets, robots.txt, and the search index all run
 * inside the theme integration — no CLI pre-generation.
 */
export async function buildCommand(
  siteDir?: string,
  options: BuildCommandOptions = {},
): Promise<void> {
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
      logger.warn(
        `Failed to create .nojekyll in build dir: ${(e as Error).message}`,
      );
    }

    logger.success("Build completed successfully!");
  } catch (error) {
    logger.error(`Build failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
