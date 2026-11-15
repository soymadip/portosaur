import { colors } from "./lib/colors.ts";
import { createLevel, createCustomLevel } from "./lib/helpers.ts";
import type { LevelFn } from "./lib/helpers.ts";

export type { Colors, ColorFn } from "./lib/colors.ts";
export type { BoxOptions, LevelFn } from "./lib/helpers.ts";

export interface Logger {
  // Standard levels — Astro-style output (timestamp + [@portosaur/cli] label)
  info: LevelFn;
  success: LevelFn;
  warn: LevelFn;
  error: LevelFn;

  // Gated — only logs when DEBUG or VERBOSE env var is set
  debug: LevelFn;

  // Custom levels — Astro-style lines with a colored `Tip:`/`Note:` lead-in
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

/*
 * Portosaur Logger
 * Astro-style log lines (timestamp + [@portosaur/cli] label) with
 * consola boxes and additional helpers.
 */
export const logger: Logger = {
  // Standard levels — Astro-style `HH:MM:SS [@portosaur/cli] message` lines
  info: createLevel("info"),
  success: createLevel("success"),
  warn: createLevel("warn"),
  error: createLevel("error"),

  // Gated — only logs when DEBUG or VERBOSE env var is set
  debug: createLevel("debug", { gated: true }),

  // Custom levels — Astro-style lines with a colored `Tip:`/`Note:` lead-in
  tip: createCustomLevel("tip", colors.tip),
  note: createCustomLevel("note", colors.muted),

  //--------------- Utilities --------------------------

  /** Prints a visually empty line (using a zero-width space) to avoid console pruning. */
  newLine: () => {
    console.log("\u200B");
  },

  /** Prints a newline followed by an info message. */
  start: (msg) => {
    logger.newLine();
    logger.info(msg);
  },

  /** Clears the terminal screen (skipped in test environment). */
  clear: () => {
    if (process.env.NODE_ENV !== "test") {
      process.stdout.write("\x1bc");
    }
  },

  /** Resets the terminal view/scrollback (skipped in test environment). */
  resetView: () => {
    if (process.env.NODE_ENV !== "test") {
      process.stdout.write("\x1B[2J\x1B[H");
    }
  },

  /**
   * Asynchronous wait (sleep) utility that is environment-aware.
   * @param {number} ms - Milliseconds to wait.
   * @param {Object} [options] - Skip options.
   * @param {boolean} [options.ci=false] - If true, do not skip in CI.
   * @param {boolean} [options.test=false] - If true, do not skip in test.
   * @returns {Promise<void>}
   */
  wait: (ms, { ci = false, test = false } = {}) => {
    const isTest = process.env.NODE_ENV === "test";
    const isCI = !!process.env.CI;

    if ((isTest && !test) || (isCI && !ci)) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

/*
 * ======================= Export the logger & Helpers ===============================
 */

export default logger;
export { colors };
