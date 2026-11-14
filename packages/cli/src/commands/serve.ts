import path from "node:path";
import {
  runAstro,
  validateProject,
  resolvePortoPaths,
  writeAstroShim,
} from "../utils/index.ts";
import { logger } from "../logger/index.ts";

export interface ServeCommandOptions {
  outDir?: string;
  port?: string;
  host?: string;
  browser?: boolean;
}

/**
 * Serves the built Portosaur site locally via `astro preview`, which honors
 * the generated config's `outDir` (verified in Phase 2).
 */
export async function serveCommand(
  siteDir?: string,
  options: ServeCommandOptions = {},
): Promise<void> {
  const extraArgs: string[] = [];

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
    logger.error(`Failed to serve site: ${(error as Error).message}`);
    process.exit(1);
  }
}
