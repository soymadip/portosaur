import path from "path";
import fs from "fs";
import {
  Paths,
  writeConfigShim,
  runDocusaurus,
  validateProject,
  ensureContentDirs,
} from "../utils/index.mjs";
import { logger } from "@portosaur/logger";

export async function devCommand(siteDir, extraArgs = []) {
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

  const portoPaths = {
    root: Paths.root,
    assets: path.join(Paths.theme, "assets"),
    theme: path.join(Paths.theme, "theme"),
    plugins: path.join(Paths.theme, "src/plugins"),
  };

  try {
    const configPath = writeConfigShim(UserRoot, portoPaths);

    // Watch for config.yml changes to trigger Docusaurus reload
    if (configYaml) {
      const configYamlPath = path.join(UserRoot, configYaml);
      const watcher = fs.watch(configYamlPath, (eventType) => {
        if (eventType === "change") {
          logger.info(`Detected change in ${configYaml}, reloading...`);

          // Regenerate the static config shim with the updated values,
          // which triggers Docusaurus' own file watcher to hot-reload.
          try {
            writeConfigShim(UserRoot, portoPaths);
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

    await runDocusaurus("start", UserRoot, configPath, extraArgs);
  } catch (error) {
    logger.error(`Failed to start dev server: ${error.message}`);
    process.exit(1);
  }
}
