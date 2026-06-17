import fs from "node:fs/promises";
import path from "node:path";
import { runPlayground } from "./playground.mjs";

const colors = {
  info: (str) => `\x1b[34m${str}\x1b[0m`,
  success: (str) => `\x1b[32m${str}\x1b[0m`,
  error: (str) => `\x1b[31m${str}\x1b[0m`,
  dim: (str) => `\x1b[90m${str}\x1b[0m`,
  bold: (str) => `\x1b[1m${str}\x1b[0m`,
};

const dir = ".smoke-test-site";
const start = Date.now();

try {
  console.log(
    `\n${colors.info("=================== Starting Smoke Test ===================")}\n`,
  );

  runPlayground({ siteName: dir, runCommand: "build", prune: true });

  console.log(
    `\n\n${colors.success("============= Smoke Test Passed ==================")}`,
  );
} catch (error) {
  console.error(
    `\n\n${colors.error("================== Smoke test failed =================")}`,
  );
  console.error(colors.error(error.message));
  process.exit(1);
} finally {
  console.log(
    `\n${colors.dim(">>> Time Took:")} ${colors.bold(((Date.now() - start) / 1000).toFixed(2) + "s")}`,
  );

  await fs.rm(path.resolve(process.cwd(), dir), {
    recursive: true,
    force: true,
  });
  console.log(`${colors.dim(">>> Clean up done.")}\n`);
}
