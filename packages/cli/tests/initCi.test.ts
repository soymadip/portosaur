import {
  test,
  expect,
  describe,
  beforeAll,
  afterAll,
  afterEach,
  mock,
} from "bun:test";
import { initCiCommand } from "../src/commands/initCi.ts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let currentWizardMock: (opts?: any) => Promise<any> = async () => ({
  hostingPlatform: "github-pages",
  confirm: true,
});

mock.module("@portosaur/wizard", () => {
  return {
    runWizard: async (opts: any) => currentWizardMock(opts),
    spinner: () => ({ start: () => { }, stop: () => { } }),
    intro: () => { },
    outro: () => { },
  };
});

// Mock utils
const cliSrcDir = path.resolve(import.meta.dirname, "../src");
const cliPkgDir = path.resolve(import.meta.dirname, "..");

mock.module("../src/utils/index.ts", () => {
  return {
    detectVcsProvider: () => "github",
    getGitConfig: () => ({ "user.name": "Test User" }),
    resolvePlatformKey: (platforms: any, key: any) => {
      if (!key) return null;
      const trimmed = key.trim();
      const lower = trimmed.toLowerCase();
      if (platforms[trimmed]) return trimmed;
      const found = Object.keys(platforms).find(
        (k) => k.toLowerCase() === lower,
      );
      return found || null;
    },
    getPlatformUserGuess: (vcsProvider: any, gitConfig: any = {}) => {
      const provider = vcsProvider?.toLowerCase();
      const keysByProvider: Record<string, string[]> = {
        github: ["github.user"],
        gitlab: ["gitlab.user"],
        codeberg: ["codeberg.user", "forgejo.user"],
      };
      const hostByProvider: Record<string, string> = {
        github: "github.com",
        gitlab: "gitlab.com",
        codeberg: "codeberg.org",
      };

      for (const key of keysByProvider[provider] || []) {
        if (gitConfig[key]) return gitConfig[key];
      }

      const host = hostByProvider[provider];
      if (!host) return "";

      for (const [key, value] of Object.entries(gitConfig)) {
        if (!key.startsWith("remote.") || !key.endsWith(".url")) continue;
        if (typeof value !== "string" || !value.includes(host)) continue;

        const escapedHost = host.replace(/\./g, "\\.");
        const match = value.match(
          new RegExp(
            `(?:https?://|ssh://git@|git@)${escapedHost}[:/]([^/]+)(?:/|$)`,
          ),
        );

        if (match?.[1]) return match[1];
      }

      return "";
    },
    validateProject: () => true,
    printWorkflowTips: () => { },
    warnIfRepoNameMismatch: () => { },
    isInteractive: (options: any = {}) => {
      const hasConfigOptions = Object.keys(options).some((key) => {
        if (key === "install") return false;
        return options[key] !== undefined && options[key] !== null;
      });
      return !hasConfigOptions;
    },
    Paths: {
      root: cliPkgDir,
      templates: path.join(cliSrcDir, "templates"),
      registry: path.join(cliSrcDir, "templates/registry.yml"),
      workflows: path.join(cliSrcDir, "templates/workflows"),
      packageJson: path.join(cliPkgDir, "package.json"),
    },
  };
});

describe("CLI: init-ci", () => {
  let testRoot: string;
  let originalExit: typeof process.exit;
  let originalCwd: string;

  beforeAll(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "porto-ci-test-"));
    originalExit = process.exit;
    originalCwd = process.cwd();
    process.chdir(testRoot);

    // Create a fake project structure
    fs.writeFileSync(
      path.join(testRoot, "config.yml"),
      "site: { title: 'Test' }",
    );
  });

  afterAll(() => {
    process.chdir(originalCwd);
    process.exit = originalExit;
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  test("should setup CI for GitHub Pages (Interactive)", async () => {
    currentWizardMock = async () => ({
      hostingPlatform: "github-pages",
      confirm: true,
    });

    await initCiCommand({});

    expect(
      fs.existsSync(path.join(testRoot, ".github/workflows/deploy.yml")),
    ).toBe(true);
  });

  test("should setup CI for GitLab Pages (Non-Interactive)", async () => {
    await initCiCommand({ hosting: "gitlab-pages" });

    expect(fs.existsSync(path.join(testRoot, ".gitlab-ci.yml"))).toBe(true);
  });

  test("should substitute the repository name in Surge's deployment domain", async () => {
    await initCiCommand({ hosting: "surge" });

    const workflowPath = path.join(testRoot, ".github/workflows/deploy.yml");
    const workflow = fs.readFileSync(workflowPath, "utf8");

    expect(workflow).toContain(`--domain ${path.basename(testRoot)}.surge.sh`);
    expect(workflow).not.toContain("{{repo_name}}");
  });

  test("should fail for invalid hosting platform", async () => {
    let exitCode: number | string | null | undefined = 0;
    process.exit = (code) => {
      exitCode = code;
      throw new Error("Exit called");
    };

    try {
      await initCiCommand({ hosting: "invalid-platform" });
    } catch (e) { }

    expect(exitCode).toBe(1);
  });
});
