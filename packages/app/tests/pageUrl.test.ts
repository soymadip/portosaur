import { describe, expect, test } from "bun:test";
import { isSamePage, normalizePathname } from "../src/utils/pageUrl.ts";

describe("normalizePathname", () => {
  test("strips a query or hash", () => {
    expect(normalizePathname("/docs/guide?tab=1")).toBe("/docs/guide");
    expect(normalizePathname("/docs/guide#setup")).toBe("/docs/guide");
    expect(normalizePathname("/docs/guide?tab=1#setup")).toBe("/docs/guide");
  });

  test("collapses trailing slashes, keeping the root", () => {
    expect(normalizePathname("/docs/guide/")).toBe("/docs/guide");
    expect(normalizePathname("/docs/guide//")).toBe("/docs/guide");
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("")).toBe("/");
  });
});

describe("isSamePage", () => {
  test("matches the same path with or without a trailing slash", () => {
    expect(isSamePage("/docs/", "/docs/")).toBe(true);
    expect(isSamePage("/docs", "/docs/")).toBe(true);
    expect(isSamePage("/docs/", "/docs")).toBe(true);
    expect(isSamePage("/", "/")).toBe(true);
  });

  test("does not match a different page in the same section", () => {
    expect(isSamePage("/docs/", "/docs/cli-reference/")).toBe(false);
    expect(isSamePage("/blog/", "/blog/first-post/")).toBe(false);
  });

  test("ignores a query or hash on the link", () => {
    expect(isSamePage("/docs/guide?tab=1", "/docs/guide/")).toBe(true);
    expect(isSamePage("/docs/guide#setup", "/docs/guide/")).toBe(true);
    expect(isSamePage("/#about", "/")).toBe(true);
    expect(isSamePage("/#about", "/docs/")).toBe(false);
  });

  test("never matches absolute or protocol-relative URLs", () => {
    expect(isSamePage("https://example.com/docs/", "/docs/")).toBe(false);
    expect(isSamePage("//example.com/docs/", "/docs/")).toBe(false);
    expect(isSamePage("mailto:me@example.com", "/")).toBe(false);
  });
});
