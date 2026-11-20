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

  /** Absolute path to the engine directory (the former engine package, now inside cli). */
  get engine() {
    return path.join(srcDir, "engine");
  },

  /** Absolute path to the core package. */
  get core() {
    try {
      return path.dirname(require.resolve("@portosaur/core/package.json"));
    } catch {
      return path.resolve(pkgDir, "../core");
    }
  },

  /** Resolved app and asset paths. */
  get portoPaths() {
    return {
      root: this.root,
      coreRoot: this.core,
      static: path.join(this.core, "static"),
      assets: path.join(this.core, "assets"),
    };
  },
};

/**
 * The generated Next.js project root (`.portosaur/`) for a user project.
 *
 * @param {string} UserRoot - The user's project directory.
 * @returns {string} The absolute path to the `.portosaur/` directory.
 */
export function nextRoot(UserRoot: string): string {
  return getPortoDotDir(UserRoot);
}

/**
 * Resolve the Portosaur core paths from a user's installed core package.
 * Falls back to the local workspace package during Portosaur development.
 *
 * @param {string} UserRoot - The user's project directory.
 * @returns {Object} Resolved paths for the core package.
 */
export function resolvePortoPaths(UserRoot: string) {
  let coreRoot: string;

  try {
    const userRequire = createRequire(path.join(UserRoot, "package.json"));
    const coreEntry = userRequire.resolve("@portosaur/core");
    coreRoot = path.resolve(path.dirname(coreEntry), "..");
  } catch {
    coreRoot = Paths.core;
  }

  return {
    root: Paths.root,
    coreRoot,
    static: path.join(coreRoot, "static"),
    assets: path.join(coreRoot, "assets"),
  };
}
