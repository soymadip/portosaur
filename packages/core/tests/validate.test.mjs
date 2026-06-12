import { expect, test, describe } from "bun:test";
import { validateUserConfig } from "../src/utils/validate.mjs";

describe("validateUserConfig", () => {
  test("should return empty array for completely empty config", () => {
    const violations = validateUserConfig({});
    expect(violations).toEqual([]);
  });

  test("should return empty array for valid config", () => {
    const rawConfig = {
      site: {
        title: "My Site",
        url: "https://example.com",
      },
      home_page: {
        hero: {
          title: "Hello",
        },
      },
    };
    const violations = validateUserConfig(rawConfig);
    expect(violations).toEqual([]);
  });

  test("should detect unknown top-level keys", () => {
    const rawConfig = {
      foo: 1,
      bar: "baz",
    };
    const violations = validateUserConfig(rawConfig);
    expect(violations).toEqual(["foo", "bar"]);
  });

  test("should detect unknown nested keys", () => {
    const rawConfig = {
      site: {
        titl: "Typo", // unknown
        title: "Valid", // valid
        robots_txt: {
          enabl: true, // unknown
        },
      },
      home_page: {
        heroe: {
          // unknown
          title: "Hello",
        },
      },
    };
    const violations = validateUserConfig(rawConfig);
    expect(violations).toEqual([
      "site.titl",
      "site.robots_txt.enabl",
      "home_page.heroe",
    ]);
  });

  test("should allow any keys under freeform block 'vars'", () => {
    const rawConfig = {
      vars: {
        my_custom_var: 123,
        nested: {
          foo: "bar",
        },
      },
    };
    const violations = validateUserConfig(rawConfig);
    expect(violations).toEqual([]);
  });

  test("should allow any keys under freeform block 'tools.link_shortener.short_links'", () => {
    const rawConfig = {
      tools: {
        link_shortener: {
          enable: true, // valid schema key
          short_links: {
            // freeform block
            gh: "https://github.com",
            tw: "https://twitter.com",
          },
        },
      },
    };
    const violations = validateUserConfig(rawConfig);
    expect(violations).toEqual([]);
  });

  test("should not complain about arrays containing unknown object shapes", () => {
    // Array items are not strictly validated by shape yet.
    const rawConfig = {
      home_page: {
        about: {
          skills: [{ nam: "Typo", level: 5 }],
        },
      },
    };
    const violations = validateUserConfig(rawConfig);
    expect(violations).toEqual([]);
  });

  test("should handle null/undefined config gracefully", () => {
    expect(validateUserConfig(null)).toEqual([]);
    expect(validateUserConfig(undefined)).toEqual([]);
  });
});
