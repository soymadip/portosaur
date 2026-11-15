import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { validateUserConfig } from "./validate.ts";
import { resolveVars } from "./config.ts";
import type { ResolveVarsContext } from "./config.ts";

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
 * Loads, parses, and validates the user's `config.yml` file.
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
  const configPath = path.resolve(projectDir, "config.yml");

  if (!fs.existsSync(configPath)) {
    throw new Error(`No config.yml found at ${configPath}`);
  }

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
