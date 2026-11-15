import dLogger from "@docusaurus/logger";
import { consola } from "consola";
import { colors } from "./colors.mjs";

// ================= Message Formatting ====================

export const TARGET_WIDTH = 10;

/**
 * Format messages for Docusaurus logger with a fixed label column.
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

// Levels with a native method in @docusaurus/logger
const DOCUSAURUS_LEVELS = new Set(["info", "success", "warn", "error"]);

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
  const dl = dLogger.default || dLogger;
  const method = DOCUSAURUS_LEVELS.has(level) ? level : "info";
  return dl[method](formatted);
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
 * Standard level — routed through @docusaurus/logger.
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
 * Does NOT route through @docusaurus/logger.
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
