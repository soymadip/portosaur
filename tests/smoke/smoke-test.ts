import fs from "node:fs/promises";
import path from "node:path";
import { runPlayground } from "../../src/playground.ts";
import { disableGpgSign, restoreGpgSign } from "../utils/gpg-sign.ts";

const colors = {
  info: (str: string) => `\x1b[34m${str}\x1b[0m`,
  success: (str: string) => `\x1b[32m${str}\x1b[0m`,
  error: (str: string) => `\x1b[31m${str}\x1b[0m`,
  dim: (str: string) => `\x1b[90m${str}\x1b[0m`,
  bold: (str: string) => `\x1b[1m${str}\x1b[0m`,
};

const dir = ".smoke-test-site";
const start = Date.now();

// Disable GPG signing for the duration of the test so cz bump
const gpgWasEnabled = disableGpgSign();

try {
  console.log(
    `\n${colors.info("=================== Starting Smoke Test ===================")}\n`,
  );

  if (gpgWasEnabled) {
    console.log(colors.dim(">>> GPG signing disabled for test duration."));
  }

  runPlayground({ siteName: dir, runCommand: "build", prune: true });

  console.log(
    `\n\n${colors.success("============= Smoke Test Passed ==================")}`,
  );
} catch (error) {
  console.error(
    `\n\n${colors.error("================== Smoke test failed =================")}`,
  );
  console.error(colors.error((error as Error).message));
  process.exit(1);
} finally {
  console.log(
    `\n${colors.dim(">>> Time Took:")} ${colors.bold(((Date.now() - start) / 1000).toFixed(2) + "s")}`,
  );

  await fs.rm(path.resolve(process.cwd(), dir), {
    recursive: true,
    force: true,
  });
  console.log(`${colors.dim(">>> Clean up done.")}`);

  // Restore GPG signing to its original state (only if it was enabled before).
  restoreGpgSign(gpgWasEnabled);

  if (gpgWasEnabled) {
    console.log(`${colors.dim(">>> GPG signing re-enabled.")}\n`);
  }
}
