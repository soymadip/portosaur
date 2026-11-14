import { expect, test, describe } from "bun:test";
import {
  resolveBasePath,
  resolveSiteUrl,
} from "../src/engine/utils/site.mjs";

describe("resolveBasePath", () => {
  test("resolves GitHub user Pages repositories to root", () => {
    const basePath = resolveBasePath("auto", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "soymadip/soymadip.github.io",
    });

    expect(basePath).toBe("/");
  });

  test("resolves GitHub project Pages repositories to repository path", () => {
    const basePath = resolveBasePath("auto", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "soymadip/portosaur",
    });

    expect(basePath).toBe("/portosaur/");
  });

  test("keeps explicit base paths unchanged", () => {
    const basePath = resolveBasePath("/portfolio/", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "soymadip/soymadip.github.io",
    });

    expect(basePath).toBe("/portfolio/");
  });

  test("resolves GitLab Pages URL pathname", () => {
    const basePath = resolveBasePath("auto", {
      CI_PAGES_URL: "https://soymadip.gitlab.io/portosaur",
    });

    expect(basePath).toBe("/portosaur");
  });
});

describe("resolveSiteUrl", () => {
  test("auto-resolves GitHub Pages origin from build env", () => {
    const url = resolveSiteUrl("auto", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY_OWNER: "soymadip",
      GITHUB_REPOSITORY: "soymadip/portosaur",
    });

    expect(url).toBe("https://soymadip.github.io");
  });

  test("auto-resolves GitLab Pages origin from CI_PAGES_URL", () => {
    const url = resolveSiteUrl("auto", {
      CI_PAGES_URL: "https://soymadip.gitlab.io/portosaur",
    });

    expect(url).toBe("https://soymadip.gitlab.io");
  });

  test("falls back to localhost without build env", () => {
    expect(resolveSiteUrl("auto", {})).toBe("http://localhost");
  });

  test("keeps explicit URLs unchanged", () => {
    expect(resolveSiteUrl("https://example.com", {})).toBe(
      "https://example.com",
    );
  });
});
