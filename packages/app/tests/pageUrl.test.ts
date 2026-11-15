import { describe, expect, test } from "bun:test";
import {
  isSamePage,
  normalizePathname,
  pageHref,
  stripBase,
} from "../src/lib/pageUrl.ts";

// Ported from the Astro app tests (migrate/astro
// packages/app/tests/pageUrl.test.ts + the `pageHref` block from
// icons.test.ts — the helper moved here with the port).

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

describe("stripBase", () => {
  test("returns the pathname unchanged for the root base", () => {
    expect(stripBase("/docs/guide", "/")).toBe("/docs/guide");
    expect(stripBase("/docs/guide")).toBe("/docs/guide");
  });

  test("strips a base prefix", () => {
    expect(stripBase("/porto-astro/docs/guide", "/porto-astro")).toBe(
      "/docs/guide",
    );
    expect(stripBase("/porto-astro/docs/guide", "/porto-astro/")).toBe(
      "/docs/guide",
    );
  });

  test("maps the base itself to the root", () => {
    expect(stripBase("/porto-astro", "/porto-astro")).toBe("/");
  });

  test("leaves paths outside the base alone", () => {
    expect(stripBase("/other/page", "/porto-astro")).toBe("/other/page");
    expect(stripBase("/porto-astro-other/page", "/porto-astro")).toBe(
      "/porto-astro-other/page",
    );
  });
});
