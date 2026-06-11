import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function themePlugin(_context, options) {
  const themeDir = options.themeDir || path.resolve(__dirname, "../../theme");

  return {
    name: "portosaur-theme",

    // Registers Portosaur component overrides (swizzle targets).
    // NOTE: Use @theme-init (not @theme-original) when importing the base
    // Docusaurus component inside these overrides. @theme-original is
    // overwritten by the alias system for plugin themes; @theme-init is not.
    getThemePath() {
      return themeDir;
    },

    // Adds the JSX/Babel loader for .jsx files in the theme directory.
    // Required when the theme resolves outside node_modules (e.g. bun-link
    // in development), where Docusaurus's default JS rule may not cover it.
    configureWebpack(_config, isServer, utils) {
      return {
        module: {
          rules: [
            {
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
