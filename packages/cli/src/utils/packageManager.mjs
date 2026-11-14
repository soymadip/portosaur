/**
 * Package manager detection and CLI utility (ESM)
 */
import fs from "fs";
import path from "path";

/**
 * Returns a package manager object for the given directory.
 * Detects by lockfile, environment, or runtime.
 * @param {string} dir - The directory to check.
 * @returns {{ name: string, install: string, run: string, exec: string }} Package manager info.
 */
export function getPackageManager(dir) {
  let name = null;

  // Detect by lockfile
  if (
    fs.existsSync(path.join(dir, "bun.lock")) ||
    fs.existsSync(path.join(dir, "bun.lockb"))
  ) {
    name = "bun";
  } else if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) {
    name = "pnpm";
  } else if (fs.existsSync(path.join(dir, "yarn.lock"))) {
    name = "yarn";
  } else if (fs.existsSync(path.join(dir, "package-lock.json"))) {
    name = "npm";
  }

  // Detect by environment
  else if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.includes("bun")) name = "bun";
    else if (process.env.npm_config_user_agent.includes("pnpm")) name = "pnpm";
    else if (process.env.npm_config_user_agent.includes("yarn")) name = "yarn";
    else if (process.env.npm_config_user_agent.includes("npm")) name = "npm";
  }

  // Detect by runtime
  else if (typeof process !== "undefined" && process.versions?.bun) {
    name = "bun";
  }

  if (!name) {
    throw new Error(
      "Supported package manager (bun, pnpm, yarn, or npm) not detected.",
    );
  }

  const exec = { npm: "npx", bun: "bunx", pnpm: "pnpm dlx", yarn: "yarn dlx" }[
    name
  ];

  return { name, install: `${name} install`, run: `${name} run`, exec };
}

/**
 * Resolves the command to run Astro based on the package manager and project state.
 * @param {string} UserRoot - The project root directory.
 * @returns {{ command: string, args: string[], packageManager: string }} Astro command info.
 */
export function getAstroCommand(UserRoot) {
  const pm = getPackageManager(UserRoot);

  // Check for node_modules/.bin/astro
  const localAstro = path.join(UserRoot, "node_modules", ".bin", "astro");

  if (fs.existsSync(localAstro)) {
    const local = {
      bun: { command: "bun", args: ["astro"] },
      npm: { command: "npm", args: ["run", "astro", "--"] },
      pnpm: { command: "pnpm", args: ["astro"] },
      yarn: { command: "yarn", args: ["astro"] },
    }[pm.name];

    return { ...local, packageManager: pm.name };
  }

  // Fallback to npx/bunx if not found locally
  return { command: pm.exec, args: ["astro"], packageManager: pm.name };
}
