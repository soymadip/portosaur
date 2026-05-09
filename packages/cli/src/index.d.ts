export interface InitOptions {
  /** VCS Provider ID (e.g., "github", "gitlab") */
  vcsProvider?: string;
  /** Hosting Platform ID (e.g., "github_pages", "surge") */
  hosting?: string;
  /** VCS username */
  username?: string;
  /** Full name for the portfolio */
  name?: string;
  /** Project name/directory */
  projectName?: string;
  /** Whether to install dependencies after initialization (default: true) */
  install?: boolean;
}

export interface InitCiOptions {
  /** Hosting Platform ID */
  hosting?: string;
}

/**
 * Initializes a new Portosaur project.
 */
export function initCommand(options?: InitOptions): Promise<void>;

/**
 * Sets up CI/CD workflows for an existing project.
 */
export function initCiCommand(options?: InitCiOptions): Promise<void>;

/**
 * Starts the Docusaurus development server.
 */
export function devCommand(siteDir?: string, extraArgs?: string[]): void;

/**
 * Builds the Docusaurus static site.
 */
export function buildCommand(siteDir?: string, extraArgs?: string[]): void;

/**
 * Serves the built static site locally.
 */
export function serveCommand(siteDir?: string, extraArgs?: string[]): void;

/**
 * Generates the config schema.
 */
export function schemaCommand(outPath?: string, srcPath?: string): void;
