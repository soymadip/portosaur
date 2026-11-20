import { expect, test, describe } from "bun:test";
import {
  docFileTitle,
  docPageDesc,
  docPageTitles,
  humanizeName,
  pageTitle,
} from "../src/lib/docPage.ts";

/**
 * Doc page title tests (ported from the Astro `docPageTitles` rules):
 * the metadata title is the frontmatter title, else the content H1,
 * else the file base. The page `<h1>` is the hoisted content H1 when
 * the content has one, else the synthetic title (unless `hide_title`
 * is set).
 */

describe("docPageTitles", () => {
  test("frontmatter title wins for metadata; hoisted H1 is the heading", () => {
    const { heading, metaTitle } = docPageTitles(
      { title: "FM Title" },
      { text: "Content H1", slug: "content-h1" },
      "File Base",
    );
    expect(metaTitle).toBe("FM Title");
    expect(heading).toEqual({ text: "Content H1", id: "content-h1" });
  });

  test("content H1 is the metadata title when no frontmatter title", () => {
    const { metaTitle } = docPageTitles(
      {},
      { text: "Content H1", slug: "content-h1" },
      "File Base",
    );
    expect(metaTitle).toBe("Content H1");
  });

  test("fallback is the metadata title when neither exists", () => {
    const { heading, metaTitle } = docPageTitles({}, null, "File Base");
    expect(metaTitle).toBe("File Base");
    expect(heading).toEqual({ text: "File Base" });
  });

  test("hide_title suppresses the synthetic heading", () => {
    const { heading, metaTitle } = docPageTitles(
      { title: "FM Title", hide_title: true },
      null,
      "File Base",
    );
    expect(metaTitle).toBe("FM Title");
    expect(heading).toBeNull();
  });

  test("hide_title does not suppress a hoisted H1", () => {
    const { heading } = docPageTitles(
      { hide_title: true },
      { text: "Content H1", slug: "content-h1" },
      "File Base",
    );
    expect(heading).toEqual({ text: "Content H1", id: "content-h1" });
  });
});

describe("docFileTitle", () => {
  test("humanizes the file base", () => {
    expect(docFileTitle("3 - config/1 - dynamic-variables.mdx")).toBe(
      "Dynamic Variables",
    );
  });

  test("an index file uses its parent directory name", () => {
    expect(docFileTitle("3 - config/README.mdx")).toBe("Config");
  });

  test("a root index falls back to the file base", () => {
    expect(docFileTitle("index.mdx")).toBe("Index");
  });
});

describe("humanizeName", () => {
  test("strips number prefixes and title-cases", () => {
    expect(humanizeName("4.1 - while-loops")).toBe("While Loops");
    expect(humanizeName("getting_started")).toBe("Getting Started");
  });
});

describe("pageTitle", () => {
  test("joins page and site titles", () => {
    expect(pageTitle("CLI Reference", "Portosaur")).toBe(
      "CLI Reference | Portosaur",
    );
  });
});

describe("docPageDesc", () => {
  test("shows the desc when the global is on and nothing is set", () => {
    expect(docPageDesc({ desc: "A summary." }, true)).toBe("A summary.");
  });

  test("hides the desc when the global is off", () => {
    expect(docPageDesc({ desc: "A summary." }, false)).toBeUndefined();
  });

  test("hide_desc hides the desc even when the global is on", () => {
    expect(
      docPageDesc({ desc: "A summary.", hide_desc: true }, true),
    ).toBeUndefined();
  });

  test("hide_desc false shows the desc even when the global is off", () => {
    expect(docPageDesc({ desc: "A summary.", hide_desc: false }, false)).toBe(
      "A summary.",
    );
  });

  test("returns undefined when the page has no desc", () => {
    expect(docPageDesc({}, true)).toBeUndefined();
    expect(docPageDesc({ hide_desc: false }, true)).toBeUndefined();
  });
});
