import fs from "node:fs";
import path from "node:path";

export interface ProcessSvgOptions {
  color?: string;
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
  };
}

/**
 * Process an SVG icon by copying it and optionally injecting a custom fill color.
 *
 * @param srcPath - Full path to the source SVG file.
 * @param destPath - Full path where the processed SVG should be saved.
 * @param options - Optional settings.
 * @param options.color - Optional fill color to inject into the SVG.
 * @param options.logger - Optional logger with info/warn methods (defaults to console).
 */
export async function processSvg(
  srcPath: string,
  destPath: string,
  { color, logger }: ProcessSvgOptions = {},
): Promise<string | false> {
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
