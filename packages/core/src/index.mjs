import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export { mirrorSync, loadPkg } from "./utils/fs.mjs";

export {
  deepMerge,
  getGitDate,
  hasCommand,
  useEnabled,
  openInBrowser,
} from "./utils/system.mjs";

export * from "./app.mjs";

export { generateFavicons } from "./generators/generateFavicons.mjs";
export { generateRobotsTxt } from "./generators/generateRobots.mjs";
export { buildDocuConfig } from "./generators/docusaurusConfig.mjs";

export {
  resolveSiteUrl,
  resolveBasePath,
  createStaticAssetResolver,
  buildHeadTags,
} from "./utils/docusaurus.mjs";

export { resolveVars, getNestedValue } from "./utils/config.mjs";

export function loadUserConfig(projectDir) {
  const configPath = path.resolve(projectDir, "config.yml");
  if (!fs.existsSync(configPath)) {
    throw new Error(`No config.yml found at ${configPath}`);
  }
  return yaml.load(fs.readFileSync(configPath, "utf8"));
}
