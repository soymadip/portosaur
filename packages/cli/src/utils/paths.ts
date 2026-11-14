import path from "node:path";

import { createRequire } from "node:module";

import { getPortoDotDir } from "../engine/utils/fs.ts";

const require = createRequire(import.meta.url);

const srcDir = path.resolve(import.meta.dirname, "../");
const pkgDir = path.resolve(srcDir, "../");

/**
 * Centralized paths for the CLI package.
 */
export const Paths = {
  /** CLI package root. */
  root: pkgDir,

  /** CLI src directory. */
  src: srcDir,

  /** CLI templates directory. */
  templates: path.join(srcDir, "templates"),

  /** Registry file. */
  registry: path.join(srcDir, "templates/registry.yml"),

  /** Workflows directory. */
  workflows: path.join(srcDir, "templates/workflows"),

  /** CLI's package.json file. */
  packageJson: path.join(pkgDir, "package.json"),

  /** Absolute path to the engine directory (the former @portosaur/core, now inside cli). */
  get engine() {
    return path.join(srcDir, "engine");
  },

  /** Absolute path to the app package. */
  get app() {
    try {
      return path.dirname(require.resolve("@portosaur/app/package.json"));
    } catch {
      return path.resolve(pkgDir, "../app");
    }
  },

  /** Resolved app and asset paths. */
  get portoPaths() {
    return {
      root: this.root,
      appRoot: this.app,
      static: path.join(this.app, "static"),
      assets: path.join(this.app, "assets"),
      integration: path.join(this.app, "src/integration.ts"),
    };
  },
};

/**
 * The generated Astro project root (`.portosaur/`) for a user project.
 *
 * @param {string} UserRoot - The user's project directory.
 * @returns {string} The absolute path to the `.portosaur/` directory.
 */
export function astroRoot(UserRoot: string): string {
  return getPortoDotDir(UserRoot);
}

/**
 * Resolve the Portosaur app paths from a user's installed app package.
 * Falls back to the local workspace package during Portosaur development.
 *
 * @param {string} UserRoot - The user's project directory.
 * @returns {Object} Resolved paths for the app package.
 */
export function resolvePortoPaths(UserRoot: string) {
  let appRoot: string;

  try {
    const userRequire = createRequire(path.join(UserRoot, "package.json"));
    const appEntry = userRequire.resolve("@portosaur/app");
    appRoot = path.resolve(path.dirname(appEntry), "..");
  } catch {
    appRoot = Paths.app;
  }

  return {
    root: Paths.root,
    appRoot,
    static: path.join(appRoot, "static"),
    assets: path.join(appRoot, "assets"),
    integration: path.join(appRoot, "src/integration.ts"),
  };
}
