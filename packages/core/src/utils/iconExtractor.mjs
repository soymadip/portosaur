import fs from "fs";
import path from "path";
import { logger } from "@portosaur/logger";

/**
 * Extracts specific SVGs from a given assets directory and saves them to the project.
 *
 * @param {string} iconName   - Icon name without the "icon-" prefix or extension.
 * @param {string} destDir    - Destination directory to copy the SVG into.
 * @param {Object} options    - Optional settings.
 * @param {string} options.assetsDir - Base assets directory containing img/svg/. Required.
 * @param {string} options.color     - Optional fill color to inject into the SVG.
 */
export async function extractSvg(iconName, destDir, options = {}) {
  if (!options.assetsDir) {
    logger.warn(
      `extractSvg: assetsDir not provided, skipping icon-${iconName}.svg`,
    );
    return false;
  }

  const srcPath = path.resolve(
    options.assetsDir,
    `img/svg/icon-${iconName}.svg`,
  );
  const destPath = path.join(destDir, `icon-${iconName}.svg`);

  if (!fs.existsSync(srcPath)) {
    logger.warn(`Source icon not found: ${srcPath}`);
    return false;
  }

  fs.mkdirSync(destDir, { recursive: true });

  let content = fs.readFileSync(srcPath, "utf8");

  if (options.color) {
    content = content.replace(/fill="[^"]*"/g, `fill="${options.color}"`);
  }

  fs.writeFileSync(destPath, content);

  logger.info(`Generated SVG icon: ${destPath}`);
  return destPath;
}
