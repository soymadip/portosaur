import fs from "fs";
import path from "path";

/**
 * The default color scheme to use when no color scheme is specified.
 */
export function getDefaultColorScheme(userConfig) {
  return userConfig?.docs_home ? "dracula" : "nord";
}

/**
 * Resolves the absolute paths of all CSS files required for the site
 * (color schemes, global overrides, and custom user stylesheets).
 *
 * The theme's own files are bundled via BaseLayout's `src/css/custom.css`
 * import — they are listed here so the asset generator can read the
 * `--porto-*` tokens out of the active scheme file (theme-color,
 * manifest colors) and so the layout can link the user's custom files.
 * There is no `infima.css` anymore: `--ifm-*` is gone, the scheme files
 * define `--porto-*` directly.
 *
 * @param {string} projectDir - The user's project directory.
 * @param {Object} userConfig - The parsed Portosaur user config.
 * @param {string} themeRoot - Absolute path to the theme package root.
 * @returns {string[]} Resolved paths to CSS files.
 */
export function resolveSiteCssFiles(projectDir, userConfig, themeRoot) {
  const colorScheme =
    userConfig?.theme?.color_scheme || getDefaultColorScheme(userConfig);
  const presetCss =
    colorScheme.endsWith(".css") ||
    colorScheme.includes("/") ||
    colorScheme.includes("\\")
      ? path.resolve(projectDir, colorScheme)
      : path.resolve(themeRoot, `src/css/themes/${colorScheme}.css`);

  const files = [presetCss, path.resolve(themeRoot, "src/css/custom.css")];

  const customCss = userConfig?.theme?.custom_css;

  if (customCss) {
    const customPaths = Array.isArray(customCss) ? customCss : [customCss];
    for (const p of customPaths) {
      files.push(path.resolve(projectDir, p));
    }
  }

  return files.filter((f) => fs.existsSync(f));
}
