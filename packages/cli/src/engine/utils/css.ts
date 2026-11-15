import fs from "node:fs";
import path from "node:path";

// The 148 CSS named colors (CSS Color Module Level 4). Kept as a
// set so `isValidCssColor` can accept `red` alongside `#ff0000`
// without a DOM to ask.
const NAMED_COLORS = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);

const HEX_COLOR_RE =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isNumberInRange(text: string, min: number, max: number): boolean {
  if (!/^-?\d*\.?\d+$/.test(text)) {
    return false;
  }
  const value = Number(text);
  return Number.isFinite(value) && value >= min && value <= max;
}

function isPercentageInRange(text: string, max = 100): boolean {
  if (!text.endsWith("%")) {
    return false;
  }
  return isNumberInRange(text.slice(0, -1), 0, max);
}

function isChannel(text: string): boolean {
  return isNumberInRange(text, 0, 255) || isPercentageInRange(text);
}

function isAlpha(text: string): boolean {
  return isNumberInRange(text, 0, 1) || isPercentageInRange(text);
}

/**
 * Whether `value` is a CSS color the browser will accept: a hex
 * color, an `rgb()`/`rgba()`/`hsl()`/`hsla()` function, or a named
 * color. Anything else — a typo, a CSS variable, `color-mix()` —
 * is rejected so callers can fall back to the default instead of
 * emitting a value the browser would ignore.
 */
export function isValidCssColor(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const text = value.trim();
  if (text === "") {
    return false;
  }
  if (text.startsWith("#")) {
    return HEX_COLOR_RE.test(text);
  }
  const fn = text.match(/^(rgba?|hsla?)\(\s*(.+?)\s*\)$/);
  if (fn) {
    const [, name, args] = fn;
    const [colorPart, alphaPart] = args.split("/").map((s) => s.trim());
    if (alphaPart !== undefined && !isAlpha(alphaPart)) {
      return false;
    }
    const separator = colorPart.includes(",") ? "," : /\s+/;
    const parts = colorPart
      .split(separator)
      .map((s) => s.trim())
      .filter((s) => s !== "");
    // Legacy rgba()/hsla() allow a fourth comma-separated alpha.
    if (parts.length === 4 && separator === ",") {
      if (!isAlpha(parts[3])) {
        return false;
      }
      parts.pop();
    }
    if (parts.length !== 3) {
      return false;
    }
    if (name.startsWith("rgb")) {
      return parts.every(isChannel);
    }
    // Hue wraps in CSS, so any number is fine; saturation and
    // lightness must be percentages.
    return (
      isNumberInRange(parts[0], -Infinity, Infinity) &&
      isPercentageInRange(parts[1]) &&
      isPercentageInRange(parts[2])
    );
  }
  return NAMED_COLORS.has(text.toLowerCase());
}

/**
 * The default color scheme to use when no color scheme is specified.
 * Portosaur's own scheme is the default (the Fumadocs build has no
 * Starlight code, so the Astro build's `starlight` default does not
 * exist here).
 */
export function getDefaultColorScheme(_userConfig: any): string {
  return "portosaur";
}

/**
 * Resolves the absolute paths of all CSS files required for the site
 * (color schemes, global overrides, and custom user stylesheets).
 *
 * The app package's own files are bundled via the generated root
 * layout's `@portosaur/app/css/global.css` import — they are listed
 * here so the asset generator can read the `--porto-*` tokens out of
 * the active scheme file (theme-color, manifest colors) and so the
 * layout can link the user's custom files.
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
