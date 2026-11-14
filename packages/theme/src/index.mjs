import path from "path";

const pkgDir = path.resolve(import.meta.dirname, "../");

export const ThemePaths = {
  root: pkgDir,
  assets: path.resolve(pkgDir, "assets"),
  theme: path.resolve(pkgDir, "theme"),
  integration: path.resolve(pkgDir, "src/integration.mjs"),
};

export { default as portosaurIntegration } from "./integration.mjs";
export { default } from "./integration.mjs";
