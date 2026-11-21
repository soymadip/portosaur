/**
 * Developer playground: scaffolds a portfolio site at `.playground/`
 * wired to this checkout's packages, then runs a command against it.
 *
 * The scaffold's `@portosaur/*` dependencies point at this checkout via
 * a workspace declaration, so edits to the packages take effect in the
 * playground on the next build — no publishing, no symlink dance.
 *
 * Usage:
 *   bun src/playground.mjs [dev|build|serve] [--prune] [--dir <name>] [args...]
 *
 * Root scripts wrap the common cases:
 *   bun run playground        scaffold (or refresh) .playground/
 *   bun run build             scaffold + build it
 *   bun run dev               scaffold + start the dev server
 *
 * Extra arguments are passed through to the porto command, e.g.
 * `bun run dev -- --port 4000`.
 */

import {
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PORTO_BIN = path.join(REPO_ROOT, "packages/cli/bin/porto.ts");

const DEFAULT_SITE = ".playground";

const colors = {
  info: (str) => `\x1b[34m${str}\x1b[0m`,
  success: (str) => `\x1b[32m${str}\x1b[0m`,
  warn: (str) => `\x1b[33m${str}\x1b[0m`,
  command: (str) => `\x1b[36m\x1b[1m${str}\x1b[0m`,
};

/** Run a shell command, echoing it first. Throws on failure. */
function run(cmd, { cwd = REPO_ROOT, quiet = false } = {}) {
  if (!quiet) {
    console.log(`\n${colors.command("$ " + cmd)}`);
  }

  try {
    execSync(cmd, { stdio: quiet ? "pipe" : "inherit", cwd });
  } catch (error) {
    if (quiet) {
      if (error.stdout) {
        process.stdout.write(error.stdout);
      }
      if (error.stderr) {
        process.stderr.write(error.stderr);
      }
    }
    throw error;
  }
}

/**
 * Scaffold the site if it does not exist yet, then wire its
 * `@portosaur/*` dependencies at this checkout and install.
 * Safe to run on an existing site: only the Portosaur dependency
 * pointers are rewritten, and `bun install` is idempotent.
 */
function prepareSite(siteDir, siteName, isExisting) {
  if (!isExisting) {
    console.log(colors.info("\n>>> Initializing new project..."));
    run(
      `bun run "${PORTO_BIN}" init --project-name "${siteName}" --vcs-provider none --no-install`,
    );
  } else {
    console.log(
      colors.warn(`\n>>> ${siteName} already exists, refreshing it...`),
    );
  }

  console.log(colors.info("\n>>> Pointing Portosaur deps at this checkout..."));

  const pkgJsonPath = path.join(siteDir, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  // The scaffold names the project after its directory (".playground"),
  // which is not a valid package name — strip the leading dots.
  pkgJson.name = siteName.replace(/^\.+/, "");

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
  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  console.log(colors.info("\n>>> Installing dependencies..."));
  run("bun install", { cwd: siteDir, quiet: isExisting });
}

/**
 * Line range of the top-level `vars:` block in a porto.yml: from the
 * `vars:` line up to (excluding) the next top-level key or column-0
 * comment, with trailing blank lines trimmed. Returns null when the
 * file has no top-level `vars:` block.
 */
function varsBlockRange(lines) {
  const start = lines.findIndex((line) => line === "vars:");
  if (start === -1) {
    return null;
  }
  let end = start + 1;
  while (end < lines.length && !/^[a-zA-Z#]/.test(lines[end])) {
    end++;
  }
  while (end > start + 1 && lines[end - 1].trim() === "") {
    end--;
  }
  return { start, end };
}

/**
 * Merge the docs site's `vars:` block into a playground config: docs keys
 * win, playground-only top-level keys are kept with their sub-trees.
 * Returns null when either file has no top-level `vars:` block.
 */
function mergeVarsBlocks(docsConfig, playgroundConfig) {
  const docsLines = docsConfig.split("\n");
  const pgLines = playgroundConfig.split("\n");
  const docsRange = varsBlockRange(docsLines);
  const pgRange = varsBlockRange(pgLines);
  if (!docsRange || !pgRange) {
    return null;
  }

  const docsBody = docsLines.slice(docsRange.start + 1, docsRange.end);
  const docsKeys = new Set(
    docsBody
      .map((line) => line.match(/^  ([A-Za-z0-9_-]+):/)?.[1])
      .filter((key) => key !== undefined),
  );

  // Playground-only chunks: each starts at a 2-space key line and runs
  // until the next one.
  const pgBody = pgLines.slice(pgRange.start + 1, pgRange.end);
  const kept = [];
  let current = null;
  let keepCurrent = false;
  const flush = () => {
    if (keepCurrent && current) {
      kept.push(...current);
    }
    current = null;
  };
  for (const line of pgBody) {
    const keyMatch = line.match(/^  ([A-Za-z0-9_-]+):/);
    if (keyMatch) {
      flush();
      current = [line];
      keepCurrent = !docsKeys.has(keyMatch[1]);
    } else if (current) {
      current.push(line);
    }
  }
  flush();

  // Trim trailing blank lines from the docs body so the kept keys follow
  // after exactly one blank line.
  while (docsBody.length > 0 && docsBody[docsBody.length - 1].trim() === "") {
    docsBody.pop();
  }

  return [
    ...pgLines.slice(0, pgRange.start),
    "vars:",
    ...docsBody,
    ...(kept.length > 0 ? ["", ...kept] : []),
    ...pgLines.slice(pgRange.end),
  ].join("\n");
}

/**
 * Sync the real docs content into the playground's notes, and the docs
 * site's `vars:` block into the playground config (the docs pages
 * reference `{vars.*}` keys that only exist in the docs config, and
 * remarkVars throws on unknown keys). Runs on every invocation, so an
 * existing playground picks up docs changes too. Copy, not symlink —
 * the playground is a standalone smoke site.
 */
function syncDocsContent(siteDir) {
  console.log(colors.info("\n>>> Syncing docs content into notes..."));

  const docsDir = path.join(REPO_ROOT, "docs", "docs");
  const notesDir = path.join(siteDir, "notes");
  if (existsSync(notesDir)) {
    rmSync(notesDir, { recursive: true, force: true });
  }
  cpSync(docsDir, notesDir, { recursive: true });

  const docsConfigPath = path.join(REPO_ROOT, "docs", "porto.yml");
  const pgConfigPath = path.join(siteDir, "porto.yml");
  const mergedConfig = mergeVarsBlocks(
    readFileSync(docsConfigPath, "utf8"),
    readFileSync(pgConfigPath, "utf8"),
  );
  if (mergedConfig === null) {
    console.log(colors.warn(">>> No vars block found to sync, skipping..."));
  } else {
    writeFileSync(pgConfigPath, mergedConfig);
  }
}

export function runPlayground({
  siteName = DEFAULT_SITE,
  runCommand = null,
  prune = false,
  extraArgs = [],
} = {}) {
  const SITE_DIR = path.join(REPO_ROOT, siteName);

  console.log(colors.info("\n>>> Generating config schema..."));
  run("bun run schema", { quiet: true });

  if (prune && existsSync(SITE_DIR)) {
    console.log(colors.warn(`>>> Pruning old ${siteName}...`));
    rmSync(SITE_DIR, { recursive: true, force: true });
  }

  // A directory can exist without being an initialized site (e.g. an
  // empty dir left behind by a deleted or interrupted scaffold). Only
  // skip initialization when the site actually looks initialized.
  // Otherwise clear the broken directory and initialize fresh.
  const dirExists = existsSync(SITE_DIR);
  const isInitialized =
    dirExists &&
    existsSync(path.join(SITE_DIR, "package.json")) &&
    existsSync(path.join(SITE_DIR, "porto.yml"));

  if (dirExists && !isInitialized) {
    console.log(
      colors.warn(
        `\n>>> ${siteName} exists but is not initialized, re-initializing...`,
      ),
    );
    rmSync(SITE_DIR, { recursive: true, force: true });
  }

  prepareSite(SITE_DIR, siteName, isInitialized);
  syncDocsContent(SITE_DIR);

  const extraArgsStr = extraArgs.length > 0 ? " " + extraArgs.join(" ") : "";

  if (runCommand === "dev" || runCommand === "serve") {
    console.log(
      colors.info(`\n>>> Starting ${runCommand} server in ${siteName}...`),
    );

    // Bind to all interfaces unless the caller passed a host — the
    // dev server is usually reached from another device (a phone).
    const hasHostArg = extraArgs.some(
      (arg) => arg === "--host" || arg === "-h" || arg.startsWith("--host="),
    );
    const hostArg = hasHostArg ? "" : " --host 0.0.0.0";

    run(`bun run ${runCommand}${hostArg}${extraArgsStr}`, { cwd: SITE_DIR });
  } else if (runCommand === "build") {
    console.log(colors.info(`\n>>> Building ${siteName}...`));
    run(`bun run build${extraArgsStr}`, { cwd: SITE_DIR });
  } else {
    console.log(
      colors.success(
        `\n>>> Playground ready at ${siteName} — run "bun run build" or "bun run dev" to use it.`,
      ),
    );
  }
}

//
// Run directly: bun src/playground.mjs [dev|build|serve] [--prune] [--dir <name>] [args...]
//
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let siteName = DEFAULT_SITE;
  let runCommand = null;
  let prune = false;
  let extraArgs = [];

  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "dev" || args[i] === "serve" || args[i] === "build") {
      runCommand = args[i];
    } else if (args[i] === "-p" || args[i] === "--prune") {
      prune = true;
    } else if (args[i] === "-d" || args[i] === "--dir") {
      siteName = args[++i];
    } else {
      extraArgs.push(args[i]);
    }
  }

  runPlayground({ siteName, runCommand, prune, extraArgs });
}
