import { describe, expect, test } from "bun:test";
import { pageHref } from "../src/utils/icons.ts";

describe("pageHref", () => {
  test("appends a trailing slash to a bare page path", () => {
    expect(pageHref("/docs/cli-reference")).toBe("/docs/cli-reference/");
    expect(pageHref("/notes")).toBe("/notes/");
  });

  test("leaves already-slashed paths and the root alone", () => {
    expect(pageHref("/docs/cli-reference/")).toBe("/docs/cli-reference/");
    expect(pageHref("/")).toBe("/");
  });

  test("keeps a query or hash after the slash", () => {
    expect(pageHref("/docs/guide?tab=1")).toBe("/docs/guide/?tab=1");
    expect(pageHref("/docs/guide#setup")).toBe("/docs/guide/#setup");
    expect(pageHref("/#about")).toBe("/#about");
  });

  test("leaves absolute URLs and hash links alone", () => {
    expect(pageHref("https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
    expect(pageHref("//example.com/docs")).toBe("//example.com/docs");
    expect(pageHref("#setup")).toBe("#setup");
    expect(pageHref("mailto:me@example.com")).toBe("mailto:me@example.com");
  });

  test("leaves asset URLs alone", () => {
    expect(pageHref("/resume.pdf")).toBe("/resume.pdf");
    expect(pageHref("/img/logo.png")).toBe("/img/logo.png");
    expect(pageHref("/sitemap.xml")).toBe("/sitemap.xml");
  });

  test("slashes a slug with a dot that is not a file extension", () => {
    expect(pageHref("/docs/v1.2")).toBe("/docs/v1.2/");
  });

  test("leaves an empty path alone", () => {
    expect(pageHref("")).toBe("");
  });
});
