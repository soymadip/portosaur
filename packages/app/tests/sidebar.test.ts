import { expect, test, describe } from "bun:test";
import {
  buildSidebar,
  buildSidebarHome,
  flattenSidebar,
} from "../src/utils/sidebar.ts";
import type {
  SidebarCategoryItem,
  SidebarDocItem,
} from "../src/utils/sidebar.ts";

/**
 * Sidebar builder tests: `buildSidebar` takes plain collection
 * entries — { id, slug, data } — and returns the top-level sidebar
 * items (no root wrapper); `buildSidebarHome` returns the collection
 * home link for pagination; `flattenSidebar` flattens the tree into
 * a plain doc list for the notes sidebar.
 * Preserved semantics from the old Docusaurus generator: index-as-
 * category-link, hidden root index, frontmatter icon/color/description
 * enrichment, Docs root fallback.
 */

function entry(
  id: string,
  slug: string,
  data: Record<string, any> = {},
) {
  return { id, slug, data };
}

describe("buildSidebar", () => {
  test("turns a category index into the category link", () => {
    const items = buildSidebar(
      [
        entry("guide/index", "guide", {
          icon: "book",
          color: "red",
          description: "The guide",
        }),
        entry("guide/setup", "guide/setup"),
        entry("intro", "intro"),
      ],
      { routeBase: "/notes" },
    );

    const category = items.find(
      (item) => item.label === "Guide",
    ) as SidebarCategoryItem;
    expect(category.link).toEqual({ href: "/notes/guide" });
    // The index doc is removed from the list (it acts as the category link).
    expect(category.items.map((item) => (item as SidebarDocItem).id)).toEqual([
      "guide/setup",
    ]);
    expect(category.icon).toBe("book");
    expect(category.color).toBe("red");
    expect(category.description).toBe("The guide");
    expect(items.map((item) => item.label)).toEqual(["Guide", "Intro"]);
  });

  test("returns the top-level items with no root wrapper", () => {
    const items = buildSidebar([entry("intro", "intro")], {
      routeBase: "/notes",
    });

    // No "Docs" root category — the doc itself is the top-level item.
    expect(items).toEqual([
      { type: "doc", label: "Intro", href: "/notes/intro", id: "intro" },
    ]);
  });

  test("enriches docs with icon, color, and description from frontmatter", () => {
    const items = buildSidebar(
      [
        entry("notes/tips", "notes/tips", {
          title: "Tips",
          icon: "bulb",
          color: "yellow",
          description: "Handy tips",
        }),
      ],
      { routeBase: "/notes" },
    );

    const category = items[0] as SidebarCategoryItem;
    expect(category.label).toBe("Notes");
    expect(category.link).toBeUndefined();
    const doc = category.items[0];
    expect(doc).toMatchObject({
      type: "doc",
      label: "Tips",
      href: "/notes/notes/tips",
      id: "notes/tips",
      icon: "bulb",
      color: "yellow",
      description: "Handy tips",
    });
  });

  test("hides the root index from the sidebar list", () => {
    const items = buildSidebar(
      [entry("index", ""), entry("intro", "intro")],
      { routeBase: "/notes" },
    );

    // The root index becomes neither an item nor a category.
    expect(items.map((item) => (item as SidebarDocItem).id)).toEqual([
      "intro",
    ]);
  });

  test("labels a category from its index doc title, not the dirname", () => {
    const items = buildSidebar(
      [
        entry("3 - config/index", "config", {
          title: "Configuration Guide",
        }),
        entry("3 - config/reference", "config/reference"),
      ],
      { routeBase: "/docs" },
    );

    const category = items[0] as SidebarCategoryItem;
    expect(category.label).toBe("Configuration Guide");
    expect(category.link).toEqual({
      href: "/docs/config",
      title: "Configuration Guide",
    });
  });

  test("builds nested categories ordered by number prefix", () => {
    const [python] = buildSidebar([
      entry("python/index", "python"),
      entry("python/2 - loops/loops", "python/loops/loops"),
      entry("python/1 - basics/intro", "python/basics/intro"),
      entry("python/2 - loops/while-loops", "python/loops/while-loops"),
    ]) as SidebarCategoryItem[];

    expect(python.label).toBe("Python");
    expect(python.link).toEqual({ href: "/python" });
    // "1 - basics" sorts before "2 - loops" despite input order.
    expect(python.items.map((item) => item.label)).toEqual(["Basics", "Loops"]);
    const loops = python.items[1] as SidebarCategoryItem;
    expect(loops.link).toBeUndefined();
    expect(loops.items.map((item) => item.label)).toEqual([
      "Loops",
      "While Loops",
    ]);
    expect((loops.items[1] as SidebarDocItem).href).toBe(
      "/python/loops/while-loops",
    );
  });
});

describe("buildSidebarHome", () => {
  test("falls back to the section label and collection home without a root index", () => {
    expect(
      buildSidebarHome([entry("intro", "intro")], {
        routeBase: "/notes",
        sectionLabel: "Notes",
      }),
    ).toEqual({ title: "Notes", href: "/notes" });
    // Default section label is "Docs".
    expect(
      buildSidebarHome([entry("intro", "intro")], { routeBase: "/docs" }),
    ).toEqual({ title: "Docs", href: "/docs" });
  });

  test("puts the root index doc title on the home link, not the label", () => {
    expect(
      buildSidebarHome(
        [
          entry("index", "", { title: "Portosaur Docs" }),
          entry("intro", "intro"),
        ],
        { routeBase: "/docs" },
      ),
    ).toEqual({ href: "/docs", title: "Portosaur Docs" });
  });

  test("uses the root index slug when it has a custom one", () => {
    expect(
      buildSidebarHome([entry("index", "home", { title: "Home" })], {
        routeBase: "/notes",
      }),
    ).toEqual({ title: "Home", href: "/notes/home" });
  });

  test("the last root index wins on duplicates", () => {
    expect(
      buildSidebarHome(
        [
          entry("index", "", { title: "First" }),
          entry("README", "", { title: "Second" }),
        ],
        { routeBase: "/notes" },
      ),
    ).toEqual({ title: "Second", href: "/notes" });
  });
});

describe("flattenSidebar", () => {
  test("dissolves categories into their children, depth-first", () => {
    const tree = buildSidebar(
      [
        entry("1 - personal-notes/README", "personal-notes", {
          title: "Personal Notes",
        }),
        entry("1 - personal-notes/1 - random-thoughts", "random", {
          title: "Random Thoughts",
        }),
        entry("2 - programming-tricks", "programming-tricks", {
          title: "Programming Tricks",
        }),
      ],
      { routeBase: "/notes" },
    );

    const flat = flattenSidebar(tree);
    // The category's own page comes first, then its children.
    expect(flat.map((item) => item.label)).toEqual([
      "Personal Notes",
      "Random Thoughts",
      "Programming Tricks",
    ]);
    expect(flat.map((item) => item.href)).toEqual([
      "/notes/personal-notes",
      "/notes/random",
      "/notes/programming-tricks",
    ]);
    expect(flat.every((item) => item.type === "doc")).toBe(true);
  });

  test("drops categories without an index doc, keeping their children", () => {
    const tree = buildSidebar(
      [entry("guide/setup", "guide/setup", { title: "Setup" })],
      { routeBase: "/docs" },
    );

    const flat = flattenSidebar(tree);
    expect(flat.map((item) => item.label)).toEqual(["Setup"]);
    expect(flat[0].href).toBe("/docs/guide/setup");
  });

  test("carries the category enrichment onto the synthesized doc link", () => {
    const tree = buildSidebar(
      [
        entry("guide/index", "guide", {
          title: "Guide",
          icon: "book",
          color: "red",
          description: "The guide",
        }),
        entry("guide/setup", "guide/setup"),
      ],
      { routeBase: "/docs" },
    );

    const flat = flattenSidebar(tree);
    expect(flat[0]).toMatchObject({
      type: "doc",
      label: "Guide",
      href: "/docs/guide",
      icon: "book",
      color: "red",
      description: "The guide",
    });
  });
});
