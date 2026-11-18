import { describe, test, expect } from "bun:test";
import {
  flattenResults,
  groupResults,
  flattenGroups,
  parseTableRow,
  sectionOf,
  splitMatches,
  type FlatResult,
} from "../src/lib/search-results.ts";

/**
 * Search-result shaping: ZBSearch items flatten (table rows become
 * entries), then group by page — one Starlight-style card per page,
 * the page itself as the header — plus the section each page
 * belongs to and the `<mark>` segments that bold the query terms.
 */

function page(id: string, content: string, breadcrumbs?: string[]): FlatResult {
  return { id, url: id, type: "page", content, breadcrumbs };
}

function heading(id: string, url: string, content: string): FlatResult {
  return { id, url, type: "heading", content };
}

function text(id: string, url: string, content: string): FlatResult {
  return { id, url, type: "text", content };
}

describe("groupResults", () => {
  test("groups a page with its headings and text", () => {
    const groups = groupResults([
      page("/docs/a", "Page A", ["Portosaur Docs", "Getting Started"]),
      heading("/docs/a-0", "/docs/a#first", "First"),
      text("/docs/a-1", "/docs/a#first", "Some text"),
      page("/docs/b", "Page B", ["Portosaur Docs"]),
      heading("/docs/b-0", "/docs/b#only", "Only"),
    ]);
    expect(groups.length).toBe(2);
    expect(groups[0].pageUrl).toBe("/docs/a");
    expect(groups[0].header.content).toBe("Page A");
    expect(groups[0].entries.length).toBe(2);
    expect(groups[0].entries[0].content).toBe("First");
    expect(groups[0].entries[1].content).toBe("Some text");
    expect(groups[1].header.content).toBe("Page B");
    expect(groups[1].entries.length).toBe(1);
  });

  test("keeps groups in first-seen order", () => {
    const groups = groupResults([
      heading("/docs/b-0", "/docs/b#x", "B hit"),
      heading("/docs/a-0", "/docs/a#x", "A hit"),
    ]);
    expect(groups.map((group) => group.pageUrl)).toEqual([
      "/docs/b",
      "/docs/a",
    ]);
  });

  test("synthesizes a header when the page result is missing", () => {
    const groups = groupResults([
      heading("/docs/a-0", "/docs/a#first", "First"),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].header.type).toBe("page");
    expect(groups[0].header.url).toBe("/docs/a");
    expect(groups[0].header.content).toBe("A");
    expect(groups[0].header.id).toBe("page:/docs/a");
  });

  test("a late page result replaces the synthesized header", () => {
    const groups = groupResults([
      heading("/docs/a-0", "/docs/a#first", "First"),
      page("/docs/a", "Real Title", ["Portosaur Docs", "Guide"]),
    ]);
    expect(groups[0].header.content).toBe("Real Title");
    expect(groups[0].entries.length).toBe(1);
  });

  test("a page on its own is a group with no entries", () => {
    const groups = groupResults([page("/docs/a", "Page A")]);
    expect(groups.length).toBe(1);
    expect(groups[0].entries).toEqual([]);
  });
});

describe("flattenGroups", () => {
  test("lists each header before its entries", () => {
    const groups = groupResults([
      page("/docs/a", "Page A"),
      heading("/docs/a-0", "/docs/a#first", "First"),
      page("/docs/b", "Page B"),
    ]);
    expect(flattenGroups(groups).map((entry) => entry.id)).toEqual([
      "/docs/a",
      "/docs/a-0",
      "/docs/b",
    ]);
  });
});

describe("sectionOf", () => {
  test("takes the last breadcrumb for nested pages", () => {
    expect(
      sectionOf(page("/docs/a", "Page A", ["Portosaur Docs", "Guide"])),
    ).toBe("Guide");
  });

  test("uses the title for pages directly under the root", () => {
    expect(
      sectionOf(page("/docs/a", "CLI Reference", ["Portosaur Docs"])),
    ).toBe("CLI Reference");
  });

  test("uses the title when there are no breadcrumbs", () => {
    expect(sectionOf(page("/docs/a", "Page A"))).toBe("Page A");
  });
});

describe("splitMatches", () => {
  test("splits a single term", () => {
    expect(splitMatches("npm install portosaur", "install")).toEqual([
      { text: "npm ", matched: false },
      { text: "install", matched: true },
      { text: " portosaur", matched: false },
    ]);
  });

  test("matches case-insensitively and keeps the original text", () => {
    expect(splitMatches("Installing dependencies", "installing")).toEqual([
      { text: "Installing", matched: true },
      { text: " dependencies", matched: false },
    ]);
  });

  test("matches any of several terms", () => {
    expect(splitMatches("npm or bun or pnpm", "bun pnpm")).toEqual([
      { text: "npm or ", matched: false },
      { text: "bun", matched: true },
      { text: " or ", matched: false },
      { text: "pnpm", matched: true },
    ]);
  });

  test("prefers the longest term so whole words bold", () => {
    expect(
      splitMatches("the installation guide", "install installation"),
    ).toEqual([
      { text: "the ", matched: false },
      { text: "installation", matched: true },
      { text: " guide", matched: false },
    ]);
  });

  test("escapes regex characters in the query", () => {
    expect(splitMatches("C++ and C#", "c++")).toEqual([
      { text: "C++", matched: true },
      { text: " and C#", matched: false },
    ]);
  });

  test("returns one unmatched segment for an empty query", () => {
    expect(splitMatches("nothing matches", "   ")).toEqual([
      { text: "nothing matches", matched: false },
    ]);
  });

  test("returns one unmatched segment when nothing matches", () => {
    expect(splitMatches("nothing matches", "zzz")).toEqual([
      { text: "nothing matches", matched: false },
    ]);
  });
});

describe("parseTableRow", () => {
  const table = (row: string) =>
    `| Option | Description |\n| ------ | ----------- |\n${row}`;

  test("parses the header and the row into cells", () => {
    expect(parseTableRow(table("| `-k` | Skip the install. |"))).toEqual({
      header: ["Option", "Description"],
      cells: ["-k", "Skip the install."],
    });
  });

  test("keeps an escaped pipe inside a cell", () => {
    expect(parseTableRow(table("| `a\\|b` | Piped. |"))?.cells).toEqual([
      "a|b",
      "Piped.",
    ]);
  });

  test("keeps a pipe inside a code span", () => {
    expect(parseTableRow(table("| `a|b` | Piped. |"))?.cells).toEqual([
      "a|b",
      "Piped.",
    ]);
  });

  test("keeps a pipe inside a double-backtick span", () => {
    expect(parseTableRow(table("| ``a|b`` | Piped. |"))?.cells).toEqual([
      "a|b",
      "Piped.",
    ]);
  });

  test("strips bold and links, keeps snake_case", () => {
    expect(
      parseTableRow(table("| **bold** [docs](/docs) | use `my_option` here |"))
        ?.cells,
    ).toEqual(["bold docs", "use my_option here"]);
  });

  test("accepts alignment markers in the separator", () => {
    expect(parseTableRow("| A | B |\n| :--- | ---: |\n| 1 | 2 |")).toEqual({
      header: ["A", "B"],
      cells: ["1", "2"],
    });
  });

  test("returns null without a separator line", () => {
    expect(parseTableRow("| A | B |\n| 1 | 2 |")).toBeNull();
  });

  test("returns null for plain text", () => {
    expect(parseTableRow("just some text")).toBeNull();
  });
});

describe("flattenResults", () => {
  test("turns table rows into cell entries sharing a table id", () => {
    const flat = flattenResults([
      {
        type: "table",
        id: "t",
        columns: 2,
        rows: [
          {
            id: "r1",
            url: "/docs/a#t",
            type: "text",
            content:
              "| Option | Description |\n| ------ | ----------- |\n| `-k` | Skip it. |",
            hastContent: null as any,
          },
          {
            id: "r2",
            url: "/docs/a#t",
            type: "text",
            content:
              "| Option | Description |\n| ------ | ----------- |\n| `-v` | Print it. |",
            hastContent: null as any,
          },
        ],
      } as any,
    ]);
    expect(flat.length).toBe(2);
    expect(flat[0].type).toBe("table-row");
    expect(flat[0].tableId).toBe("t");
    expect(flat[0].headerCells).toEqual(["Option", "Description"]);
    expect(flat[0].cells).toEqual(["-k", "Skip it."]);
    expect(flat[0].content).toBe("-k · Skip it.");
    expect(flat[1].tableId).toBe("t");
    expect(flat[1].cells).toEqual(["-v", "Print it."]);
  });

  test("falls back to plain text for a row that is not table-shaped", () => {
    const flat = flattenResults([
      {
        type: "table",
        id: "t",
        columns: 2,
        rows: [
          {
            id: "r1",
            url: "/docs/a#t",
            type: "text",
            content: "row one",
            hastContent: null as any,
          },
        ],
      } as any,
    ]);
    expect(flat[0].type).toBe("text");
    expect(flat[0].content).toBe("row one");
  });
});
