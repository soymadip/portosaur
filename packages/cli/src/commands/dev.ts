import path from "node:path";
import fs from "node:fs";
import {
  Paths,
  resolvePortoPaths,
  writeAstroShim,
  logResolvedSiteLocation,
  runAstro,
  validateProject,
  ensureContentDirs,
} from "../utils/index.ts";
import { logger } from "../logger/index.ts";

export interface DevCommandOptions {
  port?: string;
  host?: string;
  browser?: boolean;
  poll?: string | boolean;
}

export async function devCommand(
  siteDir?: string,
  options: DevCommandOptions = {},
): Promise<void> {
  const extraArgs: string[] = [];

  if (options.port) {
    extraArgs.push("--port", options.port);
  }
  if (options.host) {
    extraArgs.push("--host", options.host);
  }
  // Astro does not open a browser by default; Docusaurus did, so `porto dev`
  // keeps opening one unless --no-browser is passed.
  if (options.browser !== false) {
    extraArgs.push("--open");
  }

  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  validateProject(UserRoot);
  ensureContentDirs(UserRoot);

  const configYaml = ["config.yaml", "config.yml"].find((file) =>
    fs.existsSync(path.join(UserRoot, file)),
  );

  /*
   * ====================== Path Resolution ======================
   */

  const portoPaths = resolvePortoPaths(UserRoot);

  // --poll maps to the generated config's Vite watcher (Astro has no --poll flag).
  const cliOptions = { poll: options.poll || false };

  try {
    const { astroRoot } = writeAstroShim(
      UserRoot,
      portoPaths,
      {},
      false,
      cliOptions,
    );

    logResolvedSiteLocation(UserRoot, portoPaths);

    // Watch for config.yml changes to trigger an Astro reload
    if (configYaml) {
      const configYamlPath = path.join(UserRoot, configYaml);
      const watcher = fs.watch(configYamlPath, (eventType) => {
        if (eventType === "change") {
          logger.info(`Detected change in ${configYaml}, reloading...`);

          // Regenerate the Astro shim with the updated values; Astro
          // restarts the dev server when astro.config.mjs changes.
          try {
            writeAstroShim(UserRoot, portoPaths, {}, false, cliOptions);
            logResolvedSiteLocation(UserRoot, portoPaths);
          } catch (err) {
            logger.warn(
              `Failed to regenerate config: ${(err as Error).message}`,
            );
          }
        }
      });

      process.on("SIGINT", () => {
        watcher.close();
        process.exit();
      });
    }
    // [Playground] Watch portosaur packages for backend changes if running inside
    // the portosaur monorepo itself. We fingerprint-check packages/cli/package.json
    const packagesDir = path.resolve(Paths.root, "../../packages");
    const cliPkgJson = path.join(packagesDir, "cli/package.json");

    const isPortosaurMonorepo = (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(cliPkgJson, "utf8"));
        return pkg.name === "@portosaur/cli";
      } catch {
        return false;
      }
    })();

    if (isPortosaurMonorepo) {
      logger.info(
        "Playground dev mode: watching @portosaur/* for backend logic changes...",
      );

      const coreWatcher = fs.watch(
        packagesDir,
        { recursive: true },
        (_eventType, filename) => {
          // Only trigger on .ts changes.
          // This naturally ignores .astro and .css changes in the theme,
          // preserving Astro's instant Vite HMR for components/styles!
          if (typeof filename === "string" && filename.endsWith(".ts")) {
            logger.info(`Detected backend change (${filename}), reloading...`);
            try {
              writeAstroShim(UserRoot, portoPaths, {}, true, cliOptions); // forceRefresh = true
              logResolvedSiteLocation(UserRoot, portoPaths);
            } catch (err) {
              logger.warn(
                `Failed to regenerate config: ${(err as Error).message}`,
              );
            }
          }
        },
      );

      process.on("SIGINT", () => {
        coreWatcher.close();
      });
    }

    await runAstro("dev", UserRoot, astroRoot, extraArgs, portoPaths);
  } catch (error) {
    logger.error(
      `Failed to start dev server:\n${(error as Error).stack || (error as Error).message}`,
    );
    process.exit(1);
  }
}
