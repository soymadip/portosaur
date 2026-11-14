import { execSync } from "node:child_process";

/**
 * Returns true if commit.gpgsign is currently enabled in global git config.
 */
export function isGpgSignEnabled(): boolean {
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
 */
export function disableGpgSign(): boolean {
  const wasEnabled = isGpgSignEnabled();

  if (wasEnabled) {
    execSync("git config --global commit.gpgsign false");
  }

  return wasEnabled;
}

/**
 * Restores commit.gpgsign in global git config to the given state.
 * Only sets it to true — never forcibly enables it on machines where it was off.
 */
export function restoreGpgSign(wasEnabled: boolean): void {
  if (wasEnabled) {
    execSync("git config --global commit.gpgsign true");
  }
}
