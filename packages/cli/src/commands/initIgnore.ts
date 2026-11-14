import fs from "node:fs";
import path from "node:path";
import { logger } from "../logger/index.ts";
import { Paths, validateProject } from "../utils/index.ts";

/**
 * Generates the default Portosaur .gitignore for an existing project.
 */
export async function initIgnoreCommand(): Promise<void> {
  const projectDir = process.cwd();

  // Validate project existence
  try {
    validateProject(projectDir);
  } catch (error) {
    logger.error((error as Error).message);
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
    logger.error(`Failed to generate .gitignore: ${(err as Error).message}`);
    process.exit(1);
  }
}
