import chalk from "chalk";
import { consola } from "consola";
import { colors } from "./colors.mjs";

// ================= Message Formatting ====================

export const TARGET_WIDTH = 10;

/**
 * Format messages for the logger with a fixed label column.
 *
 * @param {string} rawMsg     - The message to log.
 * @param {string} levelLabel - The level (info, success, etc).
 * @returns {string} The formatted message.
 */
export function _formatMsg(rawMsg, levelLabel) {
  // Parse input message
  const s = rawMsg === undefined || rawMsg === null ? "" : String(rawMsg);
  const leading = s.match(/^\n+/)?.[0] || "";
  const body = s.replace(/^\n+/, "");

  // Return early if empty
  if (body === "") {
    return leading;
  }

  // Prepare label and calculate padding
  const LABEL_MAP = {
    warn: "WARNING",
  };

  const labelText = `[${(LABEL_MAP[levelLabel] || levelLabel).toUpperCase()}]`;
  const lines = body.split(/\r?\n/);

  // Format each line with proper indentation
  const formatted = lines.map((ln, idx) => {
    if (idx === 0) {
      const padding = TARGET_WIDTH - (labelText.length + 1);
      return " ".repeat(Math.max(0, padding)) + ln;
    }
    return " ".repeat(TARGET_WIDTH) + ln;
  });

  // Return formatted output
  return leading + formatted.join("\n");
}

// ================= Routing & Logging ====================

// The four levels Portosaur routes through the logger, vendored from
// @docusaurus/logger (dropped in the Astro migration) with identical output.
const VENDORED_LEVELS = new Set(["info", "success", "warn", "error"]);

function stringify(msg) {
  if (Object.prototype.toString.call(msg) === "[object Object]") {
    return JSON.stringify(msg);
  }
  if (msg instanceof Date) {
    return msg.toUTCString();
  }
  return String(msg);
}

const dLogger = {
  info: (msg) => console.info(`${chalk.cyan.bold("[INFO]")} ${stringify(msg)}`),
  success: (msg) =>
    console.log(`${chalk.green.bold("[SUCCESS]")} ${stringify(msg)}`),
  warn: (msg) =>
    console.warn(chalk.yellow(`${chalk.bold("[WARNING]")} ${stringify(msg)}`)),
  error: (msg) =>
    console.error(chalk.red(`${chalk.bold("[ERROR]")} ${stringify(msg)}`)),
};

export const IS_CI = !!process.env.CI;

function dlog(msg, level) {
  const s = msg === undefined || msg === null ? "" : String(msg);
  const leading = s.match(/^\n+/)?.[0] || "";
  const body = s.replace(/^\n+/, "");

  // Write leading newlines
  if (leading) {
    process.stdout.write(leading);
  }

  // Format and route the message
  const formatted = _formatMsg(body, level);
  const method = VENDORED_LEVELS.has(level) ? level : "info";
  return dLogger[method](formatted);
}

// ================= Box Helper ====================

const LEVEL_BOX_COLORS = {
  info: "blue",
  success: "green",
  warn: "yellow",
  error: "red",
  start: "blue",
  debug: "gray",
  tip: "magenta",
  note: "gray",
};

function makeBox(level, inlineFn) {
  const boxColor = LEVEL_BOX_COLORS[level] ?? "cyan";
  return function box(msg, options = {}) {
    const {
      title = level.toUpperCase(),
      padding = 1,
      border = "rounded",
    } = options;

    if (IS_CI) {
      // Fallback to plain log — boxes don't render well in raw CI logs
      inlineFn(title ? `${title}: ${msg}` : msg);
      return;
    }
    consola.box({
      message: ` ${msg} `,
      title: title ? colors.heading(` ${title} `) : "",
      style: {
        borderColor: boxColor,
        borderStyle: border,
        padding: padding,
      },
    });
  };
}

// ================= Level Factories ====================

/**
 * Standard level — routed through the vendored Docusaurus-style logger.
 * @param {string} level
 * @param {{ gated?: boolean }} options - gated: only log when DEBUG/VERBOSE is set
 */
export function createLevel(level, { gated = false } = {}) {
  const fn = (msg) => {
    if (gated && !process.env.DEBUG && !process.env.VERBOSE) {
      return;
    }
    dlog(msg, level);
  };
  fn.box = makeBox(level, fn);
  return fn;
}

/**
 * Custom level — uses console.log + _formatMsg with its own colored label.
 * Does NOT route through the vendored logger.
 * @param {string} level
 * @param {Function} colorFn - chalk color function for the label
 */
export function createCustomLevel(level, colorFn) {
  const label = `[${level.toUpperCase()}]`;
  const fn = (msg) => {
    // Parse input message
    const s = msg === undefined || msg === null ? "" : String(msg);
    const leading = s.match(/^\n+/)?.[0] || "";
    const body = s.replace(/^\n+/, "");

    // Write leading newlines
    if (leading) {
      process.stdout.write(leading);
    }

    // Format and output
    console.log(`${colorFn(label)} ${_formatMsg(body, level)}`);
  };
  fn.box = makeBox(level, fn);
  return fn;
}
