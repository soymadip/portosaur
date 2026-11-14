import { expect, test, describe } from "bun:test";
import { getEventPrefix, LABEL } from "../src/logger/lib/helpers.ts";

const stripAnsi = (s: string) => (s || "").replace(/\x1b\[[0-9;]*m/g, "");

describe("logger formatting", () => {
  test("info prefix is a timestamp plus the CLI label", () => {
    const raw = stripAnsi(getEventPrefix("info"));
    expect(raw).toMatch(/^\d{2}:\d{2}:\d{2} \[@portosaur\/cli\]$/);
  });

  test("success renders like info (Astro has no success level)", () => {
    const raw = stripAnsi(getEventPrefix("success"));
    expect(raw).toMatch(/^\d{2}:\d{2}:\d{2} \[@portosaur\/cli\]$/);
  });

  test("warn prefix carries a [WARN] tag", () => {
    const raw = stripAnsi(getEventPrefix("warn"));
    expect(raw).toMatch(/^\d{2}:\d{2}:\d{2} \[WARN\] \[@portosaur\/cli\]$/);
  });

  test("error prefix carries an [ERROR] tag", () => {
    const raw = stripAnsi(getEventPrefix("error"));
    expect(raw).toMatch(/^\d{2}:\d{2}:\d{2} \[ERROR\] \[@portosaur\/cli\]$/);
  });

  test("label matches the theme integration's package naming", () => {
    expect(LABEL).toBe("@portosaur/cli");
  });
});
