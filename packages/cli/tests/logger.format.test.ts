import { expect, test, describe } from "bun:test";
import { getLevelPrefix } from "../src/logger/lib/helpers.ts";

const stripAnsi = (s: string) => (s || "").replace(/\x1b\[[0-9;]*m/g, "");

describe("logger formatting", () => {
  test("info prefix is a single space (Next.js info: renders indented)", () => {
    expect(stripAnsi(getLevelPrefix("info"))).toBe(" ");
  });

  test("success prefix is a green check (Next.js event)", () => {
    expect(stripAnsi(getLevelPrefix("success"))).toBe("✓");
  });

  test("warn prefix is a warning sign, with no [WARN] tag", () => {
    expect(stripAnsi(getLevelPrefix("warn"))).toBe("⚠");
  });

  test("error prefix is a cross, with no [ERROR] tag", () => {
    expect(stripAnsi(getLevelPrefix("error"))).toBe("⨯");
  });

  test("debug prefix is a chevron (Next.js trace)", () => {
    expect(stripAnsi(getLevelPrefix("debug"))).toBe("»");
  });

  test("unknown levels fall back to the info prefix", () => {
    expect(stripAnsi(getLevelPrefix("tip"))).toBe(" ");
    expect(stripAnsi(getLevelPrefix("bogus"))).toBe(" ");
  });

  test("no prefix carries a timestamp or a package label", () => {
    for (const level of ["info", "success", "warn", "error", "debug"]) {
      const raw = stripAnsi(getLevelPrefix(level));
      expect(raw).not.toMatch(/\d{2}:\d{2}:\d{2}/);
      expect(raw).not.toContain("@portosaur");
      expect(raw).not.toContain("[");
    }
  });
});
