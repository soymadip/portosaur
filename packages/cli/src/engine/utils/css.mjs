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
 * @param {string} projectDir - The user's project directory.
 * @param {Object} userConfig - The parsed Portosaur user config.
 * @param {string} themeDir - Absolute path to the theme directory.
 * @returns {string[]} Resolved paths to CSS files.
 */
export function resolveSiteCssFiles(projectDir, userConfig, themeDir) {
  const colorScheme =
    userConfig?.theme?.color_scheme || getDefaultColorScheme(userConfig);
  const presetCss =
    colorScheme.endsWith(".css") ||
    colorScheme.includes("/") ||
    colorScheme.includes("\\")
      ? path.resolve(projectDir, colorScheme)
      : path.resolve(themeDir, `css/colors/${colorScheme}.css`);

  const files = [
    presetCss,
    path.resolve(themeDir, "css/infima.css"),
    path.resolve(themeDir, "css/custom.css"),
  ];

  const customCss = userConfig?.theme?.custom_css;

  if (customCss) {
    const customPaths = Array.isArray(customCss) ? customCss : [customCss];
    for (const p of customPaths) {
      files.push(path.resolve(projectDir, p));
    }
  }

  return files.filter((f) => fs.existsSync(f));
}
