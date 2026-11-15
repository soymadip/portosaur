import { expect, test, describe } from "bun:test";
import { resolveVars } from "../src/index.mjs";

describe("resolveVars", () => {
  const mockConfig = {
    site_url: "https://example.com",
    hero_section: {
      title: "My Portfolio",
      profile_pic: "{{portoRoot}}/img/icon.png",
    },
    nested: { ref: "{{hero_section.title}}" },
  };

  const mockSystemVars = {
    portoRoot: "/absolute/porto",
    siteRoot: "/absolute/site",
  };

  test("should resolve template variables {{...}}", () => {
    const resolved = resolveVars(mockConfig, mockConfig);
    expect(resolved.nested.ref).toBe("My Portfolio");
  });

  test("should resolve system variables from systemVars", () => {
    const resolved = resolveVars(mockConfig, mockConfig, mockSystemVars);
    expect(resolved.hero_section.profile_pic).toBe(
      "/absolute/porto/img/icon.png",
    );
  });

  test("should handle chained resolutions (ref -> systemVar)", () => {
    const complexConfig = {
      ...mockConfig,
      chained: "{{hero_section.profile_pic}}",
    };
    const resolved = resolveVars(complexConfig, complexConfig, mockSystemVars);
    expect(resolved.chained).toBe("/absolute/porto/img/icon.png");
  });

  test("should handle missing variables gracefully", () => {
    const config = { ghost: "{{non_existent.path}}" };
    const resolved = resolveVars(config, config);
    expect(resolved.ghost).toBe("{{non_existent.path}}");
  });

  test("should resolve variables inside arrays", () => {
    const config = {
      site_url: "https://example.com",
      list: ["{{site_url}}", "static/path"],
    };
    const resolved = resolveVars(config, config);
    expect(resolved.list[0]).toBe("https://example.com");
    expect(resolved.list[1]).toBe("static/path");
  });

  test("should resolve multiple variables in one string", () => {
    const config = {
      site_url: "https://example.com",
      title: "My Portfolio",
      full_title: "{{title}} - {{site_url}}",
    };
    const resolved = resolveVars(config, config);
    expect(resolved.full_title).toBe("My Portfolio - https://example.com");
  });

  test("should handle non-string values (numbers, booleans, null)", () => {
    const config = { num: 123, bool: true, empty: null };
    const resolved = resolveVars(config, config);
    expect(resolved.num).toBe(123);
    expect(resolved.bool).toBe(true);
    expect(resolved.empty).toBe(null);
  });

  test("should handle deeply nested resolution", () => {
    const config = {
      site_url: "https://example.com",
      a: { b: { c: "{{site_url}}" } },
    };
    const resolved = resolveVars(config, config);
    expect(resolved.a.b.c).toBe("https://example.com");
  });

  test("should resolve environment variables ({{env.VAR}})", () => {
    // Set a test environment variable
    process.env.TEST_VAR = "secret_value";
    const config = { token: "{{env.TEST_VAR}}" };
    const resolved = resolveVars(config, config);
    expect(resolved.token).toBe("secret_value");
    delete process.env.TEST_VAR;
  });

  test("should handle escaped tags (\\{{...}})", () => {
    const config = { literal: "\\{{dont_resolve_me}}" };
    const resolved = resolveVars(config, config);
    expect(resolved.literal).toBe("{{dont_resolve_me}}");
  });

  test("should resolve systemVars nested deep inside arrays and objects", () => {
    const config = {
      complex: {
        items: [
          { icon: "{{portoRoot}}/img/1.png" },
          "{{siteRoot}}/static/2.png",
        ],
      },
    };
    const resolved = resolveVars(config, config, mockSystemVars);
    expect(resolved.complex.items[0].icon).toBe("/absolute/porto/img/1.png");
    expect(resolved.complex.items[1]).toBe("/absolute/site/static/2.png");
  });

  test("should handle mixed types in arrays with systemVars", () => {
    const config = {
      val: "site",
      list: [1, true, "{{val}}", { nested: "{{portoRoot}}/test" }, null],
    };
    const resolved = resolveVars(config, config, mockSystemVars);
    expect(resolved.list).toEqual([
      1,
      true,
      "site",
      { nested: "/absolute/porto/test" },
      null,
    ]);
  });
});
