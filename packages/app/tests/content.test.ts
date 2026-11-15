import { describe, test, expect } from "bun:test";
import { createElement, Fragment } from "react";
import { tocToHeadings } from "../src/lib/content.ts";

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
