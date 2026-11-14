import type portosaur from "./integration.mjs";
import type { PortosaurOptions } from "./integration.d.ts";

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

export const ThemePaths: ThemePaths;

export type { PortosaurOptions } from "./integration.d.ts";

/** The Portosaur Astro integration (named re-export). */
export const portosaurIntegration: typeof portosaur;

/** The Portosaur Astro integration (default export — what the generated shim imports). */
export default portosaur;
