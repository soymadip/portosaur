import { expect, test, describe } from "bun:test";
import { isValidCssColor } from "../src/engine/utils/css.ts";

describe("isValidCssColor", () => {
  test("accepts hex colors", () => {
    expect(isValidCssColor("#fff")).toBe(true);
    expect(isValidCssColor("#FF0000")).toBe(true);
    expect(isValidCssColor("#ff000080")).toBe(true);
    expect(isValidCssColor("#abcd")).toBe(true);
  });

  test("rejects malformed hex colors", () => {
    expect(isValidCssColor("#ff")).toBe(false);
    expect(isValidCssColor("#gggggg")).toBe(false);
    expect(isValidCssColor("#12345")).toBe(false);
  });

  test("accepts rgb() and rgba()", () => {
    expect(isValidCssColor("rgb(255, 0, 0)")).toBe(true);
    expect(isValidCssColor("rgb(100% 0% 0%)")).toBe(true);
    expect(isValidCssColor("rgba(255, 0, 0, 0.5)")).toBe(true);
    expect(isValidCssColor("rgb(255 0 0 / 50%)")).toBe(true);
  });

  test("rejects out-of-range rgb() values", () => {
    expect(isValidCssColor("rgb(256, 0, 0)")).toBe(false);
    expect(isValidCssColor("rgb(255, 0)")).toBe(false);
    expect(isValidCssColor("rgb(255, 0, banana)")).toBe(false);
    expect(isValidCssColor("rgb(255, 0, 0, 2)")).toBe(false);
  });

  test("accepts hsl() and hsla()", () => {
    expect(isValidCssColor("hsl(120, 100%, 50%)")).toBe(true);
    expect(isValidCssColor("hsl(120 100% 50% / 0.5)")).toBe(true);
    expect(isValidCssColor("hsla(120, 100%, 50%, 1)")).toBe(true);
  });

  test("rejects malformed hsl() values", () => {
    expect(isValidCssColor("hsl(120, 100, 50%)")).toBe(false);
    expect(isValidCssColor("hsl(120, 101%, 50%)")).toBe(false);
  });

  test("accepts named colors case-insensitively", () => {
    expect(isValidCssColor("red")).toBe(true);
    expect(isValidCssColor("RebeccaPurple")).toBe(true);
  });

  test("rejects anything else", () => {
    expect(isValidCssColor("notacolor")).toBe(false);
    expect(isValidCssColor("var(--porto-color-accent)")).toBe(false);
    expect(isValidCssColor("color-mix(in srgb, red 50%, blue)")).toBe(false);
    expect(isValidCssColor("")).toBe(false);
    expect(isValidCssColor(undefined)).toBe(false);
    expect(isValidCssColor(123)).toBe(false);
    expect(isValidCssColor("  #60fc02  ")).toBe(true);
  });
});
