import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

describe("Integration: Scaffold & Build", () => {
  let testRoot;
  let portoBin;

  beforeAll(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "porto-integration-"));
    portoBin = path.resolve(
      import.meta.dirname,
      "../../packages/cli/bin/porto.mjs",
    );

    // Ensure dependencies are linked (assuming bun install was run)
  });

  afterAll(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  test("should scaffold a project and build it", () => {
    const projectName = "my-test-portfolio";
    const projectPath = path.join(testRoot, projectName);

    // 1. Run init (non-interactive)
    // We skip install to save time and because we are in a test env
    execSync(
      `bun ${portoBin} init -n "Test User" -u "testuser" -p none -h none --no-install -P ${projectName}`,
      { cwd: testRoot, stdio: "inherit" },
    );

    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "config.yml"))).toBe(true);

    // 2. Run build in TEST_MODE
    // This verifies the shim is generated and the runDocusaurus call is triggered
    execSync(`bun ${portoBin} build`, {
      cwd: projectPath,
      stdio: "pipe",
      env: { ...process.env, PORTO_TEST_MODE: "true" },
    });

    const shimPath = path.join(
      projectPath,
      ".portosaur",
      "docusaurus.config.js",
    );
    expect(fs.existsSync(shimPath)).toBe(true);
  });
});
