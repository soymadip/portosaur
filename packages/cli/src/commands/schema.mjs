import fs from "fs";
import path from "path";
import { logger } from "@portosaur/logger";

/**
 * Portosaur Discovery-Based Schema Generator [AI GENERATED]
 *
 * Discovers the configuration schema by parsing every `get()` / `rawGet()`
 * call in docusaurusConfig.mjs.
 *
 * Comment resolution order (first match wins per key):
 *   1. Inline comment on the same line as the key string inside the call:
 *        get("site.title", "Fallback"), // My description
 *        get(
 *          "key.one", // Description for key.one
 *          "key.two", // Description for key.two
 *          "default",
 *        )
 *   2. Inline comment on the closing line of the call:
 *        get("site.title", "Fallback"), // My description
 *   3. Block comment(s) directly preceding the call or its containing line:
 *        // My description
 *        const x = get("site.title", "Fallback")
 *
 * @items shorthand is resolved in the same priority order and applies
 * per-key when found inside the call body, or globally when outside.
 */

// ------- Helpers -------

// Matches comment content that should be silently ignored (not used as description).
// Also matches visual separators made of box-drawing or punctuation characters.
const SKIP_COMMENT = /^(TODO|FIXME|NOTE|SECTION)\b|^[-─═━=*]{3,}|^─/i;

/**
 * Parse an `@items { ... }` shorthand into a JSON Schema object definition.
 * Supports: string, boolean, number, array, string|null, enum[a|b|c].
 */
function parseItemsShorthand(shorthand) {
  const content = shorthand.replace(/^\{|\}$/g, "").trim();
  const properties = {};
  const required = [];

  const fieldRegex = /([a-zA-Z0-9_]+\??):\s*([^,}]+)/g;
  let m;

  while ((m = fieldRegex.exec(content)) !== null) {
    const rawKey = m[1].trim();
    const typeStr = m[2].trim();
    const optional = rawKey.endsWith("?");
    const key = optional ? rawKey.slice(0, -1) : rawKey;

    if (!optional) required.push(key);

    let prop;
    if (typeStr.startsWith("enum[")) {
      const values = typeStr
        .slice(5, -1)
        .split("|")
        .map((s) => s.trim());
      prop = { type: ["string", "null"], enum: [...values, null] };
    } else if (typeStr === "string|null") {
      prop = { type: ["string", "null"] };
    } else if (typeStr === "array") {
      prop = { type: ["array", "null"], items: { type: ["string", "null"] } };
    } else {
      prop = { type: [typeStr, "null"] };
    }

    properties[key] = prop;
  }

  const schema = { type: "object", properties, additionalProperties: false };
  if (required.length > 0) schema.required = required;
  return schema;
}

/**
 * Extract a description string and optional @items schema from a raw comment
 * text (everything after `//`). Returns `{ description, itemsSchema }`.
 */
function parseCommentText(raw) {
  let text = raw.trim();
  let itemsSchema = null;

  const itemsMatch = text.match(/@items\s+(\{.*?\})/);
  if (itemsMatch) {
    try {
      itemsSchema = parseItemsShorthand(itemsMatch[1]);
    } catch {
      // malformed @items — skip silently
    }
    text = text.replace(itemsMatch[0], "").trim();
  }

  const description = !text || SKIP_COMMENT.test(text) ? "" : text;
  return { description, itemsSchema };
}

/**
 * Detect whether a value token is a JS expression (variable, template
 * literal, function call) rather than a literal we can use as a default.
 */
function isJsExpression(val) {
  if (!val) return false;
  return (
    val.startsWith("`") ||
    val.includes("${") ||
    /^[a-zA-Z_$][a-zA-Z0-9_.]*\(/.test(val) ||
    /^[a-zA-Z_$][a-zA-Z0-9_.]*$/.test(val)
  );
}

/**
 * Infer a JSON Schema `type` string and `defaultValue` from the raw default
 * argument token of a `get()` call.
 */
function inferType(val) {
  let type = "string";
  let defaultValue = undefined;
  let isFreeform = false;

  if (val === "null") {
    type = "null";
    defaultValue = null;
  } else if (val === "true" || val === "false") {
    type = "boolean";
    defaultValue = val === "true";
  } else if (val !== "" && !isNaN(val)) {
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

  return { type, defaultValue, isFreeform };
}

/**
 * Merge a schema node into the nested `properties` tree rooted at
 * `propertiesRoot`, creating intermediate object nodes as needed.
 */
function applyEntry(propertiesRoot, dotPath, leafSchema) {
  const parts = dotPath.split(".");
  let current = propertiesRoot;

  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;

    if (!current[part]) {
      current[part] = isLast
        ? { ...leafSchema }
        : {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {},
          };
    } else if (!isLast && !Array.isArray(current[part].type)) {
      current[part] = {
        type: ["object", "null"],
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

// ------- Comment extraction -------

/**
 * Walk backwards from `beforeText` (everything before the `get(` token)
 * to collect a preceding block or line comment.
 * Returns `{ description, itemsSchema }` from the first comment block found.
 */
function extractPrecedingComment(beforeText) {
  const lines = beforeText.split("\n");
  const commentLines = [];
  let itemsSchema = null;

  // Start one line above the line containing `get(`
  let i = lines.length - 2;

  while (i >= 0 && commentLines.length < 5) {
    const line = lines[i].trim();

    // Stop on any blank line — a blank line separates a comment from the next statement.
    if (!line) {
      break;
    }

    // Skip bare identifier / assignment lines (e.g. `heroSection: {`, `const x =`)
    if (
      /^[a-zA-Z0-9_$]+:?\s*\{?\s*$/.test(line) ||
      /^(const|let|var|return)\s/.test(line)
    ) {
      // These aren't comments — stop walking
      break;
    }

    if (line.startsWith("//")) {
      const { description, itemsSchema: its } = parseCommentText(
        line.replace(/^\/\/\s?/, ""),
      );
      if (its && !itemsSchema) itemsSchema = its;
      if (description) commentLines.unshift(description);
      i--;
    } else if (
      line.endsWith("*/") ||
      line.startsWith("*") ||
      line.startsWith("/*")
    ) {
      const clean = line
        .replace(/\*\/$/, "")
        .replace(/^\/\*/, "")
        .replace(/^\*/, "")
        .trim();
      if (clean) {
        const { description, itemsSchema: its } = parseCommentText(clean);
        if (its && !itemsSchema) itemsSchema = its;
        if (description) commentLines.unshift(description);
      }
      i--;
    } else {
      break;
    }
  }

  return { description: commentLines.join(" ").trim(), itemsSchema };
}

/**
 * Read inline comments from the closing line of the `get()` call (everything
 * after the `)` on that line), and also from inside the call body for each
 * individual key string.
 *
 * Returns:
 *   fallback  – description/itemsSchema for all keys if no per-key comment
 *   perKey    – map of key → { description, itemsSchema }
 */
function extractInlineComments(sourceCode, startIdx, endIdx, keys) {
  // Closing-line inline comment
  let closingLine = "";
  let j = endIdx;
  while (j < sourceCode.length && sourceCode[j] !== "\n") {
    closingLine += sourceCode[j++];
  }
  const closingCommentMatch = closingLine.match(/\/\/(.*)/);
  const fallback = closingCommentMatch
    ? parseCommentText(closingCommentMatch[1])
    : { description: "", itemsSchema: null };

  // Per-key inline comments inside the call body
  const perKey = {};
  const bodyLines = sourceCode.slice(startIdx, endIdx).split("\n");

  for (const line of bodyLines) {
    const inlineMatch = line.match(/\/\/(.*)/);
    if (!inlineMatch) continue;

    const parsed = parseCommentText(inlineMatch[1]);

    for (const key of keys) {
      if (
        line.includes(`"${key}"`) ||
        line.includes(`'${key}'`) ||
        line.includes(`\`${key}\``)
      ) {
        if (!perKey[key]) perKey[key] = parsed;
      }
    }
  }

  return { fallback, perKey };
}

// ------- Argument extractor -------

/**
 * Extract the raw argument tokens from inside a `get(` or `rawGet(` call,
 * starting right after the opening parenthesis at `startIdx`.
 * Returns `{ argsRaw, endIdx }`.
 */
function extractArgs(sourceCode, startIdx) {
  let depth = 1;
  let idx = startIdx;
  let argsRaw = [];
  let currentArg = "";
  let inString = null;
  let inComment = null;
  let escaped = false;

  while (depth > 0 && idx < sourceCode.length) {
    const char = sourceCode[idx];
    const next = sourceCode[idx + 1];

    if (escaped) {
      escaped = false;
      currentArg += char;
    } else if (char === "\\") {
      escaped = true;
      currentArg += char;
    } else if (inString) {
      if (char === inString) inString = null;
      currentArg += char;
    } else if (inComment === "//") {
      if (char === "\n") inComment = null;
      // don't accumulate into arg
    } else if (inComment === "/*") {
      if (char === "*" && next === "/") {
        inComment = null;
        idx++;
      }
    } else {
      // not in any string or comment
      if (char === '"' || char === "'" || char === "`") {
        inString = char;
        currentArg += char;
      } else if (char === "/" && next === "/") {
        inComment = "//";
      } else if (char === "/" && next === "*") {
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
    }

    idx++;
  }

  if (currentArg.trim()) argsRaw.push(currentArg.trim());
  return { argsRaw, endIdx: idx };
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

  const schema = {
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

    const getStartRegex = /\b(?:get|rawGet)\s*\(/g;
    let match;

    while ((match = getStartRegex.exec(sourceCode)) !== null) {
      const callOpenIdx = match.index + match[0].length;

      // --- Extract arguments ---
      const { argsRaw, endIdx } = extractArgs(sourceCode, callOpenIdx);

      if (argsRaw.length === 0) continue;

      const defaultValueRaw = argsRaw[argsRaw.length - 1];
      const keyArgs = argsRaw.slice(0, -1);

      // Only treat plain quoted strings as key paths (skip JS expressions)
      const keys = keyArgs
        .filter((a) => /^["'][^"']+["']$/.test(a))
        .map((a) => a.slice(1, -1));

      if (keys.length === 0) continue;

      // --- Comment extraction ---
      const preceding = extractPrecedingComment(
        sourceCode.slice(0, match.index),
      );
      const { fallback, perKey } = extractInlineComments(
        sourceCode,
        callOpenIdx,
        endIdx,
        keys,
      );

      // --- Type inference ---
      const { type, defaultValue, isFreeform } = inferType(defaultValueRaw);

      // --- Build and apply per-key schemas ---
      for (const keyPath of keys) {
        // Priority: per-key inside body > preceding block > closing-line inline
        const resolved = perKey[keyPath];
        const description =
          resolved?.description ||
          preceding.description ||
          fallback.description;
        const itemsSchema =
          resolved?.itemsSchema ??
          preceding.itemsSchema ??
          fallback.itemsSchema;

        const keySchema = { type: [type, "null"] };
        if (isFreeform) keySchema.additionalProperties = true;
        if (description) keySchema.description = description;
        if (defaultValue !== undefined) keySchema.default = defaultValue;
        if (type === "array" && itemsSchema) keySchema.items = itemsSchema;

        applyEntry(schema.properties, keyPath, keySchema);
      }
    }

    const outDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schema, null, 2));
    logger.success(`Schema written to: ${OUTPUT_FILE}`);
  } catch (error) {
    logger.error(`Schema generation failed: ${error.message}`);
    process.exit(1);
  }
}
