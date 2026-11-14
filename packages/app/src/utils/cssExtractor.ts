import fs from "node:fs";

/**
 * Extracts a CSS variable's value from an array of CSS files.
 * Supports resolving nested variables (e.g., var(--other-var)).
 *
 * @param varName - The CSS variable name to find (e.g., '--porto-color-accent').
 * @param cssFiles - Array of absolute paths to CSS files to search in.
 * @param varCache - Optional map to cache parsed variables during resolution.
 * @param cssCache - Optional map to cache CSS file content.
 * @param logger - Optional logger with a warn method (defaults to console).
 * @returns The resolved CSS variable value, or null if not found.
 */
export function getCssVar(
  varName: string,
  cssFiles: string[] = [],
  varCache: Map<string, string> = new Map(),
  cssCache: Map<string, string> = new Map(),
  logger?: { warn: (message: string) => void },
): string | null {
  const log = logger ?? console;

  // Return cached value if exists
  if (varCache.has(varName)) {
    return varCache.get(varName) ?? null;
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
      let lastValue: string | null = null;
      let match: RegExpExecArray | null;

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
            const resolvedValue = getCssVar(
              nestedVar,
              cssFiles,
              varCache,
              cssCache,
              logger,
            );
            if (resolvedValue) {
              varCache.set(varName, resolvedValue);
              return resolvedValue;
            }
          } catch (err) {
            log.warn(`Failed to resolve nested variable ${nestedVar}`);
          }
        }
      }

      if (lastValue) {
        varCache.set(varName, lastValue);
        return lastValue;
      }
    } catch (err) {
      log.warn(
        `Error processing CSS file ${cssPath}: ${(err as Error).message}`,
      );
    }
  }

  return null;
}
