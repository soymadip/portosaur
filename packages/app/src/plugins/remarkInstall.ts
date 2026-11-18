/**
 * remarkInstall
 *
 * Turns `package-install` / `npm` fences into tabbed install
 * commands — one tab per package manager — for JavaScript AND
 * other languages. Fumadocs' own remarkNpm only knows the JS
 * managers (npm/pnpm/yarn/bun), so Portosaur disables it
 * (`remarkNpmOptions: false` in mdx.ts) and runs this plugin
 * instead. The JS behavior is a faithful copy of remark-npm's.
 *
 *   ```package-install
 *   portosaur
 *   ```
 *   → npm / pnpm / yarn / bun tabs (JS, the default)
 *
 *   ```package-install lang="python"
 *   requests
 *   ```
 *   → pip / uv / poetry tabs
 *
 * The language comes from the fence's `lang="..."` meta. JS is
 * the default, and `lang="js"` says so explicitly. Other
 * languages are a table of managers below — adding one is a few
 * lines: the manager names and the command each one uses to
 * install a package. The fence holds plain package names (one
 * line or several). Each manager's tab fills in its own command.
 *
 * An unknown language is left alone (the fence renders as a plain
 * code block) with a build warning, rather than rendering the
 * wrong tabs.
 */

import convert from "npm-to-yarn";
import {
  generateCodeBlockTabs,
  parseCodeBlockAttributes,
  type CodeBlockTabsOptions,
} from "fumadocs-core/mdx-plugins/codeblock-utils";
import { replaceSource } from "fumadocs-core/mdx-plugins/stringifier";

/** Minimal recursive AST walker (no external dep, matches remarkVars pattern). */
function visit(
  tree: any,
  type: string,
  visitor: (node: any, index: number, parent: any) => void,
): void {
  function walk(node: any, index: number | null, parent: any): void {
    if (node.type === type) {
      visitor(node, index as number, parent);
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], i, node);
      }
    }
  }
  walk(tree, null, null);
}

/** Install commands per language: manager name + the command that
 * installs a package. The fence's package list is appended. */
const INSTALL_COMMANDS: Record<string, { name: string; command: string }[]> = {
  python: [
    { name: "pip", command: "pip install" },
    { name: "uv", command: "uv add" },
    { name: "poetry", command: "poetry add" },
    { name: "pipx", command: "pipx install" },
  ],
  ruby: [
    { name: "gem", command: "gem install" },
    { name: "bundler", command: "bundle add" },
  ],
};

/** Language aliases, all lowercase. JS is the default language. */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: "js",
  javascript: "js",
  node: "js",
  npm: "js",
  py: "python",
  rb: "ruby",
};

function convertLines(cmd: string, to: "yarn" | "pnpm" | "bun") {
  return cmd
    .split("\n")
    .map((line) => convert(line, to))
    .join("\n");
}

/** The JS managers, converted from the npm command the way
 * Fumadocs' remark-npm does. */
function jsTabs(code: string): { value: string; code: string }[] {
  const managers: {
    name: string;
    convert: (cmd: string) => string | undefined;
  }[] = [
    { name: "npm", convert: (cmd) => cmd },
    { name: "pnpm", convert: (cmd) => convertLines(cmd, "pnpm") },
    { name: "yarn", convert: (cmd) => convertLines(cmd, "yarn") },
    { name: "bun", convert: (cmd) => convertLines(cmd, "bun") },
  ];
  const tabs: { value: string; code: string }[] = [];
  for (const manager of managers) {
    const command = manager.convert(code);
    if (!command || command.length === 0) {
      continue;
    }
    tabs.push({ value: manager.name, code: command });
  }
  return tabs;
}

/** The managers of a table language, each filled in with the
 * fence's package list. */
function tableTabs(
  language: string,
  packages: string,
): { value: string; code: string }[] {
  return INSTALL_COMMANDS[language].map((manager) => ({
    value: manager.name,
    code: packages ? `${manager.command} ${packages}` : manager.command,
  }));
}

export default function remarkInstall() {
  return (tree: any, file: any) => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang !== "package-install" && node.lang !== "npm") {
        return;
      }
      if (typeof index !== "number" || !parent) {
        return;
      }

      const { attributes, rest } = parseCodeBlockAttributes(node.meta ?? "", [
        "lang",
      ]);
      const rawLang =
        typeof attributes.lang === "string"
          ? attributes.lang.toLowerCase()
          : null;
      const language = rawLang ? (LANGUAGE_ALIASES[rawLang] ?? rawLang) : "js";

      let tabs: { value: string; code: string }[];
      if (language === "js") {
        let code = node.value;
        if (
          node.lang === "package-install" &&
          !code.startsWith("npm") &&
          !code.startsWith("npx")
        ) {
          code = `npm install ${code}`;
        }
        tabs = jsTabs(code);
      } else if (INSTALL_COMMANDS[language]) {
        // Plain package names, one line or several — collapse the
        // whitespace so every manager gets one clean command.
        const packages = node.value.trim().split(/\s+/).join(" ");
        tabs = tableTabs(language, packages);
      } else {
        file.message(
          `Portosaur: package-install lang "${rawLang}" is not supported. ` +
            `Supported languages are: js, python, ruby. ` +
            `The fence is left as a plain code block.`,
          node,
        );
        return;
      }

      const options: CodeBlockTabsOptions = { triggers: [], tabs: [] };
      for (const tab of tabs) {
        options.defaultValue ??= tab.value;
        options.triggers.push({
          value: tab.value,
          children: [{ type: "text", value: tab.value }],
        });
        options.tabs.push({
          value: tab.value,
          children: [
            {
              type: "code",
              lang: "bash",
              meta: rest.trim(),
              value: tab.code,
            },
          ],
        });
      }

      // The tabs are generated. Their Markdown is the authored code block.
      replaceSource(file, node, (s) => s.stringify(node));
      parent.children[index] = generateCodeBlockTabs(options);
    });
  };
}
