/**
 * Functional color utility (Chalk-like).
 */
export type ColorFn = (str: string | number) => string;

export interface Colors {
  // Modifiers
  bold: ColorFn;
  dim: ColorFn;
  italic: ColorFn;
  underline: ColorFn;
  strikethrough: ColorFn;
  inverse: ColorFn;
  reset: ColorFn;

  // Foreground Colors
  black: ColorFn;
  red: ColorFn;
  green: ColorFn;
  yellow: ColorFn;
  blue: ColorFn;
  magenta: ColorFn;
  cyan: ColorFn;
  white: ColorFn;
  gray: ColorFn;
  grey: ColorFn;

  // Bright Colors
  blackBright: ColorFn;
  redBright: ColorFn;
  greenBright: ColorFn;
  yellowBright: ColorFn;
  blueBright: ColorFn;
  magentaBright: ColorFn;
  cyanBright: ColorFn;
  whiteBright: ColorFn;

  // Background Colors
  bgBlack: ColorFn;
  bgRed: ColorFn;
  bgGreen: ColorFn;
  bgYellow: ColorFn;
  bgBlue: ColorFn;
  bgMagenta: ColorFn;
  bgCyan: ColorFn;
  bgWhite: ColorFn;

  // Semantic Wrappers
  muted: ColorFn;
  success: ColorFn;
  warn: ColorFn;
  error: ColorFn;
  info: ColorFn;
  tip: ColorFn;
  heading: ColorFn;
  command: ColorFn;
  label: ColorFn;
  url: ColorFn;
}

export interface BoxOptions {
  /** The title of the box. */
  title?: string;

  /** The padding inside the box. Default is 1. */
  padding?: number;

  /** The border style. Default is "rounded". */
  border?: "rounded" | "single" | "double" | "none";
}

export interface LevelFn {
  /** Log a message at this level. */
  (msg: string): void;

  /** Display a styled box using this level's semantic color. */
  box(msg: string, options?: BoxOptions): void;
}

export interface Logger {
  // Standard levels — routed through @docusaurus/logger
  info: LevelFn;
  success: LevelFn;
  warn: LevelFn;
  error: LevelFn;

  // Gated — only logs when DEBUG or VERBOSE env var is set
  debug: LevelFn;

  // Custom levels — console.log with aligned colored label
  tip: LevelFn;
  note: LevelFn;

  // Utilities

  /** Logs a blank line. */
  newLine(): void;

  /** Logs a blank line followed by an info message. */
  start(msg: string): void;
  clear(): void;
  resetView(): void;

  /** Async wait/sleep for a specified number of milliseconds. */
  wait(ms: number, options?: { ci?: boolean; test?: boolean }): Promise<void>;
}

/**
 * Portosaur Logger
 * Wraps @docusaurus/logger and consola with additional helpers.
 */
export const logger: Logger;
export default logger;

/**
 * Semantic color utilities (chalk wrapper).
 */
export const colors: Colors;
