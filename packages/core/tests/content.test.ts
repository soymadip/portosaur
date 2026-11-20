import { describe, test, expect } from "bun:test";
import { createElement, Fragment } from "react";
import { tocToHeadings, topicListCards } from "../src/lib/content.ts";

/**
 * `tocToHeadings` converts Fumadocs TOC items to flat headings for
 * the page sidebar. Fumadocs' `TOCItemType.title` is a `ReactNode`,
 * and rehypeToc always emits it as a JSX element (a fragment
 * wrapping the heading's children) — never a bare string — so the
 * text must be extracted from the element tree.
 */

describe("tocToHeadings", () => {
  test("extracts text from JSX element titles (the rehypeToc shape)", () => {
    const headings = tocToHeadings([
      {
        title: createElement(Fragment, null, "Quick Overview"),
        url: "#quick-overview",
        depth: 2,
      },
    ]);
    expect(headings).toEqual([
      { depth: 2, slug: "quick-overview", text: "Quick Overview" },
    ]);
  });

  test("concatenates nested element children", () => {
    // A heading with an inline code span renders as a fragment of
    // mixed text + element children.
    const headings = tocToHeadings([
      {
        title: createElement(Fragment, null, [
          "Use ",
          createElement("code", null, "porto"),
          " here",
        ]),
        url: "#use-porto-here",
        depth: 2,
      },
    ]);
    expect(headings).toEqual([
      { depth: 2, slug: "use-porto-here", text: "Use porto here" },
    ]);
  });

  test("keeps plain string titles working", () => {
    const headings = tocToHeadings([
      { title: "Plain Title", url: "#plain-title", depth: 2 },
    ]);
    expect(headings).toEqual([
      { depth: 2, slug: "plain-title", text: "Plain Title" },
    ]);
  });

  test("drops H1s and items without a slug or text", () => {
    const headings = tocToHeadings([
      { title: "Title", url: "#title", depth: 1 },
      { title: "", url: "#empty", depth: 2 },
      { title: "No hash", url: "/docs/page", depth: 2 },
    ]);
    expect(headings).toEqual([]);
  });
});

describe("topicListCards", () => {
  test("maps a page to a card with its description and icon", () => {
    const cards = topicListCards([
      {
        type: "page",
        name: "Setup",
        url: "/docs/setup",
        description: "How to install.",
        icon: "md:rocket",
        color: "#f00",
      } as any,
    ]);
    expect(cards).toEqual([
      {
        title: "Setup",
        href: "/docs/setup/",
        description: "How to install.",
        icon: "md:rocket",
        color: "#f00",
      },
    ]);
  });

  test("maps a folder to a category card with its index description and child count", () => {
    const cards = topicListCards([
      {
        type: "folder",
        name: "Guides",
        index: {
          type: "page",
          name: "Guides",
          url: "/docs/guides",
          description: "Step-by-step guides.",
          icon: "md:folder",
          color: "#0f0",
        },
        children: [
          { type: "page", name: "One", url: "/docs/guides/one" },
          { type: "page", name: "Two", url: "/docs/guides/two" },
          {
            type: "folder",
            name: "Nested",
            index: { type: "page", name: "Nested", url: "/docs/guides/nested" },
            children: [],
          },
          { type: "folder", name: "No index", children: [] },
          { type: "separator", name: "---" },
        ],
      } as any,
    ]);
    expect(cards).toEqual([
      {
        title: "Guides",
        href: "/docs/guides/",
        description: "Step-by-step guides.",
        icon: "md:folder",
        color: "#0f0",
        isCategory: true,
        itemsCount: 3,
      },
    ]);
  });

  test("skips folders without an index page and separators", () => {
    const cards = topicListCards([
      { type: "folder", name: "No index", children: [] } as any,
      { type: "separator", name: "---" } as any,
    ]);
    expect(cards).toEqual([]);
  });
});
