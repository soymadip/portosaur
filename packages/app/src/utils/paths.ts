import path from "node:path";

/**
 * Absolute paths to directories within the `@portosaur/app` package.
 */
export interface AppPaths {
  /** The root directory of the package. */
  root: string;
  /** The directory containing static assets. */
  assets: string;
  /** The Astro integration module. */
  integration: string;
}

const pkgDir = path.resolve(import.meta.dirname, "../../");

export const AppPaths: AppPaths = {
  root: pkgDir,
  assets: path.resolve(pkgDir, "assets"),
  integration: path.resolve(pkgDir, "src/integration.ts"),
};
