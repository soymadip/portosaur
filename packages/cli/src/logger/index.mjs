import { colors } from "./lib/colors.mjs";
import { createLevel, createCustomLevel } from "./lib/helpers.mjs";

/*
 * Portosaur Logger
 * Wraps @docusaurus/logger and consola with additional helpers.
 */
export const logger = {
  // Standard levels — routed through @docusaurus/logger
  info: createLevel("info"),
  success: createLevel("success"),
  warn: createLevel("warn"),
  error: createLevel("error"),

  // Gated — only logs when DEBUG or VERBOSE env var is set
  debug: createLevel("debug", { gated: true }),

  // Custom levels — console.log with aligned colored label
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
