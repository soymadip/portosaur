import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Portosaur application metadata and configuration
 */
export const porto = (() => {
  try {
    const pkgPath = resolve(import.meta.dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    return {
      name: pkg.name || "Portosaur",
      version: pkg.version || "0.0.0",
      description: pkg.description || "",
      license: pkg.license || "",
      homepage: pkg.homepage || "",
      repository: pkg.repository?.url || "",
      engines: pkg.engines || {},

      // Derived/computed fields
      engineName: `${pkg.name || "Portosaur"}`,
    };
  } catch (error) {
    console.warn(
      "Failed to read Portosaur metadata from package.json:",
      error.message,
    );

    return {
      name: "Portosaur",
      version: "0.0.0",
      description: "",
      license: "",
      homepage: "",
      repository: "",
      engines: {},
      engineName: "Portosaur",
    };
  }
})();

/**
 * Git operations and formats
 */
export const git = {
  dateFormat: 'git log -1 --format=%cd --date=format:"%B %d, %Y"',
};

/**
 * Text file extensions for processing
 */
export const text = {
  extensions: new Set([
    ".js",
    ".ts",
    ".tsx",
    ".mjs",
    ".json",
    ".md",
    ".mdx",
    ".yml",
    ".yaml",
    ".css",
    ".html",
    ".txt",
  ]),
};

/**
 * System limits and constraints
 */
export const limits = {
  maxResolveDepth: 10,
};
