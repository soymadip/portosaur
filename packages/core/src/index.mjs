import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { validateUserConfig } from "./utils/validate.mjs";

export { mirrorSync, loadPkg, getPortoDotDir } from "./utils/fs.mjs";

export {
  deepMerge,
  getGitDate,
  hasCommand,
  useEnabled,
  openInBrowser,
} from "./utils/system.mjs";
import pkg from "../package.json";

export * from "./app.mjs";

export { getCssVar } from "./utils/cssExtractor.mjs";

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
export { validateUserConfig } from "./utils/validate.mjs";

export function loadUserConfig(projectDir) {
  const configPath = path.resolve(projectDir, "config.yml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`No config.yml found at ${configPath}`);
  }

  const rawConfig = yaml.load(fs.readFileSync(configPath, "utf8"));

  // Validate for unknown keys and error early with a clear message.
  const violations = validateUserConfig(rawConfig);

  if (violations.length > 0) {
    const list = violations.map((v) => `  - ${v}`).join("\n");
    throw new Error(
      `Unknown key(s) in config:\n${list}\n\nCheck the config reference: ${pkg.homepage}/guide/config`,
    );
  }

  return rawConfig;
}
