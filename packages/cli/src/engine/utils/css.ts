import fs from "node:fs";
import path from "node:path";

/**
 * The default color scheme to use when no color scheme is specified.
 * Starlight's own palette is the default for now, so a default site
 * renders with Starlight's colors and can be compared against real
 * Starlight; the portosaur scheme stays available as an explicit
 * choice (`theme.color_scheme: portosaur`).
 */
export function getDefaultColorScheme(_userConfig: any): string {
  return "starlight";
}

/**
 * Resolves the absolute paths of all CSS files required for the site
 * (color schemes, global overrides, and custom user stylesheets).
 *
 * The theme's own files are bundled via BaseLayout's `src/css/custom.css`
 * import — they are listed here so the asset generator can read the
 * `--porto-*` tokens out of the active scheme file (theme-color,
 * manifest colors) and so the layout can link the user's custom files.
 *
 * @param {string} projectDir - The user's project directory.
 * @param {Object} userConfig - The parsed Portosaur user config.
 * @param {string} appRoot - Absolute path to the app package root.
 * @returns {string[]} Resolved paths to CSS files.
 */
export function resolveSiteCssFiles(
  projectDir: string,
  userConfig: any,
  appRoot: string,
): string[] {
  const colorScheme =
    userConfig?.theme?.color_scheme || getDefaultColorScheme(userConfig);
  const presetCss =
    colorScheme.endsWith(".css") ||
    colorScheme.includes("/") ||
    colorScheme.includes("\\")
      ? path.resolve(projectDir, colorScheme)
      : path.resolve(appRoot, `src/css/themes/${colorScheme}.css`);

  const files = [presetCss, path.resolve(appRoot, "src/css/custom.css")];

  const customCss = userConfig?.theme?.custom_css;

  if (customCss) {
    const customPaths = Array.isArray(customCss) ? customCss : [customCss];
    for (const p of customPaths) {
      files.push(path.resolve(projectDir, p));
    }
  }

  return files.filter((f) => fs.existsSync(f));
}
