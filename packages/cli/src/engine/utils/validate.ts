import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ------- Schema Loading -------

let _cachedSchema: Record<string, any> | null = null;

/**
 * Loads and caches the generated config-schema.json from the package root.
 * The schema is generated before builds and shipped with @portosaur/cli.
 *
 * @returns {object} The parsed JSON Schema object.
 */
function loadSchema(): Record<string, any> {
  if (_cachedSchema) {
    return _cachedSchema;
  }

  const schemaPath = path.resolve(
    fileURLToPath(new URL("../../..", import.meta.url)),
    "config-schema.json",
  );

  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `Config schema not found at ${schemaPath}. Run \`porto schema\` to regenerate it.`,
    );
  }

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  _cachedSchema = schema;
  return schema;
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
function walk(
  configNode: any,
  schemaNode: any,
  prefix: string,
  violations: string[],
): void {
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
export function validateUserConfig(
  rawConfig: Record<string, any> | null | undefined,
): string[] {
  if (!rawConfig || typeof rawConfig !== "object") {
    return [];
  }

  const schema = loadSchema();
  const violations: string[] = [];

  walk(rawConfig, schema, "", violations);

  return violations;
}
