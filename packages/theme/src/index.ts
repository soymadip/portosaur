import path from "node:path";

/**
 * Absolute paths to directories within the `@portosaur/theme` package.
 */
export interface ThemePaths {
  /** The root directory of the package. */
  root: string;
  /** The directory containing static assets. */
  assets: string;
  /** The directory containing `.astro` theme components and layouts. */
  theme: string;
  /** The Astro integration module. */
  integration: string;
}

const pkgDir = path.resolve(import.meta.dirname, "../");

export const ThemePaths: ThemePaths = {
  root: pkgDir,
  assets: path.resolve(pkgDir, "assets"),
  theme: path.resolve(pkgDir, "theme"),
  integration: path.resolve(pkgDir, "src/integration.ts"),
};

export { default as portosaurIntegration } from "./integration.ts";
export { default } from "./integration.ts";
export type { PortosaurOptions } from "./integration.ts";
