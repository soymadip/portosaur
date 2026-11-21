import { execSync, spawn } from "node:child_process";
import { git } from "../app.ts";

/**
 * Gets the last modification date of a git project.
 * @param {string} siteDir - The project directory.
 * @returns {string} Formatted date string.
 */
export function getGitDate(siteDir: string): string {
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
export function hasCommand(command: string): boolean {
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
 * Opens a URL in the user's default browser.
 * @param {string} url - The URL to open.
 * @returns {boolean} True if successful.
 */
export function openInBrowser(url: string): boolean {
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
