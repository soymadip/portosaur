/**
 * The icon scan — build time only (it imports the Iconify packs
 * through `lib/icon-data.ts`). Collects every icon the site uses
 * (frontmatter/config `icon:` values, `icon`/`id` props in MDX,
 * `:prefix:name:` shortcodes, slug guesses, and the fixed icons
 * core's own pages render) and writes the per-site module the
 * runtime renders from. Unknown ids warn once; the module is
 * rewritten only when its contents change, so a content save
 * that adds no icon never churns the dev server.
 */

import fs from "node:fs";
import path from "node:path";
import { getIconSvg, hasKnownPrefix } from "./icon-data.ts";
import { getPrefixRegex } from "./iconPrefixes.ts";
import { normalizeIconId, type SiteIconData } from "./site-icons.ts";
import { techMap } from "./techmap.ts";

export interface IconScanSpec {
  projectDir: string;
  /** Absolute content dirs to scan (docs/notes + blog). */
  contentDirs: string[];
  /** Absolute config file, when one exists. */
  configFile?: string;
  /** Absolute `@portosaur/core` root (for the fixed-icon grep). */
  coreRoot: string;
  /** Absolute path of the module to write. */
  outFile: string;
}

export interface IconScanResult {
  /** Icons in the module. */
  count: number;
  /** SVG bytes in the module. */
  bytes: number;
  /** Whether the module file was (re)written. */
  changed: boolean;
  /** Unknown ids, warned once each. */
  warnings: string[];
}

/** `icon:` values in YAML frontmatter, config, and JS objects. */
const ICON_VALUE_PATTERN = /\bicon:[ \t]*["']?([^\s"'`#}\],{]+)/g;
/** `icon="..."` JSX props (`Btn`, `DynamicIcon`, `SiteIcon`). */
const ICON_PROP_PATTERN = /\bicon="([^"]+)"/g;
/** `id="..."` on an `<Icon>` element. */
const ICON_ID_PATTERN = /<Icon[^>]*\bid="([^"]+)"/g;
/** `slug="..."` on a `<DynamicIcon>` element (a guess candidate). */
const DYNAMIC_SLUG_PATTERN = /<DynamicIcon[^>]*\bslug="([^"]+)"/g;
/** Frontmatter titles and labels (guess candidates). */
const TITLE_PATTERN = /^(?:title|sidebar_label):[ \t]*["']?([^"'\n#]+)/gm;
/** `title:` values in MDX body item lists (a manual `<TopicList items={...} />`). */
const BODY_TITLE_PATTERN = /\btitle:[ \t]*["']?([^"'\n`#},]+)/g;
/** Fixed `SiteIcon` literals in core's own source. */
const CORE_ICON_PATTERN = /<SiteIcon[^>]*\b(?:icon|fallbackIcon)="([^"]+)"/g;
/** Fixed `fallbackIcon: "..."` literals in core's own source. */
const CORE_FALLBACK_PATTERN = /fallbackIcon:[ \t]*"([^"]+)"/g;
/** Fixed `icon: "prefix:name"` literals in core's own source. */
const CORE_OBJECT_ICON_PATTERN = /\bicon:[ \t]*"([a-z]+:[a-z0-9-]+)"/g;

function shortcodePattern(): RegExp {
  return new RegExp(`:(${getPrefixRegex()}):([a-zA-Z0-9-_]+):`, "g");
}

/** Markdown files under a dir, recursively (a missing dir holds none). */
function collectContentFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
}

/** Source files under a dir, recursively (a missing dir holds none). */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files;
}

/** Slug candidates from a content path: each segment, raw and number-stripped. */
function slugsFromPath(file: string, contentDir: string): string[] {
  const slugs: string[] = [];
  const relative = path.relative(contentDir, file);
  const segments = relative.split(path.sep);
  for (const [index, segment] of segments.entries()) {
    const bare =
      index === segments.length - 1
        ? segment.replace(/\.(md|mdx)$/, "")
        : segment;
    const stripped = bare.replace(/^\d+\s*[-.]?\s*/, "");
    for (const candidate of [bare, stripped]) {
      const lower = candidate.toLowerCase();
      if (lower) {
        slugs.push(lower);
      }
    }
  }
  return slugs;
}

export interface CollectedIcons {
  icons: Map<string, SiteIconData>;
  warnings: string[];
}

/** The frontmatter block of an MDX file ("" when it has none). */
function frontmatterOf(text: string): string {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return "";
  }
  const end = text.indexOf("\n---", 3);
  return end === -1 ? "" : text.slice(0, end + 4);
}

/** Strips fenced code blocks, so `icon:` values in code samples
 * (docs showing an example frontmatter block) never reach the scan. */
function stripCodeBlocks(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let fence = "";
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!fence) {
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        fence = trimmed.startsWith("```") ? "```" : "~~~";
        continue;
      }
      kept.push(line);
      continue;
    }
    if (trimmed.startsWith(fence)) {
      fence = "";
    }
  }
  return kept.join("\n");
}

/** Collects the site's icons without writing anything, so tests
 * can check the set without a file. */
export function collectSiteIcons(
  spec: Omit<IconScanSpec, "outFile">,
): CollectedIcons {
  const values = new Set<string>();
  const slugs = new Set<string>();

  const readYaml = (text: string) => {
    for (const match of text.matchAll(ICON_VALUE_PATTERN)) {
      values.add(match[1].trim());
    }
    for (const match of text.matchAll(TITLE_PATTERN)) {
      slugs.add(match[1].trim().toLowerCase());
    }
  };

  const readBody = (text: string) => {
    for (const match of text.matchAll(ICON_VALUE_PATTERN)) {
      values.add(match[1].trim());
    }
    for (const match of text.matchAll(ICON_PROP_PATTERN)) {
      values.add(match[1].trim());
    }
    for (const match of text.matchAll(ICON_ID_PATTERN)) {
      values.add(match[1].trim());
    }
    for (const match of text.matchAll(shortcodePattern())) {
      values.add(`${match[1]}:${match[2]}`);
    }
    for (const match of text.matchAll(DYNAMIC_SLUG_PATTERN)) {
      slugs.add(match[1].trim().toLowerCase());
    }
    for (const match of text.matchAll(BODY_TITLE_PATTERN)) {
      slugs.add(match[1].trim().toLowerCase());
    }
  };

  for (const dir of spec.contentDirs) {
    for (const file of collectContentFiles(dir)) {
      let text: string;
      try {
        text = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      readYaml(frontmatterOf(text));
      readBody(stripCodeBlocks(text));
      for (const slug of slugsFromPath(file, dir)) {
        slugs.add(slug);
      }
    }
  }

  if (spec.configFile) {
    try {
      readYaml(fs.readFileSync(spec.configFile, "utf-8"));
    } catch {}
  }

  for (const file of collectSourceFiles(path.join(spec.coreRoot, "src"))) {
    // techmap.ts holds the whole name -> icon table and
    // icon-scan.ts holds example ids in its patterns — grepping
    // either would add those icons to every site's module.
    if (
      file.endsWith(`${path.sep}lib${path.sep}techmap.ts`) ||
      file.endsWith(`${path.sep}lib${path.sep}icon-scan.ts`)
    ) {
      continue;
    }
    let text: string;
    try {
      text = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(CORE_ICON_PATTERN)) {
      values.add(match[1].trim());
    }
    for (const match of text.matchAll(CORE_FALLBACK_PATTERN)) {
      values.add(match[1].trim());
    }
    for (const match of text.matchAll(CORE_OBJECT_ICON_PATTERN)) {
      values.add(match[1].trim());
    }
  }

  const icons = new Map<string, SiteIconData>();
  const warnings: string[] = [];
  const warned = new Set<string>();
  const warn = (message: string) => {
    if (!warned.has(message)) {
      warned.add(message);
      warnings.push(message);
    }
  };

  const addId = (id: string) => {
    const normalized = normalizeIconId(id);
    if (!normalized || icons.has(normalized)) {
      return;
    }
    const svg = getIconSvg(normalized);
    if (svg) {
      icons.set(normalized, svg);
    }
  };

  for (const value of values) {
    if (!value) {
      continue;
    }
    // Raw SVG, images, and emoji need no module entry.
    if (value.trim().startsWith("<svg")) {
      continue;
    }
    if (value.includes(".") || value.includes("/")) {
      continue;
    }
    if (/\p{Emoji}/u.test(value)) {
      continue;
    }
    const mapped = techMap[value.toLowerCase()]?.icon;
    if (mapped) {
      addId(mapped);
      continue;
    }
    if (!value.includes(":")) {
      warn(`[Icons] Malformed icon id: ${value}`);
      continue;
    }
    if (!hasKnownPrefix(value)) {
      warn(`[Icons] Unknown icon prefix in id: ${value}`);
      continue;
    }
    const normalized = normalizeIconId(value);
    if (!normalized || icons.has(normalized)) {
      continue;
    }
    const svg = getIconSvg(normalized);
    if (svg) {
      icons.set(normalized, svg);
    } else {
      warn(`[Icons] Icon not found: ${value}`);
    }
  }

  for (const slug of slugs) {
    const guessed = techMap[slug]?.icon;
    if (guessed) {
      addId(guessed);
      continue;
    }
    addId(`di:${slug}`);
  }

  return { icons, warnings };
}

/** Renders the generated module for a collected icon set. */
export function renderSiteIconsModule(
  icons: Map<string, SiteIconData>,
): string {
  const entries = [...icons.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([id, svg]) =>
        `  ${JSON.stringify(id)}: { viewBox: ${JSON.stringify(svg.viewBox)}, body: ${JSON.stringify(svg.body)} },`,
    );
  return `// Generated by the Portosaur icon scan — do not edit by hand.
// Rebuilt on every \`porto build\` / \`porto dev\` from the icons the
// site actually uses (content, config, and the core's own pages).
import type { SiteIcons } from "@portosaur/core/lib/site-icons";

export const siteIcons: SiteIcons = {
${entries.join("\n")}
};
`;
}

/** Runs the scan and writes the module when its contents changed. */
export function generateSiteIcons(spec: IconScanSpec): IconScanResult {
  const { icons, warnings } = collectSiteIcons(spec);
  const module = renderSiteIconsModule(icons);
  let changed = true;
  try {
    changed = fs.readFileSync(spec.outFile, "utf-8") !== module;
  } catch {}
  if (changed) {
    fs.mkdirSync(path.dirname(spec.outFile), { recursive: true });
    fs.writeFileSync(spec.outFile, module);
  }
  let bytes = 0;
  for (const svg of icons.values()) {
    bytes += svg.body.length;
  }
  return { count: icons.size, bytes, changed, warnings };
}
