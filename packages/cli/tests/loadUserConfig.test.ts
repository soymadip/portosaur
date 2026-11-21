import { test, expect, describe, afterAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadUserConfig,
  resolveConfigFile,
} from "../src/engine/utils/loadUserConfig.ts";

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-config-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function captureConsoleInfo(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    restore() {
      console.info = original;
    },
  };
}

describe("loadUserConfig", () => {
  test("loads porto.yml", () => {
    const dir = makeProject({
      "porto.yml": "site:\n  title: Porto\n",
    });
    const config = loadUserConfig(dir);
    expect(config.site.title).toBe("Porto");
  });

  test("loads porto.yaml", () => {
    const dir = makeProject({
      "porto.yaml": "site:\n  title: Porto Yaml\n",
    });
    const config = loadUserConfig(dir);
    expect(config.site.title).toBe("Porto Yaml");
  });

  test("falls back to config.yml with a deprecation warning", () => {
    const dir = makeProject({
      "config.yml": "site:\n  title: Legacy\n",
    });
    const capture = captureConsoleInfo();
    try {
      const config = loadUserConfig(dir);
      expect(config.site.title).toBe("Legacy");
    } finally {
      capture.restore();
    }
    const warnings = capture.lines.filter((line) =>
      line.includes("config.yml is deprecated"),
    );
    expect(warnings.length).toBe(1);
  });

  test("falls back to config.yaml without warning twice", () => {
    const dir = makeProject({
      "config.yaml": "site:\n  title: Legacy Yaml\n",
    });
    const capture = captureConsoleInfo();
    try {
      const config = loadUserConfig(dir);
      expect(config.site.title).toBe("Legacy Yaml");
    } finally {
      capture.restore();
    }
    const warnings = capture.lines.filter((line) =>
      line.includes("is deprecated"),
    );
    expect(warnings.length).toBe(0);
  });

  test("porto.yml wins when both names exist", () => {
    const dir = makeProject({
      "porto.yml": "site:\n  title: Porto\n",
      "config.yml": "site:\n  title: Legacy\n",
    });
    expect(resolveConfigFile(dir)).toBe("porto.yml");
    const config = loadUserConfig(dir);
    expect(config.site.title).toBe("Porto");
  });

  test("throws mentioning porto.yml when no config exists", () => {
    const dir = makeProject({});
    expect(resolveConfigFile(dir)).toBeNull();
    expect(() => loadUserConfig(dir)).toThrow("No porto.yml found");
  });
});
