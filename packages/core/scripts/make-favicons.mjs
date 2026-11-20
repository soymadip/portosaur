// Thin runner for the favicon lib — the CLI spawns this (it
// cannot import @portosaur/core). Usage: node make-favicons.mjs
// <spec.json>
import fs from "node:fs";
import { renderFavicons } from "../src/lib/favicon-render.ts";

const specPath = process.argv[2];
if (!specPath) {
  console.error("make-favicons: missing spec file argument");
  process.exit(2);
}

try {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
  await renderFavicons(spec);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`make-favicons: ${message}`);
  process.exit(1);
}
