import { describe, expect, test } from "bun:test";
import { tableToMarkdown } from "../src/lib/tableToMarkdown.ts";

describe("tableToMarkdown", () => {
  test("builds a header, separator, and body rows", () => {
    expect(
      tableToMarkdown([
        ["Name", "Age"],
        ["Ada", "36"],
        ["Grace", "85"],
      ]),
    ).toBe("| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Grace | 85 |");
  });

  test("marks center and right alignment", () => {
    expect(
      tableToMarkdown(
        [
          ["Left", "Center", "Right"],
          ["a", "b", "c"],
        ],
        ["left", "center", "right"],
      ),
    ).toBe("| Left | Center | Right |\n| --- | :---: | ---: |\n| a | b | c |");
  });

  test("escapes pipes and collapses line breaks", () => {
    expect(
      tableToMarkdown([
        ["A | B", "Multi\nline"],
        ["x", "y"],
      ]),
    ).toBe("| A \\| B | Multi line |\n| --- | --- |\n| x | y |");
  });

  test("pads short rows to the widest row", () => {
    expect(tableToMarkdown([["A", "B", "C"], ["x"]])).toBe(
      "| A | B | C |\n| --- | --- | --- |\n| x |  |  |",
    );
  });

  test("returns an empty string for no rows", () => {
    expect(tableToMarkdown([])).toBe("");
  });

  test("handles a header-only table", () => {
    expect(tableToMarkdown([["Only"]])).toBe("| Only |\n| --- |");
  });
});
