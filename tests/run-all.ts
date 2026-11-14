import { execSync } from "node:child_process";
import { disableGpgSign, restoreGpgSign } from "./utils/gpg-sign.ts";

const colors = {
  success: (str: string) => `\x1b[32m${str}\x1b[0m`,
  error: (str: string) => `\x1b[31m${str}\x1b[0m`,
  dim: (str: string) => `\x1b[90m${str}\x1b[0m`,
};

// Capture original state so we can restore it correctly afterward.
const gpgWasEnabled = disableGpgSign();

if (gpgWasEnabled) {
  console.log(colors.dim(">>> GPG signing disabled for test duration."));
}

let exitCode = 0;

try {
  execSync("bun run schema", { stdio: "inherit" });
  execSync("bun test", { stdio: "inherit" });
} catch (err) {
  exitCode = (err as { status?: number | null }).status ?? 1;
} finally {
  // Restore GPG signing to its original state (only if it was enabled before).
  restoreGpgSign(gpgWasEnabled);

  if (gpgWasEnabled) {
    console.log(colors.dim(">>> GPG signing re-enabled."));
  }
}

process.exit(exitCode);
