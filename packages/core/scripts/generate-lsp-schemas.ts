// Generates the frontmatter and component JSON Schemas for the
// Portosaur language server, from the sources of truth: the zod
// frontmatter schema and the MDX components' prop types.
//
// Run with `bun run schema` from the repo root. Writes into
// packages/cli/schema/ (committed, shipped with @portosaur/cli).
//
// The component props are read with a small brace-matching parser,
// not the TypeScript compiler API: TypeScript 7 ships no compiler
// API (its package exports only the version), and the shapes here
// are simple inline object types. The parser fails loudly on
// anything it cannot read, so a new prop shape breaks the build
// instead of silently shipping a stale schema.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { portoDocSchema } from "../src/lib/source.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE_SRC = path.resolve(HERE, "../src");
const MDX_FILE = path.join(CORE_SRC, "components/mdx.tsx");
const SCHEMA_DIR = path.resolve(HERE, "../../cli/schema");

// ------- Frontmatter -------

function generateFrontmatterSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(portoDocSchema, {
    io: "input",
    unrepresentable: "any",
    target: "draft-7",
  }) as Record<string, unknown>;

  // z.coerce.date() has no JSON Schema form, so the field comes
  // out empty. Users write a date string, so say so.
  const properties = schema.properties as Record<string, unknown>;
  properties.date = {
    type: "string",
    description: "The page date, as YYYY-MM-DD.",
  };

  return {
    $schema: schema.$schema,
    title: "Portosaur Frontmatter",
    description: "Frontmatter keys for a Portosaur doc, note or blog page.",
    type: "object",
    properties,
    additionalProperties: false,
  };
}

// ------- Small scanner -------

// Walks text tracking bracket depth, skipping strings and comments.
// Only used on type positions, where `<` always opens a generic.
const OPEN = "({[<";
const CLOSE = ")}]>";

type ScannerState =
  "code" | "single" | "double" | "template" | "line-comment" | "block-comment";

function scan(
  text: string,
  start: number,
  end: number,
  visit: (char: string, index: number, depth: number) => void,
): void {
  let state: ScannerState = "code";
  let depth = 0;
  for (let i = start; i < end; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (state === "code") {
      if (char === "'") {
        state = "single";
      } else if (char === '"') {
        state = "double";
      } else if (char === "`") {
        state = "template";
      } else if (char === "/" && next === "/") {
        state = "line-comment";
        i++;
      } else if (char === "/" && next === "*") {
        state = "block-comment";
        i++;
      } else if (char === "=" && next === ">") {
        // An arrow, not a closing generic: skip both chars so the
        // `>` never unbalances the depth count.
        i++;
        continue;
      } else if (OPEN.includes(char)) {
        depth++;
      } else if (CLOSE.includes(char)) {
        depth--;
      }
      visit(char, i, depth);
    } else if (state === "single" && char === "'") {
      state = "code";
    } else if (state === "double" && char === '"') {
      state = "code";
    } else if (state === "template" && char === "`") {
      state = "code";
    } else if (state === "line-comment" && char === "\n") {
      state = "code";
    } else if (state === "block-comment" && char === "*" && next === "/") {
      state = "code";
      i++;
    }
  }
}

// Index of the bracket closing the one at `openIndex`.
function matchingBracket(text: string, openIndex: number): number {
  let match = -1;
  let depth = 0;
  scan(text, openIndex, text.length, (char, i, d) => {
    if (match !== -1) {
      return;
    }
    if (i === openIndex) {
      depth = d;
      return;
    }
    if (d === depth - 1 && CLOSE.includes(char)) {
      match = i;
    }
  });
  if (match === -1) {
    throw new Error(`Unbalanced brackets from index ${openIndex}`);
  }
  return match;
}

// Splits on the given separators at bracket depth 0.
function splitTopLevel(text: string, separators: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  scan(text, 0, text.length, (char, i, d) => {
    if (d === 0 && separators.includes(char)) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
    depth = d;
  });
  void depth;
  parts.push(text.slice(start));
  return parts;
}

// The first top-level colon, or -1. Used to find a parameter's
// type annotation inside its parameter list.
function firstTopLevelColon(text: string): number {
  let found = -1;
  scan(text, 0, text.length, (char, i, d) => {
    if (found === -1 && d === 0 && char === ":") {
      found = i;
    }
  });
  return found;
}

// Strips comments from a chunk, leaving the code.
function stripComments(text: string): string {
  let out = "";
  let state: ScannerState = "code";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line-comment";
        i++;
      } else if (char === "/" && next === "*") {
        state = "block-comment";
        i++;
      } else {
        out += char;
      }
    } else if (state === "line-comment" && char === "\n") {
      state = "code";
      out += char;
    } else if (state === "block-comment" && char === "*" && next === "/") {
      state = "code";
      i++;
    }
  }
  return out;
}

// The leading block comment of a chunk, cleaned to one line, plus
// the chunk without it. Returns null when the chunk has no
// leading comment.
function leadingComment(chunk: string): { text: string; rest: string } | null {
  const trimmed = chunk.trimStart();
  if (!trimmed.startsWith("/*")) {
    return null;
  }
  const end = trimmed.indexOf("*/");
  if (end === -1) {
    return null;
  }
  const raw = trimmed.slice(2, end);
  const text = raw
    .replace(/^\*+/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, rest: trimmed.slice(end + 2) };
}

// ------- Imports -------

// Maps the names a file imports (local names) to the files they
// come from. Bare specifiers (react, next/link) are skipped.
function readImports(file: string): Map<string, string> {
  const source = fs.readFileSync(file, "utf8");
  const imports = new Map<string, string>();
  const pattern = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[2];
    if (!specifier.startsWith(".")) {
      continue;
    }
    const resolved = path.resolve(path.dirname(file), specifier);
    for (const raw of match[1].split(",")) {
      const name = raw.replace(/^\s*type\s+/, "").trim();
      if (!name) {
        continue;
      }
      const local = name.includes(" as ") ? name.split(" as ")[1].trim() : name;
      imports.set(local, resolved);
    }
  }
  return imports;
}

// ------- Component map -------

// The capitalized shorthand properties of the object
// getMDXComponents returns, with the file each one lives in.
// Names with no import (the Dropdown wrapper) live in mdx.tsx.
function readComponentMap(): Map<string, string> {
  const source = fs.readFileSync(MDX_FILE, "utf8");
  const fnAt = source.indexOf("export function getMDXComponents");
  if (fnAt === -1) {
    throw new Error("getMDXComponents not found in mdx.tsx");
  }
  const returnAt = source.indexOf("return {", fnAt);
  if (returnAt === -1) {
    throw new Error("getMDXComponents has no returned object");
  }
  const openAt = source.indexOf("{", returnAt);
  const closeAt = matchingBracket(source, openAt);
  const body = source.slice(openAt + 1, closeAt);

  const imports = readImports(MDX_FILE);
  const components = new Map<string, string>();
  for (const chunk of splitTopLevel(body, ",")) {
    const code = stripComments(chunk).trim();
    if (/^[A-Z][A-Za-z0-9]*$/.test(code)) {
      components.set(code, imports.get(code) ?? MDX_FILE);
    }
  }
  return components;
}

// ------- Prop types -------

type Prop = {
  name: string;
  optional: boolean;
  typeText: string;
  description?: string;
};

// The first parameter's type annotation of `export function Name(`.
function componentPropsType(file: string, name: string): string {
  const source = fs.readFileSync(file, "utf8");
  const fnAt = source.indexOf(`export function ${name}(`);
  if (fnAt === -1) {
    throw new Error(`${name}: no exported function declaration in ${file}`);
  }
  const openAt = source.indexOf("(", fnAt);
  const closeAt = matchingBracket(source, openAt);
  const params = source.slice(openAt + 1, closeAt);
  const colonAt = firstTopLevelColon(params);
  if (colonAt === -1) {
    throw new Error(`${name}: first parameter has no type annotation`);
  }
  return params.slice(colonAt + 1).trim();
}

// Resolves a named type (`ButtonVariant`) to its definition text,
// following imports one file over when the alias lives elsewhere.
function resolveAlias(
  typeName: string,
  fromFile: string,
  seen: Set<string> = new Set(),
): string | null {
  const key = `${fromFile}:${typeName}`;
  if (seen.has(key)) {
    return null;
  }
  seen.add(key);

  const source = fs.readFileSync(fromFile, "utf8");
  const aliasAt = source.search(
    new RegExp(`(?:export\\s+)?type\\s+${typeName}\\s*=`),
  );
  if (aliasAt !== -1) {
    const eqAt = source.indexOf("=", aliasAt);
    const semiAt = source.indexOf(";", eqAt);
    if (semiAt === -1) {
      throw new Error(`${typeName}: unterminated type alias in ${fromFile}`);
    }
    return source.slice(eqAt + 1, semiAt).trim();
  }

  const imports = readImports(fromFile);
  const target = imports.get(typeName);
  if (!target) {
    return null;
  }
  return resolveAlias(typeName, target, seen);
}

// Parses an inline object type's members. Returns the props plus
// whether the type allows extra keys (an index signature).
function parseObjectMembers(
  typeText: string,
  component: string,
): { props: Prop[]; hasIndexSignature: boolean } {
  const openAt = typeText.indexOf("{");
  const closeAt = matchingBracket(typeText, openAt);
  const body = typeText.slice(openAt + 1, closeAt);

  const props: Prop[] = [];
  let hasIndexSignature = false;
  for (const chunk of splitTopLevel(body, ";,")) {
    let rest = chunk;
    let description: string | undefined;
    const comment = leadingComment(chunk);
    if (comment) {
      description = comment.text || undefined;
      rest = comment.rest;
    }
    const code = stripComments(rest).trim();
    if (!code) {
      continue;
    }
    if (code.startsWith("[")) {
      hasIndexSignature = true;
      continue;
    }
    const match = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\?)?\s*:\s*([\s\S]*)$/.exec(
      code,
    );
    if (!match) {
      throw new Error(
        `${component}: cannot parse prop member ${JSON.stringify(code)}`,
      );
    }
    const [, name, optional, rawType] = match;
    const typeText = rawType.trim();
    if (name === "children") {
      continue;
    }
    if (typeText.includes("=>")) {
      continue;
    }
    props.push({ name, optional: optional === "?", typeText, description });
  }
  return { props, hasIndexSignature };
}

// Maps a TypeScript type to a JSON Schema fragment. Unmapped
// types (objects, React nodes, generics) keep their TS type for
// hover and accept any value.
function typeToSchema(
  typeText: string,
  file: string,
  component: string,
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "x-ts-type": typeText.replace(/\s+/g, " ").trim(),
  };

  const branches = splitTopLevel(typeText, "|")
    .map((branch) => branch.trim())
    .filter((branch) => branch !== "null" && branch !== "undefined");
  if (branches.length === 0) {
    return schema;
  }

  const literals: string[] = [];
  const primitives = new Set<string>();
  let hasArray = false;
  let unmapped = false;
  for (const branch of branches) {
    const literal = /^["'](.*)["']$/.exec(branch);
    if (literal) {
      literals.push(literal[1]);
      continue;
    }
    if (branch === "string" || branch === "number" || branch === "boolean") {
      primitives.add(branch);
      continue;
    }
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(branch)) {
      const resolved = resolveAlias(branch, file);
      if (resolved) {
        const inner = typeToSchema(resolved, file, component);
        if (typeof inner.enum !== "undefined") {
          literals.push(...(inner.enum as string[]));
          continue;
        }
        if (inner.type === "string") {
          primitives.add("string");
          continue;
        }
      }
    }
    if (branch.endsWith("[]") || branch.startsWith("Array<")) {
      hasArray = true;
      continue;
    }
    unmapped = true;
  }

  // An unmapped branch (an object, a React node, a generic) means
  // the value cannot be completed or checked: keep the TS type
  // for hover and accept anything.
  if (unmapped) {
    return schema;
  }
  const types = [...primitives];
  if (literals.length > 0) {
    types.push("string");
  }
  if (hasArray) {
    types.push("array");
  }
  if (types.length === 0) {
    return schema;
  }
  // An enum only constrains string values, so it is only emitted
  // when strings are the whole type. Mixed with other kinds the
  // enum would wrongly reject them.
  if (literals.length > 0 && types.length === 1) {
    schema.type = "string";
    schema.enum = literals;
    return schema;
  }
  schema.type = types.length === 1 ? types[0] : types;
  return schema;
}

function generateComponentSchema(): Record<string, unknown> {
  const components = readComponentMap();
  const definitions: Record<string, unknown> = {};

  for (const [name, file] of [...components].sort()) {
    let propsType = componentPropsType(file, name);
    if (!propsType.startsWith("{")) {
      const resolved = resolveAlias(propsType, file);
      if (!resolved || !resolved.startsWith("{")) {
        throw new Error(
          `${name}: props type ${propsType} is not an object type`,
        );
      }
      propsType = resolved;
    }
    const { props, hasIndexSignature } = parseObjectMembers(propsType, name);

    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const prop of props) {
      const propSchema = typeToSchema(prop.typeText, file, name);
      if (prop.description) {
        propSchema.description = prop.description;
      }
      properties[prop.name] = propSchema;
      if (!prop.optional) {
        required.push(prop.name);
      }
    }

    const definition: Record<string, unknown> = {
      type: "object",
      properties,
    };
    if (required.length > 0) {
      definition.required = required;
    }
    if (!hasIndexSignature) {
      definition.additionalProperties = false;
    }
    definitions[name] = definition;
  }

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Portosaur MDX Components",
    description: "Props of the components Portosaur provides in MDX.",
    type: "object",
    definitions,
  };
}

// ------- Main -------

function writeJson(name: string, value: Record<string, unknown>): void {
  const target = path.join(SCHEMA_DIR, name);
  fs.mkdirSync(SCHEMA_DIR, { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}

writeJson("frontmatter.json", generateFrontmatterSchema());
const components = generateComponentSchema();
writeJson("components.json", components);
console.log(
  `Components: ${Object.keys(components.definitions as Record<string, unknown>).join(", ")}`,
);
