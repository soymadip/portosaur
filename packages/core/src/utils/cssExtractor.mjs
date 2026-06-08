import fs from "fs";
import { logger } from "@portosaur/logger";

// Cache for CSS content and parsed variables to avoid redundant reads
const cssCache = new Map();
const varCache = new Map();

/**
 * Extracts a CSS variable's value from an array of CSS files.
 * Supports resolving nested variables (e.g., var(--other-var)).
 *
 * @param {string} varName - The CSS variable name to find (e.g., '--ifm-color-primary').
 * @param {string[]} cssFiles - Array of absolute paths to CSS files to search in.
 * @returns {string|null} The resolved CSS variable value, or null if not found.
 */
export function getCssVar(varName, cssFiles = []) {
  // Return cached value if exists
  if (varCache.has(varName)) {
    return varCache.get(varName);
  }

  for (const cssPath of cssFiles) {
    try {
      if (!fs.existsSync(cssPath)) {
        continue;
      }

      let cssContent = cssCache.get(cssPath);
      if (!cssContent) {
        cssContent = fs.readFileSync(cssPath, "utf8");
        cssCache.set(cssPath, cssContent);
      }

      // Find all occurrences of the variable (e.g., --var-name: value;)
      // Using a regex that captures everything up to a semicolon or closing brace
      const regex = new RegExp(`${varName}:\\s*([^;}]+)`, "g");
      let lastValue = null;
      let match;

      // Find all matches and keep the last one (CSS cascade logic)
      while ((match = regex.exec(cssContent)) !== null) {
        lastValue = match[1].replace(/!important/g, "").trim();
      }

      // Process nested variables: if the value is var(--something)
      if (lastValue && lastValue.includes("var(")) {
        const nestedMatch = lastValue.match(/var\((--[^)]+)\)/);
        if (nestedMatch) {
          const nestedVar = nestedMatch[1];
          try {
            const resolvedValue = getCssVar(nestedVar, cssFiles);
            if (resolvedValue) {
              varCache.set(varName, resolvedValue);
              return resolvedValue;
            }
          } catch (err) {
            logger.warn(`Failed to resolve nested variable ${nestedVar}`);
          }
        }
      }

      if (lastValue) {
        varCache.set(varName, lastValue);
        return lastValue;
      }
    } catch (err) {
      logger.warn(`Error processing CSS file ${cssPath}: ${err.message}`);
    }
  }

  return null;
}
