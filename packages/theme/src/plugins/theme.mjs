import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function themePlugin(_context, options) {
  return {
    name: "portosaur-theme",

    // Registers Portosaur component overrides (swizzle targets).
    getThemePath() {
      return options.themeDir || path.resolve(__dirname, "../../theme");
    },
  };
}
