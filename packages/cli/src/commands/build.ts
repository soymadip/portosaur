import fs from "node:fs";
import path from "node:path";
import {
  resolvePortoPaths,
  writeNextRoot,
  logResolvedSiteLocation,
  runNext,
  validateProject,
  ensureContentDirs,
} from "../utils/index.ts";
import { logger } from "../logger/index.ts";

export interface BuildCommandOptions {
  outDir?: string;
  minify?: boolean;
}

/**
 * Builds the static Portosaur site.
 *
 * Thin launcher: validate → write the Next.js root → run `next build`.
 * With `output: 'export'` and the generated `distDir`, the static export
 * lands in the resolved output dir. The CLI then copies the app
 * package's default static files into the output (without overwriting
 * — Next already copied the project's own `static/` via `public/`, so
 * user files win), and writes `.nojekyll` (GitHub Pages) and `_headers`
 * (immutable caching for fingerprinted `/_next/static/*` assets,
 * honored by Netlify) into the output dir.
 */

/**
 * Recursively copies a directory. With `overwrite: false`, files
 * already in the destination win (used for the core package's default
 * static files, so a user's own file of the same name takes
 * precedence). Ported from the Astro integration's `build:done` step.
 */
function copyDirRecursive(src: string, dest: string, overwrite: boolean): void {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to, overwrite);
    } else if (overwrite || !fs.existsSync(to)) {
      fs.copyFileSync(from, to);
    }
  }
}
export async function buildCommand(
  siteDir?: string,
  options: BuildCommandOptions = {},
): Promise<void> {
  const UserRoot = siteDir
    ? path.resolve(process.cwd(), siteDir)
    : process.cwd();

  // ------- Setup -------

  validateProject(UserRoot);
  ensureContentDirs(UserRoot);

  // Next.js has no --no-minify flag (its minifier is not optional) —
  // the flag is accepted for CLI compatibility and ignored, with a
  // warning.
  if (options.minify === false) {
    logger.warn("--no-minify is ignored: Next.js always minifies output.");
  }

  /*
   * ====================== Path Resolution ======================
   */

  const portoPaths = resolvePortoPaths(UserRoot);

  try {
    const { nextRoot, outDir } = await writeNextRoot(
      UserRoot,
      portoPaths,
      {},
      false,
      {
        outDir: options.outDir,
      },
    );

    logResolvedSiteLocation(UserRoot, portoPaths);

    // ------- Next Build -------

    logger.info("Building static site...");

    await runNext("build", UserRoot, nextRoot, [], portoPaths);

    // ------- Post Build -------

    // Remove Next's duplicate 404 artifacts. With `output: 'export'`
    // + `trailingSlash`, the not-found route is emitted three times
    // (byte-identical): `404.html`, `404/index.html`, and
    // `_not-found/index.html`. Only `404.html` is part of the URL
    // contract — static hosts serve it for missing pages, and
    // client-side navigation to a bad URL falls back to a hard
    // navigation that lands on it. The other two are junk URLs.
    for (const artifact of ["404", "_not-found"]) {
      fs.rmSync(path.join(outDir, artifact), {
        recursive: true,
        force: true,
      });
    }

    // Default static assets from the core package (img/icon.png,
    // img/project-blank.png, img/social-card.jpeg). Non-overwriting:
    // Next already copied the project's own static/ via public/.
    copyDirRecursive(portoPaths.static, outDir, false);

    try {
      fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
    } catch (e) {
      logger.warn(
        `Failed to create .nojekyll in build dir: ${(e as Error).message}`,
      );
    }

    try {
      fs.writeFileSync(
        path.join(outDir, "_headers"),
        "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n",
      );
    } catch (e) {
      logger.warn(
        `Failed to create _headers in build dir: ${(e as Error).message}`,
      );
    }

    logger.success("Build completed successfully!");
  } catch (error) {
    logger.error(`Build failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
