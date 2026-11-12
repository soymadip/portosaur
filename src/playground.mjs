import {
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const colors = {
  info: (str) => `\x1b[34m${str}\x1b[0m`,
  success: (str) => `\x1b[32m${str}\x1b[0m`,
  warn: (str) => `\x1b[33m${str}\x1b[0m`,
  command: (str) => `\x1b[36m\x1b[1m${str}\x1b[0m`,
};

export function runPlayground({
  siteName = ".playground",
  runCommand = null,
  prune = false,
  extraArgs = [],
} = {}) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, "..");
  const SITE_DIR = path.join(REPO_ROOT, siteName);

  function run(cmd, { cwd = REPO_ROOT, quiet = false } = {}) {
    if (!quiet) console.log(`\n${colors.command("$ " + cmd)}`);

    try {
      execSync(cmd, { stdio: quiet ? "pipe" : "inherit", cwd });
    } catch (error) {
      if (quiet) {
        if (error.stdout) process.stdout.write(error.stdout);
        if (error.stderr) process.stderr.write(error.stderr);
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

  const isExisting = existsSync(SITE_DIR);

  if (!isExisting) {
    console.log(colors.info("\n>>> Initializing new project..."));
    run(
      `bun run "${path.join(REPO_ROOT, "packages/cli/bin/porto.mjs")}" init --project-name "${siteName}" --vcs-provider none --no-install`,
    );
  } else {
    console.log(
      colors.warn(
        `\n>>> ${siteName} already exists, skipping initialization...`,
      ),
    );
  }

  console.log(colors.info("\n>>> Preparing package.json for testing..."));

  // Strip auto-install steps so the smoke test can control dependency installation.
  const pkgJsonPath = path.join(SITE_DIR, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  if (pkgJson.dependencies) {
    for (const dep of Object.keys(pkgJson.dependencies)) {
      if (dep.startsWith("@portosaur/")) {
        pkgJson.dependencies[dep] = "*";
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

  // Install the published dependency graph, including Docusaurus and theme dependencies.
  run("bun install", { cwd: SITE_DIR, quiet: isExisting });

  // Replace only the temporary project's Portosaur packages with this checkout.
  // This avoids Bun's inconsistent workspace-link handling across supported versions.
  const packagesDir = path.join(REPO_ROOT, "packages");
  const smokePackagesDir = path.join(SITE_DIR, "node_modules", "@portosaur");
  const packages = readdirSync(packagesDir).filter((packageName) =>
    existsSync(path.join(packagesDir, packageName, "package.json")),
  );

  for (const packageName of packages) {
    const target = path.join(smokePackagesDir, packageName);
    const source = path.join(packagesDir, packageName);

    rmSync(target, { recursive: true, force: true });
    symlinkSync(source, target, "dir");
  }

  const extraArgsStr = extraArgs.length > 0 ? " " + extraArgs.join(" ") : "";

  if (runCommand === "dev") {
    console.log(colors.info(`\n>>> Starting dev server in ${siteName}...`));
    const hostArg = extraArgs.includes("--host") ? "" : " --host 0.0.0.0";
    run(`bun run dev${hostArg}${extraArgsStr}`, { cwd: SITE_DIR });
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
  let runCommand = null;
  let prune = false;
  let extraArgs = [];

  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "dev") {
      runCommand = "dev";
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
