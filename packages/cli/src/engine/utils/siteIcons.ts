/**
 * Site icon generation — the CLI side. The scan lives in
 * `@portosaur/core`, which the CLI cannot import, so this spawns
 * core's `generate-site-icons.mjs` script with a JSON spec (the
 * same pattern as the favicon rendering). Runs on every
 * `writeNextRoot` and on content change in dev; the module is
 * rewritten only when the icon set changed.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { PortosaurOptions } from "../generators/siteConfig.ts";

/** The logger surface the icon scan needs (warnings only). */
export interface SiteIconsLogger {
  warn?: (message: string) => void;
}

export interface GenerateSiteIconsParams {
  projectDir: string;
  options: PortosaurOptions;
  /** The generated `.portosaur/` root the module is written into. */
  nextRoot: string;
  coreRoot: string;
  logger: SiteIconsLogger;
}

interface SiteIconsSpec {
  projectDir: string;
  contentDirs: string[];
  configFile?: string;
  coreRoot: string;
  outFile: string;
}

interface SiteIconsResult {
  count: number;
  bytes: number;
  changed: boolean;
  warnings: string[];
}

export type { SiteIconsResult };

/** Runs the core icon scan script with a JSON spec, under the same
 * runtime as the CLI itself (`process.execPath` — node or bun). */
async function runSiteIconsScript(
  spec: SiteIconsSpec,
  coreRoot: string,
): Promise<SiteIconsResult> {
  const scriptPath = path.join(coreRoot, "scripts", "generate-site-icons.mjs");
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Icon scan script not found in @portosaur/core at ${scriptPath} — is the project's @portosaur/core install intact? Run bun install (or npm install) in your project and try again.`,
    );
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-icons-"));
  const specPath = path.join(tmpDir, "spec.json");
  fs.writeFileSync(specPath, JSON.stringify(spec));
  try {
    return await new Promise<SiteIconsResult>((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, specPath], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Icon scan failed (exit ${code}): ${stderr.trim()}`),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout) as SiteIconsResult);
        } catch {
          reject(
            new Error(`Icon scan returned unreadable output: ${stdout.trim()}`),
          );
        }
      });
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function generateSiteIcons({
  projectDir,
  options,
  nextRoot,
  coreRoot,
  logger,
}: GenerateSiteIconsParams): Promise<SiteIconsResult> {
  const configFile = ["config.yaml", "config.yml"]
    .map((file) => path.join(projectDir, file))
    .find((file) => fs.existsSync(file));
  const result = await runSiteIconsScript(
    {
      projectDir,
      contentDirs: [
        path.join(projectDir, options.site.notesDir),
        path.join(projectDir, options.site.blogDir),
      ],
      ...(configFile ? { configFile } : {}),
      coreRoot,
      outFile: path.join(nextRoot, "site-icons.ts"),
    },
    coreRoot,
  );
  for (const warning of result.warnings) {
    logger.warn?.(warning);
  }
  return result;
}
