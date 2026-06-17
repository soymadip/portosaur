/**
 * Absolute paths to directories within the `@portosaur/theme` package.
 */
export interface ThemePaths {
  /** The root directory of the package. */
  root: string;
  /** The directory containing static assets. */
  assets: string;
  /** The directory containing React theme components. */
  theme: string;
  /** The directory containing Node Docusaurus plugins. */
  plugins: string;
}

export const ThemePaths: ThemePaths;
export default ThemePaths;

export interface ThemePluginOptions {
  /** Optional absolute path to override the standard theme directory. */
  themeDir?: string;
  /**
   * If true, disables webpack's symlink resolution. This is required when serving content
   * (like notes/ or blog/) via symlinks to ensure the MDX loader accurately matches paths.
   */
  hasSymlinkedContent?: boolean;
}

/**
 * A standard Docusaurus theme plugin for Portosaur.
 * Configures webpack loaders for out-of-bounds JSX resolution and symlink handling.
 */
export function ThemePlugin(context: any, options?: ThemePluginOptions): any;
