import fs from "fs";
import path from "path";
import { logger } from "@portosaur/logger";
import { Paths, validateProject } from "../utils/index.mjs";

/**
 * Generates the default Portosaur .gitignore for an existing project.
 */
export async function initIgnoreCommand() {
  const projectDir = process.cwd();

  // Validate project existence
  try {
    validateProject(projectDir);
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }

  const targetPath = path.join(projectDir, ".gitignore");
  const sourcePath = path.join(Paths.templates, "gitignore");

  if (fs.existsSync(targetPath)) {
    logger.error(".gitignore already exists in this project!");
    process.exit(1);
  }

  if (!fs.existsSync(sourcePath)) {
    logger.error("Internal error: Default gitignore template not found.");
    process.exit(1);
  }

  try {
    fs.copyFileSync(sourcePath, targetPath);
    logger.success(".gitignore successfully generated!");
  } catch (err) {
    logger.error(`Failed to generate .gitignore: ${err.message}`);
    process.exit(1);
  }
}
