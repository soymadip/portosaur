import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { validateUserConfig } from "./validate.mjs";
import { resolveVars } from "./config.mjs";
import pkg from "../../package.json";

/**
 * Loads, parses, and validates the user's `config.yml` file.
 * Optionally resolves template variables (like `{{siteRoot}}` or `{{portoRoot}}`)
 * immediately if `systemVars` are provided.
 *
 * @param {string} projectDir - The absolute path to the user's project directory.
 * @param {Record<string, any>} [systemVars={}] - Optional system variables to inject for template resolution.
 * @returns {Record<string, any>} The parsed (and optionally resolved) configuration object.
 * @throws {Error} If the config file is missing or contains invalid keys.
 */
export function loadUserConfig(projectDir, systemVars = {}) {
  const configPath = path.resolve(projectDir, "config.yml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`No config.yml found at ${configPath}`);
  }

  const rawConfig = yaml.load(fs.readFileSync(configPath, "utf8")) || {};

  // Validate for unknown keys and error early with a clear message.
  const violations = validateUserConfig(rawConfig);

  if (violations.length > 0) {
    const list = violations.map((v) => `  - ${v}`).join("\n");
    throw new error(
      `unknown key(s) in config:\n${list}\n\ncheck the config reference: ${pkg.homepage}/user/config/overview`,
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
