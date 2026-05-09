import fs from "fs";
import path from "path";

/**
 * Resolves site URL based on config or environment
 */
export function resolveSiteUrl(configValue, env = process.env) {
  if (configValue === "auto") {
    if (env.CI_PAGES_URL) return new URL(env.CI_PAGES_URL).origin;
    if (env.GITHUB_ACTIONS === "true")
      return `https://${env.GITHUB_REPOSITORY_OWNER}.github.io`;
    return "http://localhost";
  }
  return configValue;
}

/**
 * Resolves base path based on config or environment
 */
export function resolveBasePath(configValue, env = process.env) {
  if (configValue === "auto") {
    if (env.CI_PAGES_URL) return new URL(env.CI_PAGES_URL).pathname;
    if (env.GITHUB_ACTIONS === "true") {
      const repo = env.GITHUB_REPOSITORY ?? "";
      const [, name] = repo.split("/");
      return `/${name}/`;
    }
    return "/";
  }
  return configValue;
}

/**
 * Creates a function to resolve static asset paths.
 * Handles portoRoot-prefixed absolute paths by extracting the bare relative
 * subpath after any "assets/" segment, so they resolve correctly from
 * the registered staticDirectories.
 */
export function createStaticAssetResolver(_projectDir, staticDir, assetsDir) {
  return function (primaryPath, fallbackPath = "") {
    if (!primaryPath) {
      return fallbackPath;
    }
    if (/^https?:\/\//.test(primaryPath)) {
      return primaryPath;
    }

    // Strip known prefix segments that arise from {{portoRoot}}/src/assets/...
    // or {{portoRoot}}/assets/... template paths so we get a bare relative path
    // that Docusaurus can serve from its staticDirectories.
    const match = primaryPath.match(/(?:src\/)?assets\/(.+)$/);
    const normalizedPath = match ? match[1] : primaryPath;

    if (fs.existsSync(path.resolve(staticDir, normalizedPath))) {
      return normalizedPath;
    }
    if (assetsDir && fs.existsSync(path.resolve(assetsDir, normalizedPath))) {
      return normalizedPath;
    }

    // Fallback: try the original path unchanged
    if (fs.existsSync(path.resolve(staticDir, primaryPath))) {
      return primaryPath;
    }
    if (assetsDir && fs.existsSync(path.resolve(assetsDir, primaryPath))) {
      return primaryPath;
    }

    return fallbackPath || normalizedPath || primaryPath;
  };
}

/**
 * Transforms tag objects into Docusaurus head tag format
 */
export function buildHeadTags(tags = []) {
  return tags.map((tag) => {
    if (tag.tagName && tag.attributes) return tag;
    const [tagName, attributes] = Object.entries(tag)[0];
    return { tagName, attributes };
  });
}
