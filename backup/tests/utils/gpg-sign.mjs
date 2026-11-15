import { execSync } from "node:child_process";

/**
 * Returns true if commit.gpgsign is currently enabled in global git config.
 *
 * @returns {boolean}
 */
export function isGpgSignEnabled() {
  try {
    const val = execSync("git config --global commit.gpgsign", {
      stdio: "pipe",
    })
      .toString()
      .trim();

    return val === "true";
  } catch {
    // Key not set — treat as disabled.
    return false;
  }
}

/**
 * Disables commit.gpgsign in global git config.
 * Returns whether it was enabled before (so callers can restore it).
 *
 * @returns {boolean} previousState
 */
export function disableGpgSign() {
  const wasEnabled = isGpgSignEnabled();

  if (wasEnabled) {
    execSync("git config --global commit.gpgsign false");
  }

  return wasEnabled;
}

/**
 * Restores commit.gpgsign in global git config to the given state.
 * Only sets it to true — never forcibly enables it on machines where it was off.
 *
 * @param {boolean} wasEnabled - Value returned by disableGpgSign()
 */
export function restoreGpgSign(wasEnabled) {
  if (wasEnabled) {
    execSync("git config --global commit.gpgsign true");
  }
}
