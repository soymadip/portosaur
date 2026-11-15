import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { disableGpgSign, restoreGpgSign } from "../utils/gpg-sign.ts";

/**
 * Full playground scaffold + build smoke test.
 *
 * Scaffolds a portfolio project with `porto init` (non-interactive, no
 * VCS), points its `@portosaur/*` dependencies at this checkout via
 * `file:` paths, installs, and runs `porto build`. Must pass before
 * merge. The scaffolded site is removed afterwards.
 *
 * Unlike the Astro playground harness, this test does not sync the
 * docs site's content into the scaffold — it builds the scaffold's own
 * sample content only.
 */

const colors = {
  info: (str: string) => `\x1b[34m${str}\x1b[0m`,
  success: (str: string) => `\x1b[32m${str}\x1b[0m`,
  error: (str: string) => `\x1b[31m${str}\x1b[0m`,
  dim: (str: string) => `\x1b[90m${str}\x1b[0m`,
  bold: (str: string) => `\x1b[1m${str}\x1b[0m`,
  command: (str: string) => `\x1b[36m\x1b[1m${str}\x1b[0m`,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PORTO_BIN = path.join(REPO_ROOT, "packages/cli/bin/porto.ts");

const dir = ".smoke-test-site";
const siteDir = path.join(REPO_ROOT, dir);
const start = Date.now();

// Disable GPG signing for the duration of the test so cz bump
const gpgWasEnabled = disableGpgSign();

function run(cmd: string, cwd: string, quiet = false): void {
  if (!quiet) {
    console.log(`\n${colors.command(`$ ${cmd}`)}`);
  }
  execSync(cmd, { stdio: quiet ? "pipe" : "inherit", cwd });
}

try {
  console.log(
    `\n${colors.info("=================== Starting Smoke Test ===================")}\n`,
  );

  if (gpgWasEnabled) {
    console.log(colors.dim(">>> GPG signing disabled for test duration."));
  }

  console.log(colors.info("\n>>> Generating config schema..."));
  run("bun run schema", REPO_ROOT, true);

  if (fs.existsSync(siteDir)) {
    console.log(colors.dim(`>>> Pruning old ${dir}...`));
    fs.rmSync(siteDir, { recursive: true, force: true });
  }

  console.log(colors.info("\n>>> Initializing new project..."));
  run(
    `bun run "${PORTO_BIN}" init --project-name "${dir}" --vcs-provider none --no-install`,
    REPO_ROOT,
  );

  console.log(colors.info("\n>>> Preparing package.json for testing..."));

  const pkgJsonPath = path.join(siteDir, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

  // The scaffold names the project after its directory (".smoke-test-site"),
  // which is not a valid package name — strip the leading dots.
  pkgJson.name = dir.replace(/^\.+/, "");

  // Wire the site to this checkout as a workspace: the site declares
  // the checkout's packages as its workspaces and depends on them via
  // `workspace:*`. This is what makes `@portosaur/cli`'s own
  // `@portosaur/wizard: workspace:*` dependency resolve — `file:` paths
  // alone cannot satisfy it, because `workspace:*` only resolves
  // against a workspace root.
  pkgJson.workspaces = ["../packages/*"];
  if (pkgJson.dependencies) {
    for (const dep of Object.keys(pkgJson.dependencies)) {
      if (dep.startsWith("@portosaur/")) {
        pkgJson.dependencies[dep] = "workspace:*";
      }
    }
  }
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  console.log(colors.info("\n>>> Installing dependencies..."));
  run("bun install", siteDir);

  console.log(colors.info("\n>>> Building site..."));
  run(`bun run "${PORTO_BIN}" build`, siteDir);

  // The scaffold is a portfolio site: home + notes index + a sample note.
  for (const expected of [
    "index.html",
    path.join("notes", "index.html"),
    ".nojekyll",
    "_headers",
  ]) {
    const full = path.join(siteDir, "build", expected);
    if (!fs.existsSync(full)) {
      throw new Error(`Expected build output missing: build/${expected}`);
    }
  }

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

  fs.rmSync(siteDir, { recursive: true, force: true });
  console.log(`${colors.dim(">>> Clean up done.")}`);

  // Restore GPG signing to its original state (only if it was enabled before).
  restoreGpgSign(gpgWasEnabled);

  if (gpgWasEnabled) {
    console.log(`${colors.dim(">>> GPG signing re-enabled.")}\n`);
  }
}
