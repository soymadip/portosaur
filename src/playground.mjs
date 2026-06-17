import {
  rmSync,
  existsSync,
  readdirSync,
  readFileSync,
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
} = {}) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const REPO_ROOT = path.resolve(__dirname, "..");
  const SITE_DIR = path.join(REPO_ROOT, siteName);

  function run(cmd, cwd = REPO_ROOT) {
    console.log(`\n${colors.command("$ " + cmd)}`);
    execSync(cmd, { stdio: "inherit", cwd });
  }

  console.log(colors.info(">>> Generating config schema..."));

  run("bun run schema");

  if (prune && existsSync(SITE_DIR)) {
    console.log(colors.warn(`>>> Pruning old ${siteName}...`));
    rmSync(SITE_DIR, { recursive: true, force: true });
  }

  if (!existsSync(SITE_DIR)) {
    console.log(colors.info(">>> Linking local packages..."));

    const packagesDir = path.join(REPO_ROOT, "packages");
    const packages = readdirSync(packagesDir).filter(
      (f) =>
        !f.startsWith(".") &&
        existsSync(path.join(packagesDir, f, "package.json")),
    );

    for (const pkg of packages) {
      run("bun link", path.join(REPO_ROOT, "packages", pkg));
    }

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

  console.log(colors.info(">>> Preparing package.json for testing..."));

  // Strip the auto-install steps so future commands like 'bun run build' don't wipe out the symlinks
  // Also force local portosaur packages to "*" so bun install pulls from npm registry
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

  console.log(colors.info(">>> Installing local packages..."));

  // Run a real install to fetch transitive dependencies from npm
  run("bun install", SITE_DIR);

  // Overwrite the top-level generic packages with our local symlinks
  const packagesDir = path.join(REPO_ROOT, "packages");
  const packages = readdirSync(packagesDir).filter(
    (f) =>
      !f.startsWith(".") &&
      existsSync(path.join(packagesDir, f, "package.json")),
  );

  const linkCmd = `bun link ${packages.map((p) => `@portosaur/${p}`).join(" ")}`;
  run(linkCmd, SITE_DIR);

  if (runCommand === "dev") {
    console.log(colors.info(`\n>>> Starting dev server in ${siteName}...`));
    run("bun run dev", SITE_DIR);
  } else if (runCommand === "build") {
    console.log(colors.info(`\n>>> Building ${siteName}...`));
    run("bun run build", SITE_DIR);
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
    }
  }

  runPlayground({ siteName, runCommand, prune });
}
