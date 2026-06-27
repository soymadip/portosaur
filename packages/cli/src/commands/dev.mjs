import path from "path";
import fs from "fs";
import {
  Paths,
  writeConfigShim,
  logResolvedSiteLocation,
  runDocusaurus,
  validateProject,
  ensureContentDirs,
} from "../utils/index.mjs";
import { logger } from "@portosaur/logger";
import { loadUserConfig, generateSiteAssets } from "@portosaur/core";

export async function devCommand(siteDir, options = {}) {
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
  if (options.poll) {
    if (options.poll === true) {
      extraArgs.push("--poll");
    } else {
      extraArgs.push("--poll", options.poll);
    }
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

  const portoPaths = Paths.portoPaths;

  let configContext = { extraHeadTags: [] };

  try {
    const userConfig = loadUserConfig(UserRoot, { portoRoot: Paths.theme });
    configContext = await generateSiteAssets({
      UserRoot,
      userConfig,
      portoPaths,
    });
    const configPath = writeConfigShim(UserRoot, portoPaths, configContext);

    logResolvedSiteLocation(UserRoot, portoPaths, configContext);

    // Watch for config.yml changes to trigger Docusaurus reload
    if (configYaml) {
      const configYamlPath = path.join(UserRoot, configYaml);
      const watcher = fs.watch(configYamlPath, (eventType) => {
        if (eventType === "change") {
          logger.info(`Detected change in ${configYaml}, reloading...`);

          // Regenerate the static config shim with the updated values,
          // which triggers Docusaurus' own file watcher to hot-reload.
          try {
            const userConfig = loadUserConfig(UserRoot, {
              portoRoot: Paths.theme,
            });

            generateSiteAssets(UserRoot, userConfig, portoPaths)
              .then((res) => {
                configContext = res;

                writeConfigShim(UserRoot, portoPaths, configContext);
                logResolvedSiteLocation(UserRoot, portoPaths, configContext);
              })
              .catch((err) => {
                logger.warn(`Failed to regenerate assets: ${err.message}`);
              });
          } catch (err) {
            logger.warn(`Failed to regenerate config: ${err.message}`);
          }
        }
      });

      process.on("SIGINT", () => {
        watcher.close();
        process.exit();
      });
    }

    // [Playground] Watch portosaur packages for backend changes if running inside the monorepo
    const packagesDir = path.resolve(Paths.root, "../../packages");

    if (fs.existsSync(packagesDir)) {
      logger.info(
        "Playground dev mode: watching @portosaur/* for backend logic changes...",
      );

      const coreWatcher = fs.watch(
        packagesDir,
        { recursive: true },
        (_eventType, filename) => {
          // Only trigger on .mjs changes.
          // This naturally ignores .jsx and .css changes in the theme,
          // preserving Docusaurus's instant Webpack HMR for components/styles!
          if (filename && filename.endsWith(".mjs")) {
            logger.info(`Detected backend change (${filename}), reloading...`);
            try {
              writeConfigShim(UserRoot, portoPaths, configContext, true); // forceRefresh = true
              logResolvedSiteLocation(UserRoot, portoPaths, configContext);
            } catch (err) {
              logger.warn(`Failed to regenerate config: ${err.message}`);
            }
          }
        },
      );

      process.on("SIGINT", () => {
        coreWatcher.close();
      });
    }

    await runDocusaurus("start", UserRoot, configPath, extraArgs);
  } catch (error) {
    logger.error(`Failed to start dev server: ${error.message}`);
    process.exit(1);
  }
}
