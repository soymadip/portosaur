import fs from "fs";
import path from "path";

/**
 * Process an SVG icon by copying it and optionally injecting a custom fill color.
 *
 * @param {string} srcPath   - Full path to the source SVG file.
 * @param {string} destPath  - Full path where the processed SVG should be saved.
 * @param {Object} options   - Optional settings.
 * @param {string} options.color - Optional fill color to inject into the SVG.
 * @param {Object} options.logger - Optional logger with info/warn methods (defaults to console).
 */
export async function processSvg(srcPath, destPath, { color, logger } = {}) {
  const log = logger ?? console;

  if (!srcPath || !destPath) {
    throw new Error("processSvg: srcPath and destPath are required");
  }

  if (!fs.existsSync(srcPath)) {
    log.warn(`Source icon not found: ${srcPath}`);
    return false;
  }

  const destDir = path.dirname(destPath);
  fs.mkdirSync(destDir, { recursive: true });

  let content = fs.readFileSync(srcPath, "utf8");

  if (color) {
    if (/fill="[^"]*"/i.test(content)) {
      content = content.replace(/fill="[^"]*"/g, `fill="${color}"`);
    } else {
      // Inject fill attribute into the root <svg> tag
      content = content.replace(/<svg([^>]*)>/i, (match, g1) => {
        return `<svg${g1} fill="${color}">`;
      });
    }
  }

  fs.writeFileSync(destPath, content);

  log.info(`Generated SVG icon: ${destPath}`);
  return destPath;
}
