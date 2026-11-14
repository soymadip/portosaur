import { expect, test, describe } from "bun:test";
import { buildSidebar } from "../src/utils/sidebar.ts";
import type {
  SidebarCategoryItem,
  SidebarDocItem,
} from "../src/utils/sidebar.ts";

/**
 * Sidebar builder tests (Phase 2: `buildSidebar` takes plain collection
 * entries — { id, slug, data } — and returns a plain sidebar tree).
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
    const [root] = buildSidebar(
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

    const category = root.items.find(
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
    expect(root.items.map((item) => item.label)).toEqual(["Guide", "Intro"]);
  });

  test("falls back to the collection home for a root Docs category", () => {
    const [root] = buildSidebar([entry("intro", "intro")], {
      routeBase: "/notes",
    });

    expect(root.type).toBe("category");
    expect(root.label).toBe("Docs");
    expect(root.link).toEqual({ href: "/notes" });
    expect(root.items.map((item) => (item as SidebarDocItem).id)).toEqual([
      "intro",
    ]);
  });

  test("enriches docs with icon, color, and description from frontmatter", () => {
    const [root] = buildSidebar(
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

    const category = root.items[0] as SidebarCategoryItem;
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
    const [root] = buildSidebar([entry("index", ""), entry("intro", "intro")], {
      routeBase: "/notes",
    });

    // The root index becomes the root category's link, not a list item.
    expect(root.link).toEqual({ href: "/notes" });
    expect(root.items.map((item) => (item as SidebarDocItem).id)).toEqual([
      "intro",
    ]);
  });

  test("labels a category from its index doc title, not the dirname", () => {
    const [root] = buildSidebar(
      [
        entry("3 - config/index", "config", {
          title: "Configuration Guide",
        }),
        entry("3 - config/reference", "config/reference"),
      ],
      { routeBase: "/docs" },
    );

    const category = root.items[0] as SidebarCategoryItem;
    expect(category.label).toBe("Configuration Guide");
    expect(category.link).toEqual({
      href: "/docs/config",
      title: "Configuration Guide",
    });
  });

  test("puts the root index doc title on the root link, not the label", () => {
    const [root] = buildSidebar(
      [entry("index", "", { title: "Portosaur Docs" }), entry("intro", "intro")],
      { routeBase: "/docs" },
    );

    // The label stays "Docs" (breadcrumbs use it); the link carries the
    // doc title (the paginator uses it).
    expect(root.label).toBe("Docs");
    expect(root.link).toEqual({ href: "/docs", title: "Portosaur Docs" });
  });

  test("builds nested categories ordered by number prefix", () => {
    const [root] = buildSidebar([
      entry("python/index", "python"),
      entry("python/2 - loops/loops", "python/loops/loops"),
      entry("python/1 - basics/intro", "python/basics/intro"),
      entry("python/2 - loops/while-loops", "python/loops/while-loops"),
    ]);

    const python = root.items[0] as SidebarCategoryItem;
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
