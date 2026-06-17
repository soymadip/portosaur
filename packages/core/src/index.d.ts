export { colors, logger } from "@portosaur/logger";

export interface PortoPkg {
  version?: string;
  [key: string]: any;
}

export interface PortoPaths {
  assets?: string;
  [key: string]: any;
}

export interface DocusaurusContext {
  portoPkg?: PortoPkg;
  portoPaths?: PortoPaths;
  gitDate?: string;
  env?: Record<string, string | undefined>;
}

/**
 * Loads, parses, and validates the user's `config.yml` file.
 * Optionally resolves template variables (like `{{siteRoot}}` or `{{portoRoot}}`)
 * immediately if `systemVars` are provided.
 *
 * @param projectDir - The absolute path to the user's project directory.
 * @param systemVars - Optional system variables to inject for template resolution.
 * @returns The parsed (and optionally resolved) configuration object.
 */
export function loadUserConfig(
  projectDir: string,
  systemVars?: Record<string, any>,
): any;

export { mirrorSync, loadPkg } from "./utils/fs.mjs";
export {
  deepMerge,
  getGitDate,
  hasCommand,
  useEnabled,
  openInBrowser,
} from "./utils/system.mjs";
export { porto, git, text, limits } from "./app.mjs";
export { getCssVar } from "./utils/cssExtractor.mjs";
export { generateFavicons } from "./generators/generateFavicons.mjs";
export { generateRobotsTxt } from "./generators/generateRobots.mjs";
export {
  buildDocuConfig,
  resolveSiteUrl,
  resolveBasePath,
  createStaticAssetResolver,
  buildHeadTags,
} from "./generators/docusaurusConfig.mjs";

/**
 * Resolves template variables like {{site.name}} or {{env.VAR}} within a string or object.
 */
export function resolveVars<T>(
  obj: T,
  userConfig: any,
  systemVars?: Record<string, any>,
  pathStack?: Set<string>,
  depth?: number,
): T;

/**
 * Gets a nested value from an object using a dot-notated string path.
 */
export function getNestedValue(
  obj: any,
  pathStr: string,
  ...fallbacks: string[]
): any;

/**
 * Validates the raw user config against the generated JSON Schema.
 * Returns dot-notation paths for any unknown keys found.
 * Freeform blocks (custom, tools.link_shortener.short_links) are skipped.
 */
export function validateUserConfig(rawConfig: Record<string, any>): string[];
