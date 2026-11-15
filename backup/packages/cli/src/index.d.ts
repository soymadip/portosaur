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
 * Initializes a new Portosaur project interactively or via provided options.
 * @param options Initialization options (e.g., from command line flags).
 */
export function initCommand(options?: InitOptions): Promise<void>;

/**
 * Sets up CI/CD workflows for an existing Portosaur project.
 * @param options Configuration options.
 */
export function initCiCommand(options?: InitCiOptions): Promise<void>;

/**
 * Starts the Docusaurus development server with hot module reloading.
 * @param siteDir The project directory (defaults to current working directory).
 * @param extraArgs Additional arguments passed through to the Docusaurus CLI.
 */
export function devCommand(
  siteDir?: string,
  extraArgs?: string[] | any,
): Promise<void>;

/**
 * Builds the Portosaur site for production.
 * @param siteDir The project directory (defaults to current working directory).
 * @param extraArgs Additional arguments passed through to the Docusaurus CLI.
 */
export function buildCommand(
  siteDir?: string,
  extraArgs?: string[] | any,
): Promise<void>;

/**
 * Serves the built static site locally.
 * @param siteDir The project directory (defaults to current working directory).
 * @param extraArgs Additional arguments passed through to the Docusaurus CLI.
 */
export function serveCommand(
  siteDir?: string,
  extraArgs?: string[] | any,
): Promise<void>;

/**
 * Generates the configuration JSON Schema for IDE validation.
 * @param outPath Where to output the generated schema.
 * @param srcPath The path to the source typescript types to parse.
 */
export function schemaCommand(outPath?: string, srcPath?: string): void;

/**
 * Displays available VCS providers and hosting platforms from the registry.
 * @param subcommand 'vcs', 'hosting', or null to show all.
 */
export function providersCommand(
  subcommand?: "vcs" | "hosting" | null,
): Promise<void>;
