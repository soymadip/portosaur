import { limits } from "../app.mjs";

/**
 * Gets a nested value from an object using a dot-notated string path.
 * Falls back to alternative paths or fallback values if not found.
 */
export function getNestedValue(obj, pathStr, ...fallbacks) {
  // ------- Traverse nested path ----------
  const parts = pathStr.split(".");
  let current = obj;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      current = undefined;
      break;
    }
    current = current[part];
  }

  // Return if value found at requested path
  if (current !== undefined && current !== null) {
    return current;
  }

  // ------- Try fallback paths ----------
  if (fallbacks.length === 0) return undefined;

  const defaultVal = fallbacks[fallbacks.length - 1];
  const altPaths = fallbacks.slice(0, fallbacks.length - 1);

  for (const fallback of altPaths) {
    if (typeof fallback === "string") {
      const val = getNestedValue(obj, fallback);
      if (val !== undefined) {
        return val;
      }
    }
  }

  return defaultVal;
}

/**
 * Resolves template variables like {{key}} recursively within objects, arrays, and strings.
 * Supports environment variables ({{env.VAR}}) and escaped tags (\\{{...}}).
 */
export function resolveVars(
  obj,
  userConfig,
  systemVars = {},
  pathStack = new Set(),
  depth = 0,
) {
  // Check recursion depth limit
  if (depth > limits.maxResolveDepth) {
    return obj;
  }

  // ------- Handle String Values --------
  if (typeof obj === "string") {
    // Try exact match first (single template variable)
    const exactMatch = obj.match(/^\{\{([^}]+)\}\}$/);

    if (exactMatch) {
      const refPath = exactMatch[1];

      // Check system variables
      if (systemVars[refPath] !== undefined) {
        return systemVars[refPath];
      }

      // Check environment variables
      if (refPath.startsWith("env.")) {
        return process.env[refPath.slice(4)] ?? "";
      }

      // Resolve from user config
      const value = getNestedValue(userConfig, refPath);
      if (value !== undefined && value !== obj) {
        return resolveVars(value, userConfig, systemVars, pathStack, depth + 1);
      }
    }

    // Handle partial template variables with regex replacement
    return obj.replace(/(\\)?\{\{([^}]+)\}\}/g, (match, escape, refPath) => {
      // Handle escaped tags
      if (escape === "\\") {
        return `{{${refPath}}}`;
      }

      // Check system variables
      if (systemVars[refPath] !== undefined) {
        return String(systemVars[refPath]);
      }

      // Check environment variables
      if (refPath.startsWith("env.")) {
        return process.env[refPath.slice(4)] ?? "";
      }

      // Prevent circular references
      if (pathStack.has(refPath)) {
        return match;
      }

      // Resolve from user config
      const value = getNestedValue(userConfig, refPath);
      if (value === undefined) {
        return match;
      }

      // Handle nested resolution
      const newStack = new Set(pathStack);
      newStack.add(refPath);
      if (typeof value === "string" && value.includes("{{")) {
        return resolveVars(value, userConfig, systemVars, newStack, depth + 1);
      }

      return String(value);
    });
  }

  // ------- Handle Arrays ------------
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      resolveVars(item, userConfig, systemVars, pathStack, depth),
    );
  }

  // ------- Handle Objects ------------
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        resolveVars(value, userConfig, systemVars, pathStack, depth),
      ]),
    );
  }

  // Return primitive values as-is
  return obj;
}
