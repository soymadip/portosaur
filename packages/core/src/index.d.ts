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
 * Loads and parses the user's config.yml file.
 */
export function loadUserConfig(projectDir: string): any;

export { mirrorSync, loadPkg } from "./utils/fs.mjs";
export {
  deepMerge,
  getGitDate,
  hasCommand,
  useEnabled,
  openInBrowser,
} from "./utils/system.mjs";
export { porto, git, text, limits } from "./app.mjs";
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
