import { rmSync, existsSync, readFileSync, writeFileSync } from "fs";
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

  // Strip auto-install steps and point Portosaur dependencies at the local workspace.
  const pkgJsonPath = path.join(SITE_DIR, "package.json");
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  if (pkgJson.dependencies) {
    pkgJson.devDependencies ||= {};
    const linkedPackages = new Set();

    const linkLocalPackage = (packageName) => {
      if (linkedPackages.has(packageName)) {
        return;
      }

      linkedPackages.add(packageName);

      const dependencyName = `@portosaur/${packageName}`;
      const packageDir = path.join(REPO_ROOT, "packages", packageName);
      const relativePackageDir = path.relative(SITE_DIR, packageDir);
      const localPackage = JSON.parse(
        readFileSync(path.join(packageDir, "package.json"), "utf8"),
      );

      pkgJson.dependencies[dependencyName] = `link:${relativePackageDir}`;

      for (const [dependency, version] of Object.entries(
        localPackage.dependencies || {},
      )) {
        if (dependency.startsWith("@portosaur/")) {
          linkLocalPackage(dependency.replace("@portosaur/", ""));
        } else {
          pkgJson.devDependencies[dependency] = version;
        }
      }
    };

    for (const dep of Object.keys(pkgJson.dependencies)) {
      if (dep.startsWith("@portosaur/")) {
        linkLocalPackage(dep.replace("@portosaur/", ""));
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

  // Install dependencies while preserving links to the local workspace packages.
  run("bun install", { cwd: SITE_DIR, quiet: isExisting });

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
