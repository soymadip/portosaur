import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkDetailsMarker from "../src/plugins/remarkDetailsMarker.ts";

function parse(md: string): any {
  return unified().use(remarkParse).use(remarkMdx).parse(md);
}

function findSummary(tree: any): any {
  let found: any;
  const visit = (node: any): void => {
    if (node.name === "summary") {
      found = node;
      return;
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  visit(tree);
  return found;
}

describe("remarkDetailsMarker", () => {
  test("prepends the chevron marker to a prose summary", () => {
    const tree = parse(
      "<details>\n<summary>Where can icons be used?</summary>\n\nBody.\n\n</details>\n",
    );
    remarkDetailsMarker()(tree);
    const summary = findSummary(tree);
    expect(summary).toBeDefined();
    const marker = summary.children[0];
    expect(marker.type).toBe("mdxJsxTextElement");
    expect(marker.name).toBe("span");
    const classAttr = marker.attributes.find(
      (attr: any) => attr.name === "className",
    );
    expect(classAttr.value).toBe("porto-details-marker");
    const svg = marker.children[0];
    expect(svg.name).toBe("svg");
    const attrs = Object.fromEntries(
      svg.attributes.map((attr: any) => [attr.name, attr.value]),
    );
    expect(attrs.viewBox).toBe("0 0 24 24");
    expect(attrs.width).toBe("1em");
    expect(svg.children[0].name).toBe("path");
    // The title text survives, after the marker.
    expect(summary.children[1].value).toBe("Where can icons be used?");
  });

  test("does not add the marker twice", () => {
    const tree = parse(
      "<details>\n<summary>Title</summary>\n\nBody.\n\n</details>\n",
    );
    const plugin = remarkDetailsMarker();
    plugin(tree);
    plugin(tree);
    const summary = findSummary(tree);
    const markers = summary.children.filter(
      (child: any) =>
        child.name === "span" &&
        child.attributes?.some(
          (attr: any) =>
            attr.name === "className" && attr.value === "porto-details-marker",
        ),
    );
    expect(markers.length).toBe(1);
  });

  test("leaves documents without summaries alone", () => {
    const tree = parse("# Hello\n\nPlain text.\n");
    remarkDetailsMarker()(tree);
    expect(findSummary(tree)).toBeUndefined();
  });
});
