import path from "node:path";
import fs from "node:fs";
import {
  Paths,
  resolvePortoPaths,
  writeNextRoot,
  logResolvedSiteLocation,
  runNext,
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

  const port = options.port ?? "3000";
  const host = options.host ?? "localhost";

  if (options.port) {
    extraArgs.push("--port", options.port);
  }
  if (options.host) {
    extraArgs.push("--hostname", options.host);
  }
  // Next.js has no --poll flag (its watcher is Turbopack's own) — the
  // flag is accepted for CLI compatibility and ignored, with a warning.
  if (options.poll) {
    logger.warn("--poll is ignored: Next.js does not support polling mode.");
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

  try {
    const { nextRoot } = await writeNextRoot(
      UserRoot,
      portoPaths,
      {},
      false,
      {},
    );

    logResolvedSiteLocation(UserRoot, portoPaths);

    // Watch for config.yml changes to regenerate the Next.js root.
    // Next restarts the dev server when next.config.mjs changes, and
    // re-reads lib/config.ts on the next request either way.
    if (configYaml) {
      const configYamlPath = path.join(UserRoot, configYaml);
      const watcher = fs.watch(configYamlPath, async (eventType) => {
        if (eventType === "change") {
          logger.info(`Detected change in ${configYaml}, reloading...`);

          try {
            await writeNextRoot(UserRoot, portoPaths, {}, false, {});
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
        async (_eventType, filename) => {
          // Only trigger on .ts changes.
          // This naturally ignores .tsx and .css changes in the app,
          // preserving Next's instant Fast Refresh for components/styles!
          if (typeof filename === "string" && filename.endsWith(".ts")) {
            logger.info(`Detected backend change (${filename}), reloading...`);
            try {
              await writeNextRoot(UserRoot, portoPaths, {}, true, {}); // forceRefresh = true
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

    // Next.js has no --open flag; Docusaurus opened a browser by default,
    // so `porto dev` keeps opening one unless --no-browser is passed.
    // The runner waits for the server to answer before opening it.
    const openUrl =
      options.browser !== false ? `http://${host}:${port}/` : undefined;

    await runNext("dev", UserRoot, nextRoot, extraArgs, portoPaths, {
      openUrl,
    });
  } catch (error) {
    logger.error(
      `Failed to start dev server:\n${(error as Error).stack || (error as Error).message}`,
    );
    process.exit(1);
  }
}
