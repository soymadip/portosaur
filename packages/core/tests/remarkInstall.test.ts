import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkInstall from "../src/plugins/remarkInstall.ts";

/**
 * `remarkInstall` replaces Fumadocs' remarkNpm (disabled via
 * `remarkNpmOptions: false` in mdx.ts): it turns
 * `package-install` / `npm` fences into tabbed install commands,
 * for JS (npm/pnpm/yarn/bun, converted the way remark-npm does)
 * and for other languages via a `lang="..."` fence meta
 * (python → pip/uv/poetry, ruby → gem/bundler).
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
    .use(remarkInstall);
  const tree = processor.parse(mdx);
  const file = fakeFile();
  await processor.run(tree, file);
  return { tree, file };
}

function findTabs(tree: any): any[] {
  const found: any[] = [];
  const walk = (node: any) => {
    if (node.type === "mdxJsxFlowElement" && node.name === "CodeBlockTabs") {
      found.push(node);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree);
  return found;
}

function readTabs(tabsElement: any): {
  defaultValue: string | undefined;
  triggers: string[];
  tabs: { value: string; lang: string; meta: string; code: string }[];
} {
  const defaultValue = tabsElement.attributes?.find(
    (attr: any) => attr.name === "defaultValue",
  )?.value;
  const list = tabsElement.children.find(
    (child: any) => child.name === "CodeBlockTabsList",
  );
  const triggers = list.children.map(
    (trigger: any) => trigger.children[0].value,
  );
  const tabs = tabsElement.children
    .filter((child: any) => child.name === "CodeBlockTab")
    .map((tab: any) => {
      const code = tab.children[0];
      return {
        value: tab.attributes.find((attr: any) => attr.name === "value")?.value,
        lang: code.lang,
        meta: code.meta,
        code: code.value,
      };
    });
  return { defaultValue, triggers, tabs };
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

describe("remarkInstall", () => {
  test("turns a bare package-install fence into JS manager tabs", async () => {
    const { tree } = await transform("```package-install\nportosaur\n```\n");
    const [tabsElement] = findTabs(tree);
    const { defaultValue, triggers, tabs } = readTabs(tabsElement);
    expect(defaultValue).toBe("npm");
    expect(triggers).toEqual(["npm", "pnpm", "yarn", "bun"]);
    expect(tabs.map((tab) => tab.code)).toEqual([
      "npm install portosaur",
      "pnpm add portosaur",
      "yarn add portosaur",
      "bun add portosaur",
    ]);
    expect(tabs.every((tab) => tab.lang === "bash")).toBe(true);
  });

  test("passes an npm fence's command through unchanged", async () => {
    const { tree } = await transform("```npm\nnpm install portosaur\n```\n");
    const [tabsElement] = findTabs(tree);
    const { tabs } = readTabs(tabsElement);
    expect(tabs[0].code).toBe("npm install portosaur");
  });

  test('turns lang="python" into pip/uv/poetry/pipx tabs', async () => {
    const { tree } = await transform(
      '```package-install lang="python"\nrequests\n```\n',
    );
    const [tabsElement] = findTabs(tree);
    const { defaultValue, triggers, tabs } = readTabs(tabsElement);
    expect(defaultValue).toBe("pip");
    expect(triggers).toEqual(["pip", "uv", "poetry", "pipx"]);
    expect(tabs.map((tab) => tab.code)).toEqual([
      "pip install requests",
      "uv add requests",
      "poetry add requests",
      "pipx install requests",
    ]);
  });

  test('turns lang="ruby" into gem/bundler tabs', async () => {
    const { tree } = await transform(
      '```package-install lang="ruby"\nrails\n```\n',
    );
    const [tabsElement] = findTabs(tree);
    const { triggers, tabs } = readTabs(tabsElement);
    expect(triggers).toEqual(["gem", "bundler"]);
    expect(tabs.map((tab) => tab.code)).toEqual([
      "gem install rails",
      "bundle add rails",
    ]);
  });

  test("accepts language aliases and casing", async () => {
    const { tree } = await transform(
      '```package-install lang="Py"\nrequests\n```\n',
    );
    const [tabsElement] = findTabs(tree);
    expect(readTabs(tabsElement).triggers).toEqual([
      "pip",
      "uv",
      "poetry",
      "pipx",
    ]);
  });

  test("collapses a multi-line package list into one command", async () => {
    const { tree } = await transform(
      '```package-install lang="python"\nrequests\nhttpx\n```\n',
    );
    const [tabsElement] = findTabs(tree);
    const { tabs } = readTabs(tabsElement);
    expect(tabs[0].code).toBe("pip install requests httpx");
  });

  test("keeps other fence meta on the tab code blocks, minus lang", async () => {
    const { tree } = await transform(
      '```package-install lang="python" title="Install"\nrequests\n```\n',
    );
    const [tabsElement] = findTabs(tree);
    const { tabs } = readTabs(tabsElement);
    expect(tabs.every((tab) => tab.meta === 'title="Install"')).toBe(true);
  });

  test("leaves an unknown language alone with a warning", async () => {
    const { tree, file } = await transform(
      '```package-install lang="rust"\nserde\n```\n',
    );
    expect(findTabs(tree)).toHaveLength(0);
    const [fence] = findCode(tree);
    expect(fence.lang).toBe("package-install");
    expect(fence.value).toBe("serde");
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0]).toContain('lang "rust"');
  });

  test("leaves ordinary fences untouched", async () => {
    const { tree } = await transform("```js\nconst a = 1;\n```\n");
    expect(findTabs(tree)).toHaveLength(0);
    const [fence] = findCode(tree);
    expect(fence.lang).toBe("js");
  });
});
