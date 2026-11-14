import { expect, test, describe } from "bun:test";
import { buildSidebar, buildSidebarHome } from "../src/utils/sidebar.ts";
import {
  findBreadcrumbs,
  findPrevNext,
  findCategoryItems,
  contentTitleHeading,
  docPageTitles,
} from "../src/utils/content.ts";

/**
 * Sidebar tree-walker tests: breadcrumbs (with the section crumb
 * prepended from the mode/route, since the tree carries no root
 * category), prev/next pagination (with the collection home link
 * prepended), and topic-list category lookup (with the home href
 * returning the top-level items).
 */

function entry(
  id: string,
  slug: string,
  data: Record<string, any> = {},
) {
  return { id, slug, data };
}

const entries = [
  entry("index", "", { title: "Portosaur Docs" }),
  entry("guide/index", "guide", { title: "Guide" }),
  entry("guide/setup", "guide/setup", { title: "Setup" }),
  entry("guide/advanced", "guide/advanced", { title: "Advanced" }),
  entry("intro", "intro", { title: "Intro" }),
];
const options = { routeBase: "/docs", sectionLabel: "Docs" };
const tree = buildSidebar(entries, options);
const home = buildSidebarHome(entries, options);
const section = { title: "Docs", href: "/docs" };

describe("findBreadcrumbs", () => {
  test("prepends the section crumb to the tree path", () => {
    expect(findBreadcrumbs(tree, "/docs/guide/setup", section)).toEqual([
      { title: "Docs", href: "/docs" },
      { title: "Guide", href: "/docs/guide" },
      { title: "Setup", href: "/docs/guide/setup" },
    ]);
  });

  test("keeps the category crumb on a category index page", () => {
    expect(findBreadcrumbs(tree, "/docs/guide", section)).toEqual([
      { title: "Docs", href: "/docs" },
      { title: "Guide", href: "/docs/guide" },
    ]);
  });

  test("is just the section crumb on the collection home", () => {
    expect(findBreadcrumbs(tree, "/docs", section)).toEqual([
      { title: "Docs", href: "/docs" },
    ]);
  });

  test("is empty when the href is not in the tree", () => {
    expect(findBreadcrumbs(tree, "/docs/missing", section)).toEqual([]);
  });

  test("ignores trailing slashes", () => {
    expect(findBreadcrumbs(tree, "/docs/guide/setup/", section)).toEqual([
      { title: "Docs", href: "/docs" },
      { title: "Guide", href: "/docs/guide" },
      { title: "Setup", href: "/docs/guide/setup" },
    ]);
  });
});

describe("findPrevNext", () => {
  test("prepends the home link first in the order", () => {
    // On the home page: no prev, next is the first sidebar link.
    expect(findPrevNext(tree, "/docs", home)).toEqual({
      prev: null,
      next: { title: "Guide", href: "/docs/guide" },
    });
    // The first sidebar link's prev is the home page, titled with
    // the root index doc's title, not the section label.
    expect(findPrevNext(tree, "/docs/guide", home)).toEqual({
      prev: { title: "Portosaur Docs", href: "/docs" },
      next: { title: "Advanced", href: "/docs/guide/advanced" },
    });
  });

  test("walks the flattened order in the middle and at the end", () => {
    // Siblings sort alphabetically: Advanced before Setup.
    expect(findPrevNext(tree, "/docs/guide/setup", home)).toEqual({
      prev: { title: "Advanced", href: "/docs/guide/advanced" },
      next: { title: "Intro", href: "/docs/intro" },
    });
    expect(findPrevNext(tree, "/docs/intro", home)).toEqual({
      prev: { title: "Setup", href: "/docs/guide/setup" },
      next: null,
    });
  });

  test("returns nulls when the href is not in the tree", () => {
    expect(findPrevNext(tree, "/docs/missing", home)).toEqual({
      prev: null,
      next: null,
    });
  });

  test("without a home link the first item has no prev", () => {
    expect(findPrevNext(tree, "/docs/guide")).toEqual({
      prev: null,
      next: { title: "Advanced", href: "/docs/guide/advanced" },
    });
  });
});

describe("findCategoryItems", () => {
  test("returns a category's items by its link href", () => {
    const items = findCategoryItems(tree, "/docs/guide");
    expect(items.map((item) => item.label)).toEqual(["Advanced", "Setup"]);
  });

  test("returns the top-level items for the home href", () => {
    const items = findCategoryItems(tree, "/docs", "/docs");
    expect(items.map((item) => item.label)).toEqual(["Guide", "Intro"]);
  });

  test("returns an empty array for an unknown href", () => {
    expect(findCategoryItems(tree, "/docs/missing")).toEqual([]);
  });
});

function h(depth: number, text: string) {
  return { depth, slug: text.toLowerCase().replace(/ /g, "-"), text };
}

describe("contentTitleHeading", () => {
  test("returns the first heading when it is an H1", () => {
    expect(
      contentTitleHeading([h(1, "Title"), h(2, "Section")]),
    ).toEqual(h(1, "Title"));
  });

  test("returns null when the first heading is not an H1", () => {
    expect(
      contentTitleHeading([h(2, "Section"), h(1, "Later H1")]),
    ).toBeNull();
  });

  test("returns null for no headings", () => {
    expect(contentTitleHeading([])).toBeNull();
  });
});

describe("docPageTitles", () => {
  const fallback = "Variables Data Types";

  test("content H1 suppresses the synthetic heading", () => {
    const { heading, metaTitle } = docPageTitles(
      entry("1.4 - variables-data-types", "python/basics/variables", {
        title: "Variables and Data Types",
      }),
      [h(1, "Variables and Data Types"), h(2, "Numeric Types")],
      fallback,
    );
    expect(heading).toBeNull();
    expect(metaTitle).toBe("Variables and Data Types");
  });

  test("content H1 becomes the metadata title without frontmatter", () => {
    const { heading, metaTitle } = docPageTitles(
      entry("1.4 - variables-data-types", "python/basics/variables"),
      [h(1, "Variables and Data Types")],
      fallback,
    );
    expect(heading).toBeNull();
    expect(metaTitle).toBe("Variables and Data Types");
  });

  test("no H1 renders the frontmatter title as the heading", () => {
    const { heading, metaTitle } = docPageTitles(
      entry("intro", "intro", { title: "Intro" }),
      [h(2, "Section")],
      fallback,
    );
    expect(heading).toBe("Intro");
    expect(metaTitle).toBe("Intro");
  });

  test("no H1 and no frontmatter title falls back to the file base", () => {
    const { heading, metaTitle } = docPageTitles(
      entry("1.4 - variables-data-types", "python/basics/variables"),
      [h(2, "Section")],
      fallback,
    );
    expect(heading).toBe(fallback);
    expect(metaTitle).toBe(fallback);
  });

  test("hide_title suppresses the synthetic heading", () => {
    const { heading, metaTitle } = docPageTitles(
      entry("intro", "intro", { title: "Intro", hide_title: true }),
      [h(2, "Section")],
      fallback,
    );
    expect(heading).toBeNull();
    expect(metaTitle).toBe("Intro");
  });

  test("hide_title does not remove a content H1", () => {
    const { heading, metaTitle } = docPageTitles(
      entry("intro", "intro", { hide_title: true }),
      [h(1, "Intro")],
      fallback,
    );
    expect(heading).toBeNull();
    expect(metaTitle).toBe("Intro");
  });

  test("an H1 after the first heading does not count", () => {
    const { heading } = docPageTitles(
      entry("intro", "intro", { title: "Intro" }),
      [h(2, "Section"), h(1, "Later H1")],
      fallback,
    );
    expect(heading).toBe("Intro");
  });

  test("an undefined entry falls back (notes index without a root)", () => {
    const { heading, metaTitle } = docPageTitles(undefined, [], "Docs");
    expect(heading).toBe("Docs");
    expect(metaTitle).toBe("Docs");
  });
});
