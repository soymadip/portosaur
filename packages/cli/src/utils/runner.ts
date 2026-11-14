import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  buildSiteConfig,
  buildAstroConfigContent,
  buildContentConfigContent,
  hasCommand,
  getPortoDotDir,
  loadUserConfig,
} from "../engine/index.ts";
import type { PortoPaths, SiteConfigContext } from "../engine/index.ts";
import { logger } from "../logger/index.ts";
import type { Logger } from "../logger/index.ts";
import { resolvePortoPaths } from "./paths.ts";

export interface AstroShimCliOptions {
  outDir?: string;
  minify?: boolean;
  poll?: boolean | string;
}

/**
 * Generates the thin Astro project root in `.portosaur/` by resolving the
 * Portosaur config at CLI time and embedding the result as the integration
 * options. Two files are written: `astro.config.mjs` (site/base/outDir +
 * `portosaur(options)`) and `src/content.config.ts` (collections whose glob
 * loaders point at the user's content dirs). Nothing else is generated —
 * the integration owns all build-time work (D13).
 *
 * @param {string} UserRoot - The user's project directory.
 * @param {Object} portoPaths - Paths to Portosaur assets and theme.
 * @param {Object} [context={}] - Additional context for config resolution.
 * @param {boolean} [forceRefresh=false] - Bust the mtime cache comment.
 * @param {Object} [cliOptions={}] - CLI flag overrides (`outDir`, `minify`, `poll`).
 * @returns {{ astroRoot: string, astroConfigPath: string, contentConfigPath: string, outDir: string }} Paths to the generated root and files, plus the resolved output dir.
 */
export function writeAstroShim(
  UserRoot: string,
  portoPaths: PortoPaths,
  context: SiteConfigContext = {},
  forceRefresh = false,
  cliOptions: AstroShimCliOptions = {},
): {
  astroRoot: string;
  astroConfigPath: string;
  contentConfigPath: string;
  outDir: string;
} {
  const astroRoot = getPortoDotDir(UserRoot);

  if (!fs.existsSync(astroRoot)) {
    fs.mkdirSync(astroRoot, { recursive: true });
  }
  const srcDir = path.join(astroRoot, "src");
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  let configMtime = Date.now();
  const configYaml = ["config.yaml", "config.yml"].find((file) =>
    fs.existsSync(path.join(UserRoot, file)),
  );

  if (configYaml && !forceRefresh) {
    configMtime = fs.statSync(path.join(UserRoot, configYaml)).mtimeMs;
  }

  const rawConf = loadUserConfig(UserRoot);
  const options = buildSiteConfig(rawConf, UserRoot, {
    portoPaths,
    portoRoot: portoPaths.themeRoot,
    ...context,
  });

  const outDirName =
    cliOptions.outDir || options.site.build.outputDir || "build";
  const outDir = path.resolve(UserRoot, outDirName);

  const astroConfigPath = path.join(astroRoot, "astro.config.mjs");
  fs.writeFileSync(
    astroConfigPath,
    buildAstroConfigContent(options, {
      projectDir: UserRoot,
      outDir,
      mtime: configMtime,
      minify: cliOptions.minify !== false,
      poll: cliOptions.poll || false,
    }),
  );

  const contentConfigPath = path.join(srcDir, "content.config.ts");
  fs.writeFileSync(
    contentConfigPath,
    buildContentConfigContent(options, configMtime, UserRoot),
  );

  return { astroRoot, astroConfigPath, contentConfigPath, outDir };
}

/**
 * Logs the resolved site URL and base path from the resolved site config.
 *
 * @param {string} UserRoot - The user's project directory.
 * @param {Object} portoPaths - Paths to Portosaur assets and theme.
 * @param {Object} [context={}] - Additional context for config resolution.
 */
export function logResolvedSiteLocation(
  UserRoot: string,
  portoPaths: PortoPaths,
  context: SiteConfigContext = {},
): void {
  const rawConf = loadUserConfig(UserRoot);
  const options = buildSiteConfig(rawConf, UserRoot, {
    portoPaths,
    portoRoot: portoPaths.themeRoot,
    ...context,
  });

  logger.info(`Resolved site URL: ${options.site.url}`);
  logger.info(`Resolved base path: ${options.site.baseUrl}`);
}

/**
 * Validate that the current directory is a Portosaur project.
 * @param {string} UserRoot - The directory to validate.
 * @throws {Error} If config.yml is missing.
 */
export function validateProject(UserRoot: string): void {
  const configPath = ["config.yaml", "config.yml"].find((file) =>
    fs.existsSync(path.join(UserRoot, file)),
  );

  if (!configPath) {
    throw new Error(
      "config.yml/config.yaml not found. Are you in a Portosaur project directory?",
    );
  }
}

/**
 * Ensure essential user content directories exist.
 * @param {string} UserRoot - The project root directory.
 */
export function ensureContentDirs(
  UserRoot: string,
  overrideSiteType: string | null = null,
): void {
  let userConfig: Record<string, any> = {};
  try {
    userConfig = loadUserConfig(UserRoot);
  } catch (e) {
    // Gracefully handle missing config during project initialization
  }
  const siteMode =
    overrideSiteType || (userConfig.docs_home ? "docs" : "portfolio");
  const docsDir =
    siteMode === "docs"
      ? userConfig.site?.docs?.dir || "docs"
      : userConfig.site?.notes?.dir || "notes";

  for (const dir of [docsDir, "blog", "static"]) {
    if (!fs.existsSync(path.join(UserRoot, dir))) {
      fs.mkdirSync(path.join(UserRoot, dir), { recursive: true });
    }
  }
}

/**
 * Print deployment tips defined in registry.yml
 * @param {Object} hostingPlatforms - Hosting platforms registry.
 * @param {string} hostingPlatformKey - The selected platform key.
 * @param {Object} logger - The Portosaur logger instance.
 * @param {Object} [vars={}] - Variables for replacement in tips.
 */
export function printWorkflowTips(
  hostingPlatforms: Record<string, any>,
  hostingPlatformKey: string,
  logger: Logger,
  vars: Record<string, any> = {},
): void {
  const config = hostingPlatforms[hostingPlatformKey];
  if (config && config.post_setup_tips) {
    for (let tip of config.post_setup_tips) {
      if (vars.projectName)
        tip = tip.replace(/\{\{projectName\}\}/g, vars.projectName);
      if (vars.userName) tip = tip.replace(/\{\{user\}\}/g, vars.userName);
      logger.tip(tip);
    }
  }
}

/**
 * Warn the user if their project name does not match the expected platform repository pattern.
 * @param {Object} hostingPlatforms - Hosting platforms registry.
 * @param {string} hostingPlatformKey - The selected platform key.
 * @param {string} projectName - Current project name.
 * @param {string} userName - VCS username.
 * @param {Object} logger - The Portosaur logger instance.
 * @param {string} [heading] - Warning heading.
 */
export function warnIfRepoNameMismatch(
  hostingPlatforms: Record<string, any>,
  hostingPlatformKey: string,
  projectName: string,
  userName: string,
  logger: Logger,
  heading = "Project Name Mismatch",
): void {
  const config = hostingPlatforms[hostingPlatformKey];
  if (!config || !config.repo || !config.repo.ideal_name) return;

  const expectedRepo = config.repo.ideal_name
    .replace("{{user}}", userName || "yourusername")
    .replace("{{domain}}", config.domain || "");

  if (projectName === expectedRepo || !config.repo.mismatch_msg) return;

  const projectNameForMsg = projectName || "(custom name)";

  const customMsg = config.repo.mismatch_msg
    .replace(/\{\{user\}\}/g, userName || "yourusername")
    .replace(/\{\{projectName\}\}/g, projectNameForMsg)
    .replace(/\{\{domain\}\}/g, config.domain || "")
    .replace(/\{\{idealName\}\}/g, expectedRepo);

  logger.warn(`[${heading}] ${customMsg}`);
}

/**
 * Executes an Astro command via the stable Astro CLI (never the
 * experimental programmatic API).
 *
 * @param {string} command - Astro command to run (e.g., 'dev', 'build', 'preview').
 * @param {string} UserRoot - The project directory.
 * @param {string} astroRoot - Path to the generated `.portosaur/` Astro root.
 * @param {string[]} [extraArgs=[]] - Additional CLI arguments.
 * @returns {Promise<void>}
 */
export async function runAstro(
  command: string,
  UserRoot: string,
  astroRoot: string,
  extraArgs: string[] = [],
  portoPaths: PortoPaths = resolvePortoPaths(UserRoot),
): Promise<void> {
  // Skip actual execution in test mode — before resolving the binary, so
  // the scaffold test (which runs without installing deps) never needs a
  // resolvable `astro` package.
  if (process.env.PORTO_TEST_MODE === "true") {
    let runtime = "node";
    if (typeof Bun !== "undefined" || !hasCommand("node")) {
      runtime = "bun";
    }
    console.log(
      `[TEST_MODE] Would run astro ${command} in ${UserRoot} using ${runtime}`,
    );
    return Promise.resolve();
  }

  const require = createRequire(import.meta.url);
  let astroBin: string;

  try {
    // Astro 7 exports no `astro.js` entry — the CLI lives at
    // `bin/astro.mjs` (the package's `bin` field). Resolve the package
    // root via its exported `./package.json`, then join the bin path.
    const astroPkgJson = require.resolve("astro/package.json", {
      paths: [portoPaths.themeRoot, UserRoot],
    });
    astroBin = path.join(path.dirname(astroPkgJson), "bin", "astro.mjs");
    if (!fs.existsSync(astroBin)) {
      throw new Error(`astro CLI not found at ${astroBin}`);
    }
  } catch (error) {
    throw new Error(
      `Unable to resolve astro from @portosaur/theme at ${portoPaths.themeRoot}`,
      { cause: error },
    );
  }

  const args = [astroBin, command, "--root", astroRoot, ...extraArgs];

  // Use bun when available for faster builds, fall back to node.
  // If node isn't installed, fallback to bun gracefully.
  let runtime = "node";
  if (typeof Bun !== "undefined" || !hasCommand("node")) {
    runtime = "bun";
  }

  const childEnv = {
    ...process.env,
    FORCE_COLOR: "true",
  };

  const child = spawn(runtime, args, {
    stdio: "inherit",
    cwd: UserRoot,
    env: childEnv,
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Astro exited with code ${code}`));
      }
    });
  });
}
