import {
  test,
  expect,
  describe,
  beforeAll,
  afterAll,
  afterEach,
  mock,
} from "bun:test";
import { initCommand } from "../src/commands/init.mjs";
import fs from "fs";
import path from "path";
import os from "os";

let capturedWizardOpts = null;
let currentWizardMock = async (opts) => {
  capturedWizardOpts = opts;
  return { confirm: true };
};

mock.module("@portosaur/wizard", () => {
  return {
    runWizard: async (opts) => currentWizardMock(opts),
    spinner: () => ({ start: () => {}, stop: () => {} }),
    intro: () => {},
    outro: () => {},
    cancel: () => {},
    isCancel: () => false,
  };
});

describe("CLI: init", () => {
  let testRoot;
  let originalExit;
  let originalCwd;

  beforeAll(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "porto-cli-test-"));
    originalExit = process.exit;
    originalCwd = process.cwd();
    process.chdir(testRoot);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    process.exit = originalExit;
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  afterEach(() => {
    process.exit = originalExit;
    capturedWizardOpts = null;
  });

  test("should initialize a new project with correct structure", async () => {
    const projectName = "fresh-project";

    process.exit = (code) => {
      if (code !== 0) throw new Error(`Exit called with code ${code}`);
    };

    currentWizardMock = async () => ({
      confirm: true,
      openBrowser: false,
      repoCreated: true,
      gitRemoteUrl: "https://github.com/octocat/fresh-project.git",
      projectName: "fresh-project",
      userName: "octocat",
      fullName: "Octo Cat",
      vcs: "github",
      hosting: "github-pages",
    });

    try {
      await initCommand({
        projectName,
        install: false,
        vcsProvider: "github",
        hosting: "github-pages",
        username: "octocat",
        name: "Octo Cat",
      });
    } finally {
      currentWizardMock = async () => ({ confirm: true });
    }

    const projectPath = path.join(testRoot, projectName);
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "config.yml"))).toBe(true);
    // Should have GitHub workflow
    expect(fs.existsSync(path.join(projectPath, ".github"))).toBe(true);
  });

  test("should prompt for missing init values (Interactive)", async () => {
    const projectName = "prompted-project";
    const projectPath = path.join(testRoot, projectName);

    currentWizardMock = async () => ({
      confirm: true,
      vcsProvider: "github",
      hostingPlatform: "github-pages",
      vcsUsername: "yourusername",
      fullName: "Prompted Person",
      projectName: "prompted-project",
      repoName: "prompted-project",
      openBrowser: false,
      repoCreated: true,
    });

    try {
      await initCommand({ install: false });
    } finally {
      currentWizardMock = async () => ({ confirm: true });
    }

    expect(fs.existsSync(projectPath)).toBe(true);
    const config = fs.readFileSync(
      path.join(projectPath, "config.yml"),
      "utf8",
    );
    expect(config).toContain('title: "Prompted Person"');
  });

  test("should fail for unknown platform options", async () => {
    let exitCode = 0;
    process.exit = (code) => {
      exitCode = code;
      throw new Error("Exit called");
    };

    try {
      await initCommand({
        projectName: "bad-project",
        install: false,
        vcsProvider: "github",
        hosting: "unknown-platform",
        username: "octocat",
        name: "Octo Cat",
      });
    } catch (e) {}

    expect(exitCode).toBe(1);
  });

  test("should default in non-interactive mode", async () => {
    const expectedName = "default-portfolio";
    const projectPath = path.join(testRoot, expectedName);

    await initCommand({
      projectName: expectedName,
      install: false,
      name: "Test User",
      username: "soymadip",
      vcsProvider: "github",
    });

    expect(fs.existsSync(projectPath)).toBe(true);
    const config = fs.readFileSync(
      path.join(projectPath, "config.yml"),
      "utf8",
    );
    expect(config).toContain('title: "Test User"');
  });

  test("should fail if directory already exists", async () => {
    const existingProject = "existing-dir";
    const projectPath = path.join(testRoot, existingProject);
    fs.mkdirSync(projectPath);

    let exitCode = 0;
    process.exit = (code) => {
      exitCode = code;
      throw new Error("Exit called");
    };

    try {
      await initCommand({
        projectName: existingProject,
        install: false,
      });
    } catch (e) {}

    expect(exitCode).toBe(1);
  });

  test("should use vcs-specific hosting default in non-interactive mode", async () => {
    const projectName = "gitlab-project";
    const projectPath = path.join(testRoot, projectName);

    await initCommand({
      projectName,
      install: false,
      vcsProvider: "gitlab",
    });

    // GitLab should have .gitlab-ci.yml
    expect(fs.existsSync(path.join(projectPath, ".gitlab-ci.yml"))).toBe(true);
  });

  test("should set hosting to none if vcs is none", async () => {
    const projectName = "local-only";
    const projectPath = path.join(testRoot, projectName);

    await initCommand({
      projectName,
      install: false,
      vcsProvider: "none",
    });

    expect(fs.existsSync(path.join(projectPath, ".github"))).toBe(false);
    expect(fs.existsSync(path.join(projectPath, ".gitlab-ci.yml"))).toBe(false);
  });

  test("should recommend ideal project name for GitHub Pages in wizard", async () => {
    currentWizardMock = async (opts) => {
      capturedWizardOpts = opts;
      // Simulate choosing GitHub and GitHub Pages
      const state = {
        vcsProvider: "github",
        hostingPlatform: "github-pages",
        vcsUsername: "tester",
      };

      // Find the repoNameChoice step
      const step = opts.steps.find((s) => s.id === "repoNameChoice");
      const options = step.options(state);

      expect(options[0].label).toBe("Use tester.github.io");
      expect(options[0].value).toBe("ideal");

      return {
        confirm: true,
        projectName: "tester.github.io",
        repoName: "tester.github.io",
        vcsProvider: "github",
        hostingPlatform: "github-pages",
        vcsUsername: "tester",
        repoCreated: true,
        openBrowser: false,
      };
    };

    await initCommand({ install: false });
  });
});
