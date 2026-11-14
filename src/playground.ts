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

const colors = {
  info: (str: string) => `\x1b[34m${str}\x1b[0m`,
  success: (str: string) => `\x1b[32m${str}\x1b[0m`,
  warn: (str: string) => `\x1b[33m${str}\x1b[0m`,
  command: (str: string) => `\x1b[36m\x1b[1m${str}\x1b[0m`,
};

export interface PlaygroundOptions {
  siteName?: string;
  runCommand?: "dev" | "serve" | "build" | null;
  prune?: boolean;
  extraArgs?: string[];
}

/**
 * Line range of the top-level `vars:` block in a config.yml: from the
 * `vars:` line up to (excluding) the next top-level key or column-0
 * comment, with trailing blank lines trimmed. Returns null when the
 * file has no top-level `vars:` block.
 */
function varsBlockRange(
  lines: string[],
): { start: number; end: number } | null {
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
function mergeVarsBlocks(
  docsConfig: string,
  playgroundConfig: string,
): string | null {
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
      .filter((key): key is string => key !== undefined),
  );

  // Playground-only chunks: each starts at a 2-space key line and runs
  // until the next one.
  const pgBody = pgLines.slice(pgRange.start + 1, pgRange.end);
  const kept: string[] = [];
  let current: string[] | null = null;
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

export function runPlayground({
  siteName = ".playground",
  runCommand = null,
  prune = false,
  extraArgs = [],
}: PlaygroundOptions = {}) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, "..");
  const SITE_DIR = path.join(REPO_ROOT, siteName);

  function run(
    cmd: string,
    { cwd = REPO_ROOT, quiet = false }: { cwd?: string; quiet?: boolean } = {},
  ) {
    if (!quiet) {
      console.log(`\n${colors.command("$ " + cmd)}`);
    }

    try {
      execSync(cmd, { stdio: quiet ? "pipe" : "inherit", cwd });
    } catch (error) {
      if (quiet) {
        const execError = error as {
          stdout?: string | Buffer;
          stderr?: string | Buffer;
        };
        if (execError.stdout) {
          process.stdout.write(execError.stdout);
        }
        if (execError.stderr) {
          process.stderr.write(execError.stderr);
        }
      }
      throw error;
    }
  }

  console.log(colors.info("\n>>> Generating config schema..."));

  run("bun run schema", { quiet: true });

  if (prune && existsSync(SITE_DIR)) {
    console.log(colors.warn(`>>> Pruning old ${siteName}...`));
    rmSync(SITE_DIR, { recursive: true, force: true });
  }

  const dirExists = existsSync(SITE_DIR);

  // A directory can exist without being an initialized site (e.g. an
  // empty dir left behind by a deleted or interrupted scaffold). Only
  // skip initialization when the site actually looks initialized;
  // otherwise clear the broken directory and initialize fresh.
  const isInitialized =
    dirExists &&
    existsSync(path.join(SITE_DIR, "package.json")) &&
    existsSync(path.join(SITE_DIR, "config.yml"));

  if (dirExists && !isInitialized) {
    console.log(
      colors.warn(
        `\n>>> ${siteName} exists but is not initialized, re-initializing...`,
      ),
    );
    rmSync(SITE_DIR, { recursive: true, force: true });
  }

  const isExisting = isInitialized;

  if (!isExisting) {
    console.log(colors.info("\n>>> Initializing new project..."));
    run(
      `bun run "${path.join(REPO_ROOT, "packages/cli/bin/porto.ts")}" init --project-name "${siteName}" --vcs-provider none --no-install`,
    );
  } else {
    console.log(
      colors.warn(
        `\n>>> ${siteName} already exists, skipping initialization...`,
      ),
    );
  }

  console.log(colors.info("\n>>> Syncing docs content into notes..."));

  // The playground's notes are the real docs content, not the scaffold's
  // samples: copy docs/docs/ over <site>/notes/ on every run, so an
  // existing playground (which skips init above) picks up docs changes
  // too. Copy, not symlink — the playground is a standalone smoke site.
  const docsDir = path.join(REPO_ROOT, "docs", "docs");
  const notesDir = path.join(SITE_DIR, "notes");
  if (existsSync(notesDir)) {
    rmSync(notesDir, { recursive: true, force: true });
  }
  cpSync(docsDir, notesDir, { recursive: true });

  // The docs pages reference {vars.*} keys (project, tools, icons, ...)
  // that only exist in the docs site's config.yml — remarkVars throws on
  // unknown keys, so sync the docs site's vars block into the playground
  // config too. Playground-only vars keys are kept.
  const docsConfigPath = path.join(REPO_ROOT, "docs", "config.yml");
  const pgConfigPath = path.join(SITE_DIR, "config.yml");
  const mergedConfig = mergeVarsBlocks(
    readFileSync(docsConfigPath, "utf8"),
    readFileSync(pgConfigPath, "utf8"),
  );
  if (mergedConfig === null) {
    console.log(colors.warn(">>> No vars block found to sync, skipping..."));
  } else {
    writeFileSync(pgConfigPath, mergedConfig);
  }

  console.log(colors.info("\n>>> Preparing package.json for testing..."));

  // Strip auto-install steps so the smoke test can control dependency installation.
  const pkgJsonPath = path.join(SITE_DIR, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  // The scaffold names the project after its directory (".playground"),
  // which is not a valid package name — bun rejects workspace members
  // with leading dots. Strip them: the site is a workspace member (the
  // root `.*` glob), so it must have a valid name.
  pkgJson.name = siteName.replace(/^\.+/, "");

  // Point the Portosaur deps at this checkout via the workspace. The old
  // install-from-registry-then-symlink dance broke with the Astro
  // migration: the published 0.26.0 tree (Docusaurus) and the local tree
  // (Astro) install conflicting versions of shared transitive deps
  // (e.g. `cookie`), and the stale registry copy shadowed the correct
  // one. Workspace links install the local packages' own dep trees.
  if (pkgJson.dependencies) {
    for (const dep of Object.keys(pkgJson.dependencies)) {
      if (dep.startsWith("@portosaur/")) {
        pkgJson.dependencies[dep] = "workspace:*";
      }
    }
  }

  if (pkgJson.scripts) {
    for (const key in pkgJson.scripts) {
      pkgJson.scripts[key] = pkgJson.scripts[key].replace(
        "$npm_execpath install && ",
        "",
      );
    }
  }
  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  console.log(colors.info("\n>>> Installing local packages..."));

  // The site is a workspace member, so this installs the whole workspace
  // (linked local packages + their real dep trees) with the hoisted
  // linker the docs build already requires.
  run("bun install --linker=hoisted", { cwd: SITE_DIR, quiet: isExisting });

  const extraArgsStr = extraArgs.length > 0 ? " " + extraArgs.join(" ") : "";

  if (runCommand === "dev" || runCommand === "serve") {
    console.log(
      colors.info(`\n>>> Starting ${runCommand} server in ${siteName}...`),
    );

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
        `\n>>> Playground successfully initialized at ${siteName}!`,
      ),
    );
  }
}

//
// Check if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let siteName = ".playground";
  let runCommand: "dev" | "serve" | "build" | null = null;
  let prune = false;
  let extraArgs: string[] = [];

  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "dev") {
      runCommand = "dev";
    } else if (args[i] === "serve") {
      runCommand = "serve";
    } else if (args[i] === "build") {
      runCommand = "build";
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
