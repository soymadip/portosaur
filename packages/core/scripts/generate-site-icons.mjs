// Thin runner for the icon scan lib — the CLI spawns this (it
// cannot import @portosaur/core).
// Usage: node generate-site-icons.mjs <spec.json>
// Prints the scan result as JSON on stdout; stderr is a failure.
import fs from "node:fs";
import { generateSiteIcons } from "../src/lib/icon-scan.ts";

const specPath = process.argv[2];
if (!specPath) {
  console.error("generate-site-icons: missing spec file argument");
  process.exit(2);
}

try {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
  const result = generateSiteIcons(spec);
  console.log(JSON.stringify(result));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`generate-site-icons: ${message}`);
  process.exit(1);
}
