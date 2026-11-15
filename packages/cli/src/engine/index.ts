export { mirrorSync, loadPkg, getPortoDotDir } from "./utils/fs.ts";

export {
  deepMerge,
  getGitDate,
  hasCommand,
  useEnabled,
  openInBrowser,
} from "./utils/system.ts";

export * from "./app.ts";

export { buildSiteConfig } from "./generators/siteConfig.ts";
export type {
  PortosaurOptions,
  SiteConfigContext,
  PortoPkg,
  PortoPaths,
} from "./generators/siteConfig.ts";
export {
  buildNextConfigContent,
  buildSourceConfigContent,
  buildLibSourceContent,
  buildLibConfigContent,
  buildNextRootFiles,
} from "./generators/nextRoot.ts";
export type { NextRootArgs } from "./generators/nextRoot.ts";

export { resolveSiteUrl, resolveBasePath } from "./utils/site.ts";
export { createAssetValidator } from "./utils/assets.ts";
export {
  resolveSiteIconSpec,
  findLocalIcon,
  downloadIcon,
  reshapeToCircle,
  ensurePublicUnion,
  generateFavicons,
} from "./utils/favicons.ts";
export type {
  FaviconLogger,
  GenerateFaviconsParams,
} from "./utils/favicons.ts";
export { getDefaultColorScheme, resolveSiteCssFiles } from "./utils/css.ts";

export { resolveVars, getNestedValue } from "./utils/config.ts";
export type { ResolveVarsContext } from "./utils/config.ts";
export { validateUserConfig } from "./utils/validate.ts";

export { loadUserConfig } from "./utils/loadUserConfig.ts";
