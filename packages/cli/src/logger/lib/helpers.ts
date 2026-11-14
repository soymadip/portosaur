import chalk from "chalk";
import { consola } from "consola";
import { colors } from "./colors.ts";
import type { ColorFn } from "./colors.ts";

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

// ================= Astro-style Formatting ====================

// The label shown in brackets on every log line, matching the app
// integration's `[@portosaur/app]` label.
export const LABEL = "@portosaur/cli";

// Same timestamp format as Astro's logger: 24-hour HH:MM:SS in the
// system locale (astro/dist/core/logger/core.js).
const dateTimeFormat = new Intl.DateTimeFormat([], {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Build the prefix for a log line, mirroring Astro's `getEventPrefix`:
 * a dim timestamp and blue label for info-style levels, and a bold
 * timestamp plus level tag, all yellow or red, for warn and error.
 *
 * @param {string} level - The level (info, success, warn, error, debug, tip, note).
 * @returns {string} The colored prefix, without trailing space.
 */
export function getEventPrefix(level: string): string {
  const timestamp = dateTimeFormat.format(new Date());
  const prefix = [];

  if (level === "error" || level === "warn") {
    prefix.push(chalk.bold(timestamp));
    prefix.push(`[${level.toUpperCase()}]`);
  } else {
    prefix.push(timestamp);
  }
  prefix.push(`[${LABEL}]`);

  if (level === "error") {
    return chalk.red(prefix.join(" "));
  }
  if (level === "warn") {
    return chalk.yellow(prefix.join(" "));
  }
  return chalk.dim(prefix[0]) + " " + chalk.blue(prefix.slice(1).join(" "));
}

// ================= Routing & Logging ====================

function stringify(msg: unknown): string {
  if (Object.prototype.toString.call(msg) === "[object Object]") {
    return JSON.stringify(msg);
  }
  if (msg instanceof Date) {
    return msg.toUTCString();
  }
  return String(msg);
}

export const IS_CI = !!process.env.CI;

/**
 * Write a message at the given level in Astro's format:
 * `HH:MM:SS [@portosaur/cli] message`. Errors go to stderr, everything
 * else to stdout — matching Astro's console destination.
 *
 * @param {unknown} msg - The message to log.
 * @param {string} level - The level (info, success, warn, error, debug).
 * @param {string} [messagePrefix=""] - Text inserted after the prefix, before the message.
 */
function log(msg: unknown, level: string, messagePrefix = ""): void {
  const s = stringify(msg ?? "");
  const leading = s.match(/^\n+/)?.[0] || "";
  const body = s.replace(/^\n+/, "");

  // Write leading newlines
  if (leading) {
    process.stdout.write(leading);
  }

  // Return early if empty
  if (body === "") {
    return;
  }

  const formatted = `${getEventPrefix(level)} ${messagePrefix}${body}`;
  if (level === "error") {
    console.error(formatted);
  } else {
    console.info(formatted);
  }
}

// ================= Box Helper ====================

const LEVEL_BOX_COLORS: Record<string, string> = {
  info: "blue",
  success: "green",
  warn: "yellow",
  error: "red",
  start: "blue",
  debug: "gray",
  tip: "magenta",
  note: "gray",
};

function makeBox(
  level: string,
  inlineFn: (msg: string) => void,
): (msg: string, options?: BoxOptions) => void {
  const boxColor = LEVEL_BOX_COLORS[level] ?? "cyan";
  return function box(msg: string, options: BoxOptions = {}) {
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
 * Standard level — an Astro-style log line.
 * @param {string} level
 * @param {{ gated?: boolean }} options - gated: only log when DEBUG/VERBOSE is set
 */
export function createLevel(
  level: string,
  { gated = false }: { gated?: boolean } = {},
): LevelFn {
  const fn = ((msg: string) => {
    if (gated && !process.env.DEBUG && !process.env.VERBOSE) {
      return;
    }
    log(msg, level);
  }) as LevelFn;
  fn.box = makeBox(level, fn);
  return fn;
}

/**
 * Custom level — an Astro-style log line with a colored `Tip:`/`Note:`
 * lead-in before the message.
 * @param {string} level
 * @param {Function} colorFn - chalk color function for the lead-in
 */
export function createCustomLevel(level: string, colorFn: ColorFn): LevelFn {
  const leadIn =
    colorFn(`${level.charAt(0).toUpperCase()}${level.slice(1)}:`) + " ";
  const fn = ((msg: string) => {
    log(msg, "info", leadIn);
  }) as LevelFn;
  fn.box = makeBox(level, fn);
  return fn;
}
