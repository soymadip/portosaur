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

// ================= Next.js-style Prefixes ====================

// The per-level prefixes, matching Next.js 16's own logger
// (`next/dist/build/output/log.js`): a single symbol, no
// timestamp, no label. Portosaur's lines blend into the `next
// build` / `next dev` output around them instead of looking like
// a different tool's log.
//
//   info    — bold white ' ' (renders as a 2-space indent)
//   success — bold green '✓' (Next's `event`)
//   warn    — bold yellow '⚠'
//   error   — bold red '⨯'
//   debug   — bold magenta '»' (Next's `trace`)
const LEVEL_PREFIXES: Record<string, () => string> = {
  info: () => chalk.white.bold(" "),
  success: () => chalk.green.bold("✓"),
  warn: () => chalk.yellow.bold("⚠"),
  error: () => chalk.red.bold("⨯"),
  debug: () => chalk.magenta.bold("»"),
};

/**
 * Build the prefix for a log line: the level's symbol, colored
 * the way Next.js colors it. Unknown levels fall back to the
 * info prefix.
 *
 * @param {string} level - The level (info, success, warn, error, debug, tip, note).
 * @returns {string} The colored prefix, without trailing space.
 */
export function getLevelPrefix(level: string): string {
  const prefix = LEVEL_PREFIXES[level] ?? LEVEL_PREFIXES.info;
  return prefix();
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
 * Write a message at the given level in Next.js's format:
 * `<symbol> message` (one space after the symbol, matching
 * Next's `prefixedLog`). Errors go to stderr, everything else
 * to stdout.
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

  const formatted = `${getLevelPrefix(level)} ${messagePrefix}${body}`;
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
 * Standard level — a Next.js-style log line.
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
 * Custom level — a Next.js-style log line with a colored `Tip:`/`Note:`
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
