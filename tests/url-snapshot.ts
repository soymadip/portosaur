import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dumpRoutes } from "./golden-utils.ts";
import type { GoldenRoute } from "./golden-utils.ts";

/**
 * Diff already-built sites against the golden URL snapshots (§7).
 *
 * Usage:
 *   bun tests/url-snapshot.ts [docs-build-dir] [playground-build-dir]
 *
 * Defaults: docs/build and .playground/build.
 *
 * This script builds nothing itself. It dumps the routes of each given build
 * directory and compares them against tests/golden/<name>-urls.json (same
 * route shape: url + title + headings). It prints a per-route diff for any
 * mismatch (missing, extra, or changed routes) and exits 0 only when both
 * sites match their goldens exactly.
 *
 * Run it against the Docusaurus builds to verify the goldens, and against
 * the Astro builds in Phase 2 to prove URL parity.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// ------- CLI arguments -------

const [docsBuildArg = "docs/build", playgroundBuildArg = ".playground/build"] =
  process.argv.slice(2);

const SITES = [
  { name: "docs", buildDirArg: docsBuildArg },
  { name: "playground", buildDirArg: playgroundBuildArg },
];

// ------- Diffing -------

/**
 * Compare the dumped routes of one build directory against its golden.
 * Returns true when the build matches the golden exactly.
 */
function diffSite(name: string, buildDir: string): boolean {
  const goldenPath = path.join(REPO_ROOT, "tests/golden", `${name}-urls.json`);

  if (!fs.existsSync(buildDir)) {
    console.error(`[${name}] Build directory not found: ${buildDir}`);
    return false;
  }

  if (!fs.existsSync(goldenPath)) {
    console.error(`[${name}] Golden snapshot not found: ${goldenPath}`);
    return false;
  }

  const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
  const goldenRoutes = new Map<string, GoldenRoute>(
    golden.routes.map((r: GoldenRoute) => [r.url, r]),
  );
  const actualRoutes = new Map(
    dumpRoutes(buildDir).map((r) => [r.url, r]),
  );

  const missing: string[] = [];
  const extra: string[] = [];
  const changed: Array<{ url: string; golden: GoldenRoute; actual: GoldenRoute }> = [];

  for (const [url, goldenRoute] of goldenRoutes) {
    const actual = actualRoutes.get(url);
    if (!actual) {
      missing.push(url);
      continue;
    }
    if (JSON.stringify(goldenRoute) !== JSON.stringify(actual)) {
      changed.push({ url, golden: goldenRoute, actual });
    }
  }

  for (const url of actualRoutes.keys()) {
    if (!goldenRoutes.has(url)) {
      extra.push(url);
    }
  }

  console.log(
    `[${name}] ${actualRoutes.size} routes dumped, ${goldenRoutes.size} in golden`,
  );

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log(`[${name}] MATCH — no differences`);
    return true;
  }

  for (const url of missing) {
    console.log(`[${name}] MISSING route (in golden, not in build): ${url}`);
  }

  for (const url of extra) {
    console.log(`[${name}] EXTRA route (in build, not in golden): ${url}`);
  }

  for (const { url, golden: goldenRoute, actual } of changed) {
    console.log(`[${name}] CHANGED route: ${url}`);
    if (goldenRoute.title !== actual.title) {
      console.log(`  title: ${JSON.stringify(goldenRoute.title)} -> ${JSON.stringify(actual.title)}`);
    }
    if (JSON.stringify(goldenRoute.headings) !== JSON.stringify(actual.headings)) {
      console.log(`  headings: ${JSON.stringify(goldenRoute.headings)} -> ${JSON.stringify(actual.headings)}`);
    }
  }

  console.log(
    `[${name}] MISMATCH — ${missing.length} missing, ${extra.length} extra, ${changed.length} changed`,
  );
  return false;
}

// ------- Main -------

let allMatch = true;

for (const { name, buildDirArg } of SITES) {
  const buildDir = path.resolve(REPO_ROOT, buildDirArg);
  if (!diffSite(name, buildDir)) {
    allMatch = false;
  }
}

if (allMatch) {
  console.log("URL snapshots match goldens for both sites.");
  process.exit(0);
} else {
  console.error("URL snapshot mismatch — see diff above.");
  process.exit(1);
}
