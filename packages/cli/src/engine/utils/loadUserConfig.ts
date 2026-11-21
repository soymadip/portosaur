import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { validateUserConfig } from "./validate.ts";
import { resolveVars } from "./config.ts";
import type { ResolveVarsContext } from "./config.ts";
import { logger } from "../../logger/index.ts";

// The CLI package's homepage, used in the unknown-key error message.
// Read with fs like engine/app.ts does — a JSON import would need
// resolveJsonModule and import attributes under Node type stripping.
const pkgHomepage: string = (() => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(
        new URL("../../../package.json", import.meta.url),
        "utf8",
      ),
    );
    return pkg.homepage ?? "";
  } catch {
    return "";
  }
})();

/**
 * Config filenames in resolution order. `porto.yml` is canonical,
 * `porto.yaml` is accepted too, and the old `config.yml` /
 * `config.yaml` names still load with a deprecation warning.
 */
const CONFIG_FILENAMES = [
  "porto.yml",
  "porto.yaml",
  "config.yml",
  "config.yaml",
];

/**
 * Finds the project's config file — the first of the known names
 * that exists in the project root. Returns the filename, or null
 * when the project has no config file at all.
 */
export function resolveConfigFile(projectDir: string): string | null {
  for (const file of CONFIG_FILENAMES) {
    if (fs.existsSync(path.join(projectDir, file))) {
      return file;
    }
  }
  return null;
}

// The deprecation warning fires once per process — a build loads the
// config several times, and the user only needs to hear it once.
let warnedDeprecatedConfig = false;

/**
 * Loads, parses, and validates the user's `porto.yml` file
 * (a `config.yml` still loads, with a deprecation warning).
 * Optionally resolves template variables (like `{{siteRoot}}` or `{{portoRoot}}`)
 * immediately if `systemVars` are provided.
 *
 * @param {string} projectDir - The absolute path to the user's project directory.
 * @param {Record<string, any>} [systemVars={}] - Optional system variables to inject for template resolution.
 * @returns {Record<string, any>} The parsed (and optionally resolved) configuration object.
 * @throws {Error} If the config file is missing or contains invalid keys.
 */
export function loadUserConfig(
  projectDir: string,
  systemVars: ResolveVarsContext = {},
): any {
  const configFile = resolveConfigFile(projectDir);

  if (!configFile) {
    throw new Error(
      `No porto.yml found at ${path.resolve(projectDir, "porto.yml")}`,
    );
  }

  if (configFile.startsWith("config.") && !warnedDeprecatedConfig) {
    warnedDeprecatedConfig = true;
    logger.warn(`${configFile} is deprecated — rename it to porto.yml`);
  }

  const configPath = path.resolve(projectDir, configFile);

  const rawConfig = load(fs.readFileSync(configPath, "utf8")) || {};

  // Validate for unknown keys and error early with a clear message.
  const violations = validateUserConfig(rawConfig);

  if (violations.length > 0) {
    const list = violations.map((v) => `  - ${v}`).join("\n");
    throw new Error(
      `unknown key(s) in config:\n${list}\n\ncheck the config reference: ${pkgHomepage}/docs/config/reference`,
    );
  }

  // Resolve template vars if system context is provided
  if (Object.keys(systemVars).length > 0) {
    return resolveVars(rawConfig, rawConfig, {
      siteRoot: projectDir,
      ...systemVars,
    });
  }

  return rawConfig;
}
