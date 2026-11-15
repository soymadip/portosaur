import { execSync } from "child_process";

/**
 * Attempts to detect the VCS provider by inspecting the current git repository's remotes.
 * Matches against the domains defined in the provided registry.
 *
 * @param {Object} registry - The Portosaur registry containing vcs_providers.
 * @returns {string|null} The canonical ID of the detected provider, or null if not found.
 */
export function detectVcsProvider(registry) {
  try {
    const remotes = execSync("git remote -v", {
      stdio: "pipe",
      encoding: "utf8",
    });

    for (const [id, cfg] of Object.entries(registry.vcs_providers)) {
      if (remotes.includes(cfg.domain)) {
        return id;
      }
    }
  } catch {}

  return null;
}

/**
 * Retrieves the current git configuration (local and global) as a key-value object.
 *
 * @returns {Object} A map of git configuration keys and their values.
 */
export function getGitConfig() {
  const config = {};

  try {
    const output = execSync("git config --list", {
      stdio: "pipe",
      encoding: "utf8",
    });

    const lines = output.split("\n");

    for (const line of lines) {
      const [key, ...values] = line.split("=");
      if (key && values.length > 0) {
        config[key] = values.join("=");
      }
    }
  } catch {}

  return config;
}
