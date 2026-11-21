import { describe, test, expect, spyOn } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkMermaid from "../src/plugins/remarkMermaid.ts";
import { getIconSvg } from "../src/lib/icon-data.ts";

/**
 * `remarkMermaid` renders ```mermaid fences to inline SVG at build
 * time (Pele, decision 27). Unsupported types and broken diagrams
 * stay plain code blocks with a build warning.
 *
 * These tests parse real MDX (not hand-built trees) and run the
 * plugin through a processor, the way mdx.ts wires it.
 */

function fakeFile(): any {
  const messages: string[] = [];
  return {
    data: {},
    history: ["test.mdx"],
    messages,
    message(reason: string) {
      messages.push(String(reason));
    },
  };
}

async function transform(mdx: string): Promise<{ tree: any; file: any }> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkMermaid);
  const tree = processor.parse(mdx);
  const file = fakeFile();
  await processor.run(tree, file);
  return { tree, file };
}

/**
 * Run a function with console.warn spied on, restoring it after.
 * Returns the warn calls alongside the function's result, so warn
 * tests stay quiet and can assert on the printed warning.
 */
async function captureWarn<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; warns: any[][] }> {
  // spyOn calls through to the real console.warn by default, so
  // silence it — otherwise warn tests print into the suite output.
  const spy = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const result = await fn();
    return { result, warns: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
}

function findDiagrams(tree: any): any[] {
  const found: any[] = [];
  const walk = (node: any) => {
    if (node.type === "mdxJsxFlowElement" && node.name === "Diagram") {
      found.push(node);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree);
  return found;
}

function diagramSvg(element: any): string {
  return (
    element.attributes?.find((attr: any) => attr.name === "svg")?.value ?? ""
  );
}

function findCode(tree: any): any[] {
  const found: any[] = [];
  const walk = (node: any) => {
    if (node.type === "code") {
      found.push(node);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree);
  return found;
}

describe("remarkMermaid", () => {
  test("renders a flowchart fence to a Diagram element with inline SVG", async () => {
    const { tree, file } = await transform(
      "```mermaid\nflowchart LR\n  A --> B\n```\n",
    );
    const diagrams = findDiagrams(tree);
    expect(diagrams).toHaveLength(1);
    const svg = diagramSvg(diagrams[0]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("pele-flowchart");
    expect(findCode(tree)).toHaveLength(0);
    expect(file.messages).toHaveLength(0);
  });

  test("leaves a non-mermaid fence alone", async () => {
    const { tree, file } = await transform("```js\nconst a = 1;\n```\n");
    expect(findDiagrams(tree)).toHaveLength(0);
    expect(findCode(tree)).toHaveLength(1);
    expect(file.messages).toHaveLength(0);
  });

  test("leaves an unsupported type as a code block with a warning", async () => {
    const {
      result: { tree, file },
      warns,
    } = await captureWarn(() =>
      transform("```mermaid\nzenuml\n  A->B: hi\n```\n"),
    );
    expect(findDiagrams(tree)).toHaveLength(0);
    expect(findCode(tree)).toHaveLength(1);
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0]).toContain("unsupported mermaid diagram type");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain("unsupported mermaid diagram type");
    expect(warns[0]?.[0]).toContain("test.mdx");
  });

  test("leaves a broken diagram as a code block with a warning", async () => {
    const {
      result: { tree, file },
      warns,
    } = await captureWarn(() =>
      transform("```mermaid\nflowchart LR\n  A -->\n```\n"),
    );
    expect(findDiagrams(tree)).toHaveLength(0);
    expect(findCode(tree)).toHaveLength(1);
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0]).toContain("could not be rendered");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain("could not be rendered");
    expect(warns[0]?.[0]).toContain("test.mdx");
  });

  test("resolves fa: icons through the Iconify packs", async () => {
    const { tree } = await transform(
      "```mermaid\nflowchart LR\n  A[fa:fa-car Car] --> B\n```\n",
    );
    const diagrams = findDiagrams(tree);
    expect(diagrams).toHaveLength(1);
    const svg = diagramSvg(diagrams[0]);
    expect(svg).toContain("pele-icon");
    // Mermaid's `fa:fa-car` maps to fa7-solid's bare `car`.
    const car = getIconSvg("fa7-solid:car");
    expect(car).not.toBeNull();
    expect(svg).toContain(car!.body);
  });

  test("gives each diagram its own id prefix", async () => {
    const { tree } = await transform(
      "```mermaid\nsankey\nA,B,10\nB,C,5\n```\n\n```mermaid\nsankey\nX,Y,3\nY,Z,2\n```\n",
    );
    const diagrams = findDiagrams(tree);
    expect(diagrams).toHaveLength(2);
    expect(diagramSvg(diagrams[0])).toContain("pele-1-sankey-");
    expect(diagramSvg(diagrams[1])).toContain("pele-2-sankey-");
  });
});
