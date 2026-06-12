import fs from "fs";
import path from "path";
import { logger } from "@portosaur/logger";

/**
 * Portosaur Discovery-Based Schema Generator
 *
 * Discovers the configuration schema by parsing every key accessed via the
 * `get()` and `rawGet()` helpers in docusaurusConfig.mjs.
 *
 * It parses all arguments in the call:
 * `get("key1", "key2", "default")`
 * - "key1" and "key2" are discovered as schema properties
 * - "default" is recorded as the default value
 */

// ------- Helpers -------

function applyEntry(propertiesRoot, dotPath, leafSchema) {
  const parts = dotPath.split(".");
  let current = propertiesRoot;

  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;

    if (!current[part]) {
      current[part] = isLast
        ? { ...leafSchema }
        : { type: "object", additionalProperties: false, properties: {} };
    } else if (!isLast && current[part].type !== "object") {
      current[part] = {
        type: "object",
        additionalProperties: false,
        properties: {},
      };
    }

    if (!isLast) {
      if (!current[part].properties) {
        current[part].properties = {};
      }
      current = current[part].properties;
    }
  });
}

function isJsExpression(val) {
  if (!val) return false;
  return (
    val.startsWith("`") ||
    val.includes("${") ||
    val.includes("()") ||
    /^[a-zA-Z_$][a-zA-Z0-9_.]*$/.test(val) // bare identifier
  );
}

// ------- Main -------

export async function schemaCommand(options = {}) {
  const pkgDir = path.resolve(import.meta.dirname, "../");
  const coreDir = path.resolve(pkgDir, "../../core");

  const SOURCE_FILE =
    typeof options.config === "string"
      ? path.resolve(process.cwd(), options.config)
      : path.resolve(coreDir, "src/generators/docusaurusConfig.mjs");

  const OUTPUT_FILE =
    typeof options.output === "string"
      ? path.resolve(process.cwd(), options.output)
      : path.resolve(coreDir, "configSchema.json");

  const discoveredSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Portosaur Project Configuration",
    description: "Schema for config.yml — validated at build time by porto.",
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  };

  try {
    if (!fs.existsSync(SOURCE_FILE)) {
      throw new Error(`Source file not found: ${SOURCE_FILE}`);
    }

    logger.info(`Discovering keys from: ${SOURCE_FILE}`);
    const sourceCode = fs.readFileSync(SOURCE_FILE, "utf8");

    // match the start of `get(` or `rawGet(`
    const getStartRegex = /\b(?:get|rawGet)\s*\(/g;
    let match;

    while ((match = getStartRegex.exec(sourceCode)) !== null) {
      const startIdx = match.index + match[0].length;

      let depth = 1;
      let currentIdx = startIdx;
      let argsRaw = [];
      let currentArg = "";
      let inString = null;
      let inComment = null;
      let escaped = false;

      // Extract all arguments separated by commas
      while (depth > 0 && currentIdx < sourceCode.length) {
        const char = sourceCode[currentIdx];
        const nextChar = sourceCode[currentIdx + 1];

        if (escaped) {
          escaped = false;
          currentArg += char;
        } else if (char === "\\") {
          escaped = true;
          currentArg += char;
        } else if (!inString && !inComment) {
          if (char === "'" || char === '"' || char === "`") {
            inString = char;
            currentArg += char;
          } else if (char === "/" && nextChar === "/") {
            inComment = "//";
          } else if (char === "/" && nextChar === "*") {
            inComment = "/*";
          } else if (char === "(" || char === "[" || char === "{") {
            depth++;
            currentArg += char;
          } else if (char === ")" || char === "]" || char === "}") {
            depth--;
            if (depth > 0) currentArg += char;
          } else if (char === "," && depth === 1) {
            argsRaw.push(currentArg.trim());
            currentArg = "";
          } else {
            currentArg += char;
          }
        } else if (inString) {
          if (char === inString) inString = null;
          currentArg += char;
        } else if (inComment === "//") {
          if (char === "\n") inComment = null;
        } else if (inComment === "/*") {
          if (char === "*" && nextChar === "/") {
            inComment = null;
            currentIdx++;
          }
        }
        currentIdx++;
      }

      if (currentArg.trim()) {
        argsRaw.push(currentArg.trim());
      }

      if (argsRaw.length === 0) continue;

      const defaultValueRaw = argsRaw.pop(); // Last argument is default

      // All remaining arguments that are simple strings are key paths
      const keys = [];
      for (const arg of argsRaw) {
        if (/^["'][^"']+["']$/.test(arg)) {
          keys.push(arg.slice(1, -1));
        }
      }

      if (keys.length === 0) continue;

      // Extract comment
      const beforeMatch = sourceCode.slice(0, match.index);
      const lines = beforeMatch.split("\n");

      let description = "";
      let i = lines.length - 1;
      const commentLines = [];

      while (i >= 0 && commentLines.length < 5) {
        const line = lines[i].trim();
        if (!line) break;
        if (line.startsWith("//")) {
          const content = line.replace(/^\/\/\s?/, "").trim();
          if (!content.match(/^(TODO|FIXME|NOTE|SECTION|---)/i)) {
            commentLines.unshift(content);
          }
          i--;
        } else if (line.endsWith("*/") || line.startsWith("*")) {
          break;
        } else {
          break;
        }
      }
      description = commentLines.join(" ").trim();

      // Type inference
      const val = defaultValueRaw;

      let type = "string";
      let defaultValue = undefined;
      let isFreeform = false;

      if (val === "true" || val === "false") {
        type = "boolean";
        defaultValue = val === "true";
      } else if (!isNaN(val) && val !== "") {
        type = "number";
        defaultValue = Number(val);
      } else if (
        val.startsWith("[") ||
        val.includes(".map(") ||
        val.includes(".filter(") ||
        val.includes(".slice(")
      ) {
        type = "array";
      } else if (val === "{}") {
        type = "object";
        isFreeform = true;
      } else if (val.startsWith("{")) {
        type = "object";
      } else if (val && !isJsExpression(val)) {
        defaultValue = val.replace(/^["'`](.*?)["'`]$/s, "$1").trim();
      }

      const leafSchema = { type };
      if (isFreeform) leafSchema.additionalProperties = true;
      if (description) leafSchema.description = description;
      if (defaultValue !== undefined) leafSchema.default = defaultValue;

      for (const keyPath of keys) {
        applyEntry(discoveredSchema.properties, keyPath, leafSchema);
      }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(discoveredSchema, null, 2));
    logger.success(`Schema written to: ${OUTPUT_FILE}`);
  } catch (error) {
    logger.error(`Schema generation failed: ${error.message}`);
    process.exit(1);
  }
}
