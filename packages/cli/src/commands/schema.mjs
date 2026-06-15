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
    val.match(/^[a-zA-Z_$][a-zA-Z0-9_.]*\(/) ||
    /^[a-zA-Z_$][a-zA-Z0-9_.]*$/.test(val) // bare identifier
  );
}

function parseItemsShorthand(shorthand) {
  const content = shorthand.replace(/^\{|\}$/g, "").trim();
  const properties = {};
  const required = [];

  const regex = /([a-zA-Z0-9_]+\??):\s*([^,}]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1].trim();
    const typeStr = match[2].trim();

    const isOptional = key.endsWith("?");
    const cleanKey = isOptional ? key.slice(0, -1) : key;

    if (!isOptional) required.push(cleanKey);

    let propSchema = {};
    if (typeStr.startsWith("enum[")) {
      propSchema.type = "string";
      propSchema.enum = typeStr
        .slice(5, -1)
        .split("|")
        .map((s) => s.trim());
    } else if (typeStr === "string|null") {
      propSchema.type = ["string", "null"];
    } else if (typeStr === "array") {
      propSchema.type = "array";
      propSchema.items = { type: "string" };
    } else {
      propSchema.type = typeStr;
    }

    properties[cleanKey] = propSchema;
  }

  const result = { type: "object", properties, additionalProperties: false };
  if (required.length > 0) result.required = required;
  return result;
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
      let i = lines.length - 2;
      const commentLines = [];
      let itemsSchema = null;

      while (i >= 0 && commentLines.length < 5) {
        const line = lines[i].trim();
        if (!line || /^[a-zA-Z0-9_]+:?$/.test(line)) {
          i--;
          continue;
        }
        if (line.startsWith("//")) {
          const content = line.replace(/^\/\/\s?/, "").trim();
          if (content.startsWith("@items ")) {
            try {
              itemsSchema = parseItemsShorthand(content.substring(7));
            } catch (e) {
              logger.warn(`Failed to parse @items schema for ${keys[0]}`);
            }
          } else if (!content.match(/^(TODO|FIXME|NOTE|SECTION|---)/i)) {
            commentLines.unshift(content);
          }
          i--;
        } else if (
          line.endsWith("*/") ||
          line.startsWith("*") ||
          line.startsWith("/*")
        ) {
          let clean = line
            .replace(/\*\/$/, "")
            .replace(/^\/\*/, "")
            .replace(/^\*/, "")
            .trim();
          if (clean) commentLines.unshift(clean);
          i--;
        } else {
          break;
        }
      }
      description = commentLines.join(" ").trim();

      // Extract inline comment after the get() call
      let inlineComment = "";
      let j = currentIdx;
      while (j < sourceCode.length && sourceCode[j] !== "\n") {
        inlineComment += sourceCode[j];
        j++;
      }

      const commentMatch = inlineComment.match(/\/\/(.*)/);
      if (commentMatch) {
        const content = commentMatch[1].trim();
        if (content.startsWith("@items ")) {
          try {
            itemsSchema = parseItemsShorthand(content.substring(7));
          } catch (e) {
            logger.warn(`Failed to parse inline @items schema for ${keys[0]}`);
          }
        } else if (
          !description &&
          !content.match(/^(TODO|FIXME|NOTE|SECTION|---)/i)
        ) {
          description = content;
        }
      }

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
      if (type === "array" && itemsSchema) leafSchema.items = itemsSchema;

      for (const keyPath of keys) {
        applyEntry(discoveredSchema.properties, keyPath, leafSchema);
      }
    }

    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(discoveredSchema, null, 2));
    logger.success(`Schema written to: ${OUTPUT_FILE}`);
  } catch (error) {
    logger.error(`Schema generation failed: ${error.message}`);
    process.exit(1);
  }
}
