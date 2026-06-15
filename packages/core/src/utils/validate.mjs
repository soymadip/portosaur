import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ------- Schema Loading -------

let _cachedSchema = null;

/**
 * Loads and caches the generated configSchema.json from the package root.
 * The schema is committed to the repo and shipped with @portosaur/core.
 *
 * @returns {object} The parsed JSON Schema object.
 */
function loadSchema() {
  if (_cachedSchema) {
    return _cachedSchema;
  }

  const schemaPath = path.resolve(
    fileURLToPath(new URL("../..", import.meta.url)),
    "configSchema.json",
  );

  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `Config schema not found at ${schemaPath}. Run \`porto schema\` to regenerate it.`,
    );
  }

  _cachedSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  return _cachedSchema;
}

// ------- Validation Walker -------

/**
 * Recursively walks the user's raw config and collects dot-path strings for
 * any key not present in the provided JSON Schema node.
 *
 * @param {object} configNode - Current slice of the user's raw config.
 * @param {object} schemaNode - Corresponding JSON Schema node.
 * @param {string} prefix - Dot-notation prefix accumulated so far.
 * @param {string[]} violations - Accumulated list of unknown key paths.
 */
function walk(configNode, schemaNode, prefix, violations) {
  if (
    !configNode ||
    typeof configNode !== "object" ||
    Array.isArray(configNode)
  ) {
    return;
  }

  const schemaProperties = schemaNode?.properties ?? {};
  const allowsAdditional = schemaNode?.additionalProperties !== false;

  // Skip validation for freeform blocks (custom, short_links, etc.)
  if (allowsAdditional) {
    return;
  }

  for (const key of Object.keys(configNode)) {
    const dotPath = prefix ? `${prefix}.${key}` : key;

    if (!(key in schemaProperties)) {
      violations.push(dotPath);
      continue;
    }

    const childSchema = schemaProperties[key];

    const isObject = Array.isArray(childSchema?.type)
      ? childSchema.type.includes("object")
      : childSchema?.type === "object";

    // Recurse into object nodes (skip arrays — no item schema)
    if (isObject) {
      walk(configNode[key], childSchema, dotPath, violations);
    }
  }
}

// ------- Public API -------

/**
 * Validates the raw user config object against the generated JSON Schema.
 * Returns a list of dot-notation paths for any unknown keys found.
 *
 * Unknown keys inside freeform blocks (custom, tools.link_shortener.short_links)
 * are intentionally ignored — those blocks allow arbitrary content.
 *
 * @param {object} rawConfig - The parsed config.yml object.
 * @returns {string[]} Array of unknown key paths, empty if config is valid.
 */
export function validateUserConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return [];
  }

  const schema = loadSchema();
  const violations = [];

  walk(rawConfig, schema, "", violations);

  return violations;
}
