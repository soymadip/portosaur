import { execSync, spawn } from "child_process";
import { git } from "../app.mjs";

/**
 * Performs a deep merge of two objects.
 * @param {Object} target - The target object.
 * @param {Object} source - The source object.
 * @returns {Object} The merged object.
 */
export function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Gets the last modification date of a git project.
 * @param {string} siteDir - The project directory.
 * @returns {string} Formatted date string.
 */
export function getGitDate(siteDir) {
  try {
    const result = execSync(git.dateFormat, {
      cwd: siteDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return result.trim();
  } catch {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

/**
 * Checks if a command exists in the system PATH.
 * @param {string} command - The command to check.
 * @returns {boolean} True if the command is available.
 */
export function hasCommand(command) {
  const cmd =
    process.platform === "win32" ? `where ${command}` : `which ${command}`;

  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Filters a list of items, only including those that are enabled.
 * Supports both raw values and { enable: boolean, value: any } objects.
 * @param {Array} items - The items to filter.
 * @returns {Array} The enabled values.
 */
export function useEnabled(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    if (
      item &&
      typeof item === "object" &&
      "enable" in item &&
      "value" in item
    ) {
      return item.enable === true ? [item.value] : [];
    }
    return [item];
  });
}

/**
 * Opens a URL in the user's default browser.
 * @param {string} url - The URL to open.
 * @returns {boolean} True if successful.
 */
export function openInBrowser(url) {
  try {
    if (process.platform === "darwin") {
      execSync(`open "${url}"`, { stdio: "ignore" });
    } else if (process.platform === "win32") {
      // Windows 'start' treats the first quoted arg as a title, so we pass an empty one first
      execSync(`start "" "${url}"`, { stdio: "ignore" });
    } else {
      // Linux: use spawn + detached to avoid hanging/silent failures
      const child = spawn("xdg-open", [url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }
    return true;
  } catch {
    return false;
  }
}
