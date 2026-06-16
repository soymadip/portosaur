import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function themePlugin(_context, options) {
  const themeDir = options.themeDir || path.resolve(__dirname, "../../theme");

  return {
    name: "portosaur-theme",

    // NOTE: Use @theme-init (not @theme-original) when importing the base
    // Docusaurus component inside overrides. @theme-original is overwritten
    // by the alias system for plugin themes; @theme-init is not.
    getThemePath() {
      return themeDir;
    },

    configureWebpack(_config, isServer, utils) {
      return {
        // Disable symlink resolution when notes/ or blog/ is a symlink so
        // webpack doesn't resolve it to the real path before matching the
        // MDX loader's include list (which holds the symlink path).
        // Safe: Docusaurus already aliases react/react-dom/@mdx-js/react.
        ...(options.hasSymlinkedContent && {
          resolve: { symlinks: false },
        }),

        module: {
          rules: [
            {
              // Required when the theme resolves outside node_modules
              // (e.g. bun workspace link), where the default JS rule may not
              // cover .jsx files.
              test: /\.jsx?$/,
              include: [themeDir],
              use: [utils.getJSLoader({ isServer })],
            },
          ],
        },
      };
    },
  };
}
