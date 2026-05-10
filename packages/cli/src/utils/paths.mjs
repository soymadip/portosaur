import fs from "node:fs";
import path from "node:path";

import { createRequire } from "node:module";

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

  /** Absolute path to the core package. */
  get core() {
    try {
      return path.dirname(require.resolve("@portosaur/core/package.json"));
    } catch {
      return path.resolve(pkgDir, "../core");
    }
  },

  /** Absolute path to the theme package. */
  get theme() {
    try {
      return path.dirname(require.resolve("@portosaur/theme/package.json"));
    } catch {
      return path.resolve(pkgDir, "../theme");
    }
  },
};
