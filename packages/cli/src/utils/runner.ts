import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import * as prettier from "prettier";
import {
  buildSiteConfig,
  buildNextRootFiles,
  hasCommand,
  openInBrowser,
  getPortoDotDir,
  loadUserConfig,
} from "../engine/index.ts";
import type { PortoPaths, SiteConfigContext } from "../engine/index.ts";
import { logger } from "../logger/index.ts";
import type { Logger } from "../logger/index.ts";
import { resolvePortoPaths } from "./paths.ts";

export interface NextRootCliOptions {
  outDir?: string;
}

/**
 * Files and directories the generator owns inside `.portosaur/`.
 * Everything listed here is removed before each regeneration so a mode
 * switch (docs <-> portfolio) leaves no stale route files behind.
 * `.next/` and `.source/` are Next.js's and fumadocs-mdx's own dirs —
 * never touched, so dev rebuilds and the Turbopack cache survive a
 * regeneration.
 */
const GENERATED_ROOT_DIRS = ["app", "lib"];
const GENERATED_ROOT_FILES = [
  "next.config.mjs",
  "source.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
];

/**
 * Formats one generated file with prettier (defaults — the repo has
 * no prettier config, so generated files match the hand-written
 * code's formatting). Generated files must read like human-written
 * code: the builders emit reasonable templates, but embedded JSON
 * and long literals only get proper line breaks from a real
 * formatter. `tsconfig.json` carries `//` header comments, so it
 * formats as JSONC, not JSON. On a formatting failure the file is
 * written unformatted with a warning — a formatter quirk must not
 * break a user's build (Next will still fail loudly on a real
 * syntax error).
 */
async function formatGeneratedFile(
  target: string,
  content: string,
): Promise<string> {
  try {
    return await prettier.format(content, {
      filepath: target,
      parser: target.endsWith(".json") ? "jsonc" : undefined,
    });
  } catch (error) {
    logger.warn(
      `Could not format generated file ${path.basename(target)}: ${(error as Error).message}`,
    );
    return content;
  }
}

/**
 * Generates the thin Next.js project root in `.portosaur/` by resolving
 * the Portosaur config at CLI time and embedding the result as the
 * generated `lib/config.ts` module. The generated files are thin
 * wrappers — every real implementation lives in `@portosaur/app` and is
 * imported from there.
 *
 * The user's `static/` directory is exposed to Next.js as
 * `.portosaur/public` via a symlink (Next has no `publicDir` option):
 * static assets resolve from the user's directory in both dev and
 * build, with no copying step to go stale.
 *
 * Every generated file is formatted with prettier before writing
 * (async — prettier 3 has no sync API), so the generated root reads
 * like hand-written code.
 *
 * @param {string} UserRoot - The user's project directory.
 * @param {Object} portoPaths - Paths to Portosaur assets and theme.
 * @param {Object} [context={}] - Additional context for config resolution.
 * @param {boolean} [forceRefresh=false] - Bust the mtime cache comment.
 * @param {Object} [cliOptions={}] - CLI flag overrides (`outDir`).
 * @returns {{ nextRoot: string, outDir: string }} Paths to the generated root and the resolved output dir.
 */
/**
 * Whether a directory holds at least one Markdown file (`.md` or
 * `.mdx`), searching recursively. A missing directory holds none.
 * Used to decide whether the blog routes exist at all (see
 * `NextRootArgs.hasBlogPosts`).
 */
function dirHasMdxFiles(dir: string): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dirHasMdxFiles(full)) {
        return true;
      }
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      return true;
    }
  }

  return false;
}

/**
 * Hosts the generated `next.config.mjs` allows to reach Next.js dev
 * resources (`allowedDevOrigins`): `127.0.0.1` plus the machine's
 * LAN IPv4 addresses, so hot reload works when the dev server is
 * opened from another loopback address or from a phone on the
 * network. `localhost` and the started hostname are already
 * allowed by Next itself, so they are not listed here.
 */
function resolveDevOrigins(): string[] {
  const origins = new Set<string>(["127.0.0.1"]);

  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        origins.add(addr.address);
      }
    }
  }

  return [...origins];
}

export async function writeNextRoot(
  UserRoot: string,
  portoPaths: PortoPaths,
  context: SiteConfigContext = {},
  forceRefresh = false,
  cliOptions: NextRootCliOptions = {},
): Promise<{
  nextRoot: string;
  outDir: string;
}> {
  const nextRoot = getPortoDotDir(UserRoot);

  if (!fs.existsSync(nextRoot)) {
    fs.mkdirSync(nextRoot, { recursive: true });
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
    portoRoot: portoPaths.appRoot,
    ...context,
  });

  const outDirName =
    cliOptions.outDir || options.site.build.outputDir || "build";
  const outDir = path.resolve(UserRoot, outDirName);

  // Clear the previous generation (see GENERATED_ROOT_* above).
  for (const dir of GENERATED_ROOT_DIRS) {
    fs.rmSync(path.join(nextRoot, dir), { recursive: true, force: true });
  }
  for (const file of GENERATED_ROOT_FILES) {
    fs.rmSync(path.join(nextRoot, file), { force: true });
  }

  const files = buildNextRootFiles(options, {
    projectDir: UserRoot,
    outDir,
    mtime: configMtime,
    hasBlogPosts: dirHasMdxFiles(path.join(UserRoot, options.site.blogDir)),
    devOrigins: resolveDevOrigins(),
  });

  for (const [relPath, content] of Object.entries(files)) {
    const target = path.join(nextRoot, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await formatGeneratedFile(target, content));
  }

  // Static passthrough: `.portosaur/public` links to the user's
  // `static/` dir. Only a missing path or a stale symlink is replaced —
  // a real directory is left alone (something else owns it).
  const staticDir = path.join(UserRoot, "static");
  if (fs.existsSync(staticDir)) {
    const publicLink = path.join(nextRoot, "public");
    let needsLink = true;
    try {
      const stat = fs.lstatSync(publicLink);
      if (stat.isSymbolicLink()) {
        needsLink = fs.readlinkSync(publicLink) !== "../static";
      } else {
        needsLink = false;
      }
    } catch {
      // Missing — the link needs creating.
    }
    if (needsLink) {
      fs.rmSync(publicLink, { force: true });
      fs.symlinkSync("../static", publicLink, "dir");
    }
  }

  return { nextRoot, outDir };
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
    portoRoot: portoPaths.appRoot,
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
 * Waits until a local server answers, then opens it in the browser.
 * Next.js has no `--open` flag, so `porto dev` / `porto serve` open the
 * browser themselves (Docusaurus behavior, kept). Any HTTP response
 * counts as "up" — even an error page means the server is listening.
 * Gives up silently after a minute so a failed server never hangs the
 * command on the browser step.
 */
async function waitForServerAndOpen(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      openInBrowser(url);
      return;
    } catch {
      // Server is not up yet — keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export interface RunNextOptions {
  /** URL to open in the browser once the server answers (dev only). */
  openUrl?: string;
}

/**
 * Executes a Next.js command via the user project's `next` binary, run
 * from the generated `.portosaur/` root (Next has no `--root` flag, so
 * the working directory IS the project root; Node resolves modules up
 * to the user project's `node_modules`).
 *
 * Next.js is tested on Node — it runs under `node`, falling back to
 * `bun` only when node is not installed.
 *
 * @param {string} command - Next command to run (e.g., 'dev', 'build').
 * @param {string} UserRoot - The project directory.
 * @param {string} nextRoot - Path to the generated `.portosaur/` root.
 * @param {string[]} [extraArgs=[]] - Additional CLI arguments.
 * @param {Object} [portoPaths] - Resolved Portosaur paths.
 * @param {Object} [runOptions={}] - Runner options (`openUrl`).
 * @returns {Promise<void>}
 */
export async function runNext(
  command: string,
  UserRoot: string,
  nextRoot: string,
  extraArgs: string[] = [],
  portoPaths: PortoPaths = resolvePortoPaths(UserRoot),
  runOptions: RunNextOptions = {},
): Promise<void> {
  // Skip actual execution in test mode — before resolving the binary, so
  // the scaffold test (which runs without installing deps) never needs a
  // resolvable `next` package.
  if (process.env.PORTO_TEST_MODE === "true") {
    console.log(`[TEST_MODE] Would run next ${command} in ${nextRoot}`);
    return Promise.resolve();
  }

  const require = createRequire(import.meta.url);
  let nextBin: string;

  try {
    // The Next.js CLI lives at `dist/bin/next` (the package's `bin`
    // field). Resolve the package root via its exported `./package.json`,
    // then join the bin path.
    const nextPkgJson = require.resolve("next/package.json", {
      paths: [UserRoot, portoPaths.appRoot],
    });
    nextBin = path.join(path.dirname(nextPkgJson), "dist", "bin", "next");
    if (!fs.existsSync(nextBin)) {
      throw new Error(`next CLI not found at ${nextBin}`);
    }
  } catch (error) {
    throw new Error(`Unable to resolve next from the project at ${UserRoot}`, {
      cause: error,
    });
  }

  const args = [nextBin, command, ...extraArgs];

  let runtime = "node";
  if (!hasCommand("node")) {
    runtime = "bun";
  }

  const childEnv = {
    ...process.env,
    FORCE_COLOR: "true",
  };

  const child = spawn(runtime, args, {
    stdio: "inherit",
    cwd: nextRoot,
    env: childEnv,
  });

  if (runOptions.openUrl) {
    void waitForServerAndOpen(runOptions.openUrl);
  }

  return new Promise((resolve, reject) => {
    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Next.js exited with code ${code}`));
      }
    });
  });
}

/**
 * Serves a built static site with the `serve` package (a dependency of
 * `@portosaur/cli`, so it is always available). `next start` does NOT
 * work with `output: 'export'` — the output is plain static files, and
 * `porto serve` is a static file server over them.
 *
 * @param {string} outDir - The built output directory to serve.
 * @param {string[]} [extraArgs=[]] - `serve` flags (`-l` listen URI, `-p` port).
 * @param {string} [openUrl] - URL to open in the browser once serving.
 * @returns {Promise<void>}
 */
export async function runServe(
  outDir: string,
  extraArgs: string[] = [],
  openUrl?: string,
): Promise<void> {
  // Skip actual execution in test mode, mirroring runNext.
  if (process.env.PORTO_TEST_MODE === "true") {
    console.log(`[TEST_MODE] Would serve ${outDir}`);
    return Promise.resolve();
  }

  const require = createRequire(import.meta.url);
  let serveBin: string;

  try {
    // serve 14's bin is `build/main.js` (its package `bin` field).
    const servePkgJson = require.resolve("serve/package.json");
    serveBin = path.join(path.dirname(servePkgJson), "build", "main.js");
    if (!fs.existsSync(serveBin)) {
      throw new Error(`serve CLI not found at ${serveBin}`);
    }
  } catch (error) {
    throw new Error(`Unable to resolve the serve package`, {
      cause: error,
    });
  }

  const args = [serveBin, ...extraArgs, outDir];

  let runtime = "node";
  if (!hasCommand("node")) {
    runtime = "bun";
  }

  const child = spawn(runtime, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: "true",
    },
  });

  if (openUrl) {
    void waitForServerAndOpen(openUrl);
  }

  return new Promise((resolve, reject) => {
    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`serve exited with code ${code}`));
      }
    });
  });
}
