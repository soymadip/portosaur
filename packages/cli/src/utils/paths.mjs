import path from "node:path";

import { createRequire } from "node:module";

import { getPortoDotDir } from "../engine/utils/fs.mjs";

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

  /** Absolute path to the theme package. */
  get theme() {
    try {
      return path.dirname(require.resolve("@portosaur/theme/package.json"));
    } catch {
      return path.resolve(pkgDir, "../theme");
    }
  },

  /** Resolved theme and asset paths. */
  get portoPaths() {
    return {
      root: this.root,
      themeRoot: this.theme,
      static: path.join(this.theme, "static"),
      assets: path.join(this.theme, "assets"),
      theme: path.join(this.theme, "theme"),
      integration: path.join(this.theme, "src/integration.mjs"),
    };
  },
};

/**
 * The generated Astro project root (`.portosaur/`) for a user project.
 *
 * @param {string} UserRoot - The user's project directory.
 * @returns {string} The absolute path to the `.portosaur/` directory.
 */
export function astroRoot(UserRoot) {
  return getPortoDotDir(UserRoot);
}

/**
 * Resolve the Portosaur theme paths from a user's installed theme package.
 * Falls back to the local workspace package during Portosaur development.
 *
 * @param {string} UserRoot - The user's project directory.
 * @returns {Object} Resolved paths for the theme package.
 */
export function resolvePortoPaths(UserRoot) {
  let themeRoot;

  try {
    const userRequire = createRequire(path.join(UserRoot, "package.json"));
    const themeEntry = userRequire.resolve("@portosaur/theme");
    themeRoot = path.resolve(path.dirname(themeEntry), "..");
  } catch {
    themeRoot = Paths.theme;
  }

  return {
    root: Paths.root,
    themeRoot,
    static: path.join(themeRoot, "static"),
    assets: path.join(themeRoot, "assets"),
    theme: path.join(themeRoot, "theme"),
    integration: path.join(themeRoot, "src/integration.mjs"),
  };
}
