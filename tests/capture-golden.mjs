import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dumpRoutes } from "./golden-utils.mjs";

/**
 * Capture golden URL snapshots from a built site (§7, §10 step 1).
 *
 * Usage:
 *   bun tests/capture-golden.mjs <build-dir> <name>
 *
 * Writes tests/golden/<name>-urls.json (routes with title/headings) and
 * tests/golden/<name>-urls.txt (plain sorted URL list, for easy diffing).
 *
 * Run against the Docusaurus build of docs/ and the playground before any
 * behavior-changing code; the Astro build is diffed against these in Phase 2.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const [buildDirArg, name] = process.argv.slice(2);

if (!buildDirArg || !name) {
  console.error("Usage: bun tests/capture-golden.mjs <build-dir> <name>");
  process.exit(1);
}

const buildDir = path.resolve(REPO_ROOT, buildDirArg);
const outDir = path.join(REPO_ROOT, "tests/golden");

if (!fs.existsSync(buildDir)) {
  console.error(`Build directory not found: ${buildDir}`);
  process.exit(1);
}

const routes = dumpRoutes(buildDir);

fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, `${name}-urls.json`);
const txtPath = path.join(outDir, `${name}-urls.txt`);

fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generated_from: `Docusaurus build of ${buildDirArg}`,
      routes,
    },
    null,
    2,
  ) + "\n",
);

fs.writeFileSync(txtPath, routes.map((r) => r.url).join("\n") + "\n");

console.log(`Captured ${routes.length} routes -> ${jsonPath}`);
console.log(`URL list -> ${txtPath}`);
