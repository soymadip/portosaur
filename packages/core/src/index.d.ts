export { colors, logger } from "@portosaur/logger";

export interface PortoPkg {
  version?: string;
  [key: string]: any;
}

export interface PortoPaths {
  assets?: string;
  root?: string;
  theme?: string;
  static?: string;
  [key: string]: any;
}

export interface DocusaurusContext {
  portoPkg?: PortoPkg;
  portoPaths?: PortoPaths;
  gitDate?: string;
  env?: Record<string, string | undefined>;
  portoRoot?: string;
  projectVersion?: string;
  extraHeadTags?: any[];
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

// ----------------------------------------------------------------------------
// File System Utilities (utils/fs.mjs)
// ----------------------------------------------------------------------------

/**
 * Gets the standardized path to the hidden Portosaur data directory.
 * @param siteDir - The project root directory.
 * @returns The resolved path (e.g., `<siteDir>/.docusaurus/.portosaur`).
 */
export function getPortoDotDir(siteDir: string): string;

/**
 * Loads a package.json file from a directory.
 * @param dir - The directory to look in.
 * @returns The parsed package.json or an empty object if not found or invalid.
 */
export function loadPkg(dir: string): Record<string, any>;

/**
 * Recursively copies a directory while performing variable replacements in text files.
 * @param src - Source directory path.
 * @param dest - Destination directory path.
 * @param replacements - Map of {{key}} to replacement values.
 * @param ignores - List of file names or relative paths to skip.
 */
export function mirrorSync(
  src: string,
  dest: string,
  replacements?: Record<string, string>,
  ignores?: string[],
): void;

// ----------------------------------------------------------------------------
// System Utilities (utils/system.mjs)
// ----------------------------------------------------------------------------

/**
 * Performs a deep merge of two objects.
 * @param target - The target object.
 * @param source - The source object.
 * @returns The newly merged object.
 */
export function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any>;

/**
 * Gets the last modification date of a git project.
 * @param siteDir - The project directory.
 * @returns Formatted date string (e.g., "August 12, 2024").
 */
export function getGitDate(siteDir: string): string;

/**
 * Checks if a command exists in the system PATH.
 * @param command - The command to check.
 * @returns True if the command is available.
 */
export function hasCommand(command: string): boolean;

/**
 * Filters a list of items, only including those that are enabled.
 * Supports both raw values and `{ enable: boolean, value: any }` objects.
 * @param items - The items to filter.
 * @returns The enabled values.
 */
export function useEnabled(items: any[]): any[];

/**
 * Opens a URL in the user's default browser.
 * @param url - The URL to open.
 * @returns True if successful.
 */
export function openInBrowser(url: string): boolean;

// ----------------------------------------------------------------------------
// Application Constants (app.mjs)
// ----------------------------------------------------------------------------

/** Portosaur application metadata and configuration */
export const porto: {
  name: string;
  version: string;
  description: string;
  license: string;
  homepage: string;
  repository: string;
  engines: Record<string, string>;
  engineName: string;
};

/** Git operations and formats */
export const git: { dateFormat: string };

/** Text file extensions for processing */
export const text: { extensions: Set<string> };

/** System limits and constraints */
export const limits: { maxResolveDepth: number };

// ----------------------------------------------------------------------------
// CSS Utilities (utils/cssExtractor.mjs)
// ----------------------------------------------------------------------------

/**
 * Extracts a CSS variable's value from an array of CSS files.
 * Supports resolving nested variables (e.g., var(--other-var)).
 *
 * @param varName - The CSS variable name to find (e.g., '--ifm-color-primary').
 * @param cssFiles - Array of absolute paths to CSS files to search in.
 * @returns The resolved CSS variable value, or null if not found.
 */
export function getCssVar(varName: string, cssFiles?: string[]): string | null;

// ----------------------------------------------------------------------------
// Generators (generators/*.mjs)
// ----------------------------------------------------------------------------

export interface FaviconOptions {
  imagePath?: string;
  appVersion?: string;
  circular?: boolean;
  shape?: string;
  proxies?: string[];
  outputPath?: string;
  themeColor?: string;
  backgroundColor?: string;
  siteTitle?: string;
  siteTagline?: string;
  staticDirs?: string[];
  portoAssetsDir?: string;
}

export interface FaviconResult {
  success: boolean;
  html: any[];
}

/**
 * Generates favicon assets and PWA manifests using the `favicons` library.
 */
export function generateFavicons(
  siteDir: string,
  options?: FaviconOptions,
): Promise<FaviconResult>;

export interface RobotsOptions {
  enable?: boolean;
  rules?: Array<{ allow?: string | string[]; disallow?: string | string[] }>;
  customLines?: string[];
  siteUrl?: string;
  baseUrl?: string;
}

/**
 * Generates a robots.txt file in the static directory.
 */
export function generateRobotsTxt(
  siteDir: string,
  options?: RobotsOptions,
): void;

/**
 * Generates a Docusaurus configuration object from raw user config.
 */
export function buildDocuConfig(
  rawUserConfig: any,
  projectDir: string,
  context?: DocusaurusContext,
): any;

// ----------------------------------------------------------------------------
// Docusaurus Utilities (utils/docusaurus.mjs)
// ----------------------------------------------------------------------------

/**
 * Resolves site URL based on config or environment (e.g. GitHub Actions).
 */
export function resolveSiteUrl(
  configValue: string,
  env?: Record<string, string | undefined>,
): string;

/**
 * Resolves base path based on config or environment.
 * GitHub user/organization Pages repositories resolve to `/`, while
 * project Pages repositories resolve to `/<repository>/`.
 */
export function resolveBasePath(
  configValue: string,
  env?: Record<string, string | undefined>,
): string;

/**
 * Creates a function to resolve static asset paths from the provided directories.
 */
export function createStaticAssetResolver(
  _projectDir: string,
  staticDir: string,
  assetsDir: string,
): (primaryPath: string, fallbackPath?: string) => string;

/**
 * Transforms tag objects into Docusaurus head tag format.
 */
export function buildHeadTags(tags?: any[]): any[];

/**
 * Automatically cleans slugs and strips numeric sorting prefixes from document metadata.
 */
export function cleanFrontMatterSlug(params: {
  filePath: string;
  frontMatter: Record<string, any>;
  projectDir: string;
  contentDirName?: string;
}): Record<string, any>;

// ----------------------------------------------------------------------------
// Configuration Utilities (utils/config.mjs & utils/validate.mjs)
// ----------------------------------------------------------------------------

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
