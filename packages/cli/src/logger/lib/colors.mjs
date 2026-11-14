import chalk from "chalk";

/**
 * Portosaur Color Palette
 *
 * A full-featured semantic wrapper over chalk.
 * To swap the underlying library, only this file needs to change.
 */
export const colors = {
  // ------- Text Modifiers -------
  // Modifiers
  bold: (str) => chalk.bold(str),
  dim: (str) => chalk.dim(str),
  italic: (str) => chalk.italic(str),
  underline: (str) => chalk.underline(str),
  strikethrough: (str) => chalk.strikethrough(str),
  inverse: (str) => chalk.inverse(str),
  reset: (str) => chalk.reset(str),

  // Foreground Colors
  black: (str) => chalk.black(str),
  red: (str) => chalk.red(str),
  green: (str) => chalk.green(str),
  yellow: (str) => chalk.yellow(str),
  blue: (str) => chalk.blue(str),
  magenta: (str) => chalk.magenta(str),
  cyan: (str) => chalk.cyan(str),
  white: (str) => chalk.white(str),
  gray: (str) => chalk.gray(str),
  grey: (str) => chalk.grey(str),

  // Bright Colors
  blackBright: (str) => chalk.blackBright(str),
  redBright: (str) => chalk.redBright(str),
  greenBright: (str) => chalk.greenBright(str),
  yellowBright: (str) => chalk.yellowBright(str),
  blueBright: (str) => chalk.blueBright(str),
  magentaBright: (str) => chalk.magentaBright(str),
  cyanBright: (str) => chalk.cyanBright(str),
  whiteBright: (str) => chalk.whiteBright(str),

  // Background Colors
  bgBlack: (str) => chalk.bgBlack(str),
  bgRed: (str) => chalk.bgRed(str),
  bgGreen: (str) => chalk.bgGreen(str),
  bgYellow: (str) => chalk.bgYellow(str),
  bgBlue: (str) => chalk.bgBlue(str),
  bgMagenta: (str) => chalk.bgMagenta(str),
  bgCyan: (str) => chalk.bgCyan(str),
  bgWhite: (str) => chalk.bgWhite(str),

  // Semantic Wrappers
  muted: (str) => chalk.gray(str), // subdued hints, placeholders
  success: (str) => chalk.green(str), // success messages
  warn: (str) => chalk.yellow(str), // warnings, back-nav
  error: (str) => chalk.red(str), // errors
  info: (str) => chalk.blue(str), // informational text
  tip: (str) => chalk.magenta.bold(str), // [TIP] prefix
  heading: (str) => chalk.yellow(str), // note/box headings
  command: (str) => chalk.cyan.bold(str), // shell commands / code
  label: (str) => chalk.white.bold(str), // field labels
  url: (str) => chalk.cyanBright.underline(str), // clickable URLs
};

export default colors;
