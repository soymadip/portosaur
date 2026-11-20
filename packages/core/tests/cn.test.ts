import { describe, expect, test } from "bun:test";
import { cn } from "../src/lib/cn.ts";

describe("cn", () => {
  test("joins class names with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  test("skips falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn(false, null)).toBe("");
  });

  test("supports conditional objects", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });

  test("supports arrays", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });
});
