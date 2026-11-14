import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkImageSrc from "../src/plugins/remarkImageSrc.ts";

/**
 * `remarkImageSrc` rewrites `<img src={ImportedImage} />` to
 * `<img src={ImportedImage.src} />`: under Astro an image import is
 * an `ImageMetadata` object, not the URL string Docusaurus/webpack
 * returned, so the bare import stringifies to `"[object Object]"`.
 *
 * These tests parse real MDX (not hand-built trees): the attribute
 * shape matters — `src={Ident}` is an `mdxJsxAttribute` whose value
 * is an `mdxJsxAttributeValueExpression` object, and a hand-built
 * tree got that shape wrong once already.
 */

function parse(mdx: string): any {
  return unified().use(remarkParse).use(remarkMdx).parse(mdx);
}

function transform(mdx: string): string {
  const tree = parse(mdx);
  remarkImageSrc()(tree);
  return String(unified().use(remarkStringify).use(remarkMdx).stringify(tree));
}

function findImgSrcAttr(tree: any): any {
  for (const node of tree.children ?? []) {
    if (node.type === "mdxJsxFlowElement" && node.name === "img") {
      return node.attributes.find((attr: any) => attr.name === "src");
    }
    for (const child of node.children ?? []) {
      if (child.type === "mdxJsxTextElement" && child.name === "img") {
        return child.attributes.find((attr: any) => attr.name === "src");
      }
    }
  }
  return undefined;
}

describe("remarkImageSrc", () => {
  test("rewrites src={import} to src={import.src} for an image import", () => {
    const out = transform(
      'import LogisticImg from "./assets/logistic-regression.jpg";\n\n<img src={LogisticImg} height="400" alt="Logistic Regression" />\n',
    );
    expect(out).toContain("src={LogisticImg.src}");
    expect(out).toContain('height="400"');
  });

  test("rewrites the attached estree to a .src member expression", () => {
    // The MDX compiler compiles the estree, not the value string —
    // deleting it leaves an empty expression and breaks the build.
    const tree = parse(
      'import LogisticImg from "./assets/logistic-regression.jpg";\n\n<img src={LogisticImg} alt="x" />\n',
    );
    remarkImageSrc()(tree);
    const expression = findImgSrcAttr(tree).value.data.estree.body[0]
      .expression;
    expect(expression.type).toBe("MemberExpression");
    expect(expression.object).toMatchObject({
      type: "Identifier",
      name: "LogisticImg",
    });
    expect(expression.property).toMatchObject({
      type: "Identifier",
      name: "src",
    });
    expect(expression.computed).toBe(false);
  });

  test("rewrites inline (text-level) img elements too", () => {
    const out = transform(
      'import Chart from "./chart.webp";\n\nSee this <img src={Chart} alt="Chart" /> inline.\n',
    );
    expect(out).toContain("src={Chart.src}");
  });

  test("rewrites several imports from one ESM block", () => {
    const out = transform(
      'import A from "./a.png";\nimport B from "./b.jpeg";\n\n<img src={A} alt="a" />\n\n<img src={B} alt="b" />\n',
    );
    expect(out).toContain("src={A.src}");
    expect(out).toContain("src={B.src}");
  });

  test("leaves a string src alone", () => {
    const out = transform(
      'import X from "./assets/x.png";\n\n<img src="./assets/x.png" alt="x" />\n',
    );
    expect(out).toContain('src="./assets/x.png"');
  });

  test("leaves a src that already ends in .src alone", () => {
    const out = transform(
      'import Logo from "./logo.png";\n\n<img src={Logo.src} alt="logo" />\n',
    );
    expect(out).toContain("src={Logo.src}");
    expect(out).not.toContain("Logo.src.src");
  });

  test("leaves ?url imports alone (already strings)", () => {
    const out = transform(
      'import IconUrl from "./icon.svg?url";\n\n<img src={IconUrl} alt="icon" />\n',
    );
    expect(out).toContain("src={IconUrl}");
  });

  test("leaves non-image imports alone", () => {
    const out = transform(
      'import helper from "./util.js";\n\n<img src={helper} alt="h" />\n',
    );
    expect(out).toContain("src={helper}");
  });

  test("leaves arbitrary expressions alone", () => {
    const out = transform(
      'import A from "./a.png";\nimport B from "./b.png";\n\n<img src={cond ? A : B} alt="x" />\n',
    );
    expect(out).toContain("src={cond ? A : B}");
  });

  test("leaves other elements alone", () => {
    const out = transform(
      'import Poster from "./poster.jpg";\n\n<video src={Poster} />\n',
    );
    expect(out).toContain("src={Poster}");
  });
});
