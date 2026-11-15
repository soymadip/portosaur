import fs from "node:fs";
import path from "node:path";
import { Paths } from "./paths.mjs";

/**
 * Resolves a platform key from a name or ID.
 * Supports exact match, case-insensitive ID match, and case-insensitive name match.
 * @param {Object} platforms - The platforms registry object.
 * @param {string} platform - The platform name or ID to resolve.
 * @returns {string|null} The resolved platform key or null if not found.
 */
export function resolvePlatformKey(platforms, platform) {
  if (typeof platform !== "string") {
    return null;
  }

  const requested = platform.trim();

  if (!requested) {
    return null;
  }

  const requestedLower = requested.toLowerCase();

  // Resolve by direct key match (case-sensitive first)
  if (Object.prototype.hasOwnProperty.call(platforms, requested)) {
    return requested;
  }

  // Resolve by case-insensitive ID
  const idMatch = Object.keys(platforms).find(
    (key) => key.toLowerCase() === requestedLower,
  );
  if (idMatch) {
    return idMatch;
  }

  // Resolve by display name
  const nameMatch = Object.keys(platforms).find(
    (key) => platforms[key].name?.toLowerCase() === requestedLower,
  );
  if (nameMatch) return nameMatch;

  return null;
}

/**
 * Attempts to guess the VCS username from git configuration.
 * @param {string} vcsProviderId - The ID of the VCS provider (e.g., 'github').
 * @param {Record<string, string>} [gitConfig={}] - The current git configuration object.
 * @returns {string} The guessed username or an empty string.
 */
export function getPlatformUserGuess(vcsProviderId, gitConfig = {}) {
  const vcsProvider = vcsProviderId?.toLowerCase();

  const keysByProvider = {
    github: ["github.user"],
    gitlab: ["gitlab.user"],
    codeberg: ["codeberg.user", "forgejo.user"],
  };

  const hostByProvider = {
    github: "github.com",
    gitlab: "gitlab.com",
    codeberg: "codeberg.org",
    sourcehut: "git.sr.ht",
  };

  // Try explicit configuration first
  for (const key of keysByProvider[vcsProvider] || []) {
    if (gitConfig[key]) return gitConfig[key];
  }

  // Fallback to remote URL parsing
  const host = hostByProvider[vcsProvider];

  if (!host) {
    return "";
  }

  for (const [key, value] of Object.entries(gitConfig)) {
    // Only look at remote URLs
    if (!key.startsWith("remote.") || !key.endsWith(".url")) continue;
    if (typeof value !== "string" || !value.includes(host)) continue;

    const escapedHost = host.replace(/\./g, "\\.");
    const match = value.match(
      new RegExp(
        `(?:https?://|ssh://git@|git@)${escapedHost}[:/]([^/]+)(?:/|$)`,
      ),
    );

    if (match?.[1]) return match[1];
  }

  return "";
}

/**
 * Dynamically discovers all possible workflow markers (files/dirs) from all available templates.
 * @param {Object} registry - The platforms registry object.
 * @returns {string[]} An array of unique file/directory names that serve as CI markers.
 */
export function getWorkflowMarkers(registry) {
  const markers = new Set();
  const platforms = Object.values(registry.hosting_platforms || {});

  for (const platform of platforms) {
    const templates =
      typeof platform.template_dir === "string"
        ? [platform.template_dir]
        : Object.values(platform.template_dir || {});

    for (const template of templates) {
      const templatePath = path.join(Paths.workflows, template);

      if (fs.existsSync(templatePath)) {
        const contents = fs.readdirSync(templatePath);

        for (const item of contents) {
          if (item !== "." && item !== "..") {
            markers.add(item);
          }
        }
      }
    }
  }

  return Array.from(markers);
}
