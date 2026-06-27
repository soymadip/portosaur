export { mirrorSync, loadPkg, getPortoDotDir } from "./utils/fs.mjs";

export {
  deepMerge,
  getGitDate,
  hasCommand,
  useEnabled,
  openInBrowser,
} from "./utils/system.mjs";

export * from "./app.mjs";

export { getCssVar } from "./utils/cssExtractor.mjs";

export { generateFavicons } from "./generators/generateFavicons.mjs";
export { generateRobotsTxt } from "./generators/generateRobots.mjs";
export { buildDocuConfig } from "./generators/docusaurusConfig.mjs";

export {
  resolveSiteUrl,
  resolveBasePath,
  createAssetValidator,
  buildHeadTags,
  cleanFrontMatterSlug,
  resolveSiteCssFiles,
} from "./utils/docusaurus.mjs";

export { resolveVars, getNestedValue } from "./utils/config.mjs";
export { validateUserConfig } from "./utils/validate.mjs";

export { loadUserConfig } from "./utils/loadUserConfig.mjs";
