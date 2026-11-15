import path from "node:path";
import {
  runServe,
  validateProject,
  resolvePortoPaths,
  writeNextRoot,
} from "../utils/index.ts";
import { logger } from "../logger/index.ts";

export interface ServeCommandOptions {
  outDir?: string;
  port?: string;
  host?: string;
  browser?: boolean;
}

/**
 * Serves the built Portosaur site locally with the `serve` package.
 * `next start` does NOT work with `output: 'export'`, so `porto serve`
 * is a static file server over the output dir (which honors the
 * generated config's `distDir`, including a --out-dir override).
 */
export async function serveCommand(
  siteDir?: string,
  options: ServeCommandOptions = {},
): Promise<void> {
  const port = options.port ?? "3000";
  const host = options.host ?? "localhost";

  const extraArgs: string[] = [];
  if (options.host) {
    extraArgs.push("-l", `tcp://${host}:${port}`);
  } else if (options.port) {
    extraArgs.push("-p", options.port);
  }

  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // ------- Setup -------

  validateProject(UserRoot);

  const portoPaths = resolvePortoPaths(UserRoot);

  try {
    logger.info("Serving built site...");

    // Regenerate the root so serve reads the current config (including
    // a --out-dir override) for the output directory to serve.
    const { outDir } = writeNextRoot(UserRoot, portoPaths, {}, false, {
      outDir: options.outDir,
    });

    // Docusaurus opened a browser by default, so `porto serve` keeps
    // opening one unless --no-browser is passed. The runner waits for
    // the server to answer before opening it.
    const openUrl =
      options.browser !== false ? `http://${host}:${port}/` : undefined;

    await runServe(outDir, extraArgs, openUrl);
  } catch (error) {
    logger.error(`Failed to serve site: ${(error as Error).message}`);
    process.exit(1);
  }
}
