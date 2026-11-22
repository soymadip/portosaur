/**
 * remarkDuplicateAnchors
 *
 * Reports h2 headings that share an anchor id within one page.
 * Two h2 headings with the same text (or the same `[#id]`) are
 * usually a copy-paste slip: the site dedups plain repeats with
 * a `-1` suffix, so a link to the plain id reaches the first
 * heading, not the second, and custom ids are not deduped at
 * all, so two headings share the id outright. Only h2 headings
 * are checked — repeated h3 headings under different sections
 * (an "Options" under every command) are a normal pattern.
 *
 * The ids are computed the way Fumadocs' remarkHeading computes
 * them: one `github-slugger` instance per document, a trailing
 * `[#id]` on the last text child used verbatim (and fed into the
 * slugger, so a later plain heading with the same base gets the
 * `-1` suffix), and heading text flattened by concatenating
 * every string value in the heading. The plugin runs last in the
 * remark pipeline, so it sees the same tree remarkHeading will
 * see: the H1 already hoisted, `{vars.key}` substituted, emoji
 * shortcodes rendered.
 *
 * What happens on a duplicate follows
 * `site.content.on_duplicate_h2`: "throw" fails the build,
 * "warn" warns (default), "ignore" stays silent.
 */

import Slugger from "github-slugger";

/**
 * What happens when two h2 headings in a page share an anchor:
 * fail the build ("throw"), warn ("warn"), or stay silent
 * ("ignore").
 */
export type DuplicateH2Behavior = "throw" | "warn" | "ignore";

export interface RemarkDuplicateAnchorsOptions {
  /** Behavior for a duplicate h2 anchor (default "warn"). */
  onDuplicateH2?: DuplicateH2Behavior;
}

const DUPLICATE_H2_BEHAVIORS: DuplicateH2Behavior[] = [
  "throw",
  "warn",
  "ignore",
];

/** A custom ID at the end of heading text, like `[#id]`. */
const headingIdRegex = /\s*\[#(?<slug>[^]+?)]\s*$/;

/** Minimal recursive AST walker (no external dep, matches remarkIcons pattern). */
function visit(tree: any, type: string, visitor: (node: any) => void): void {
  function walk(node: any): void {
    if (node.type === type) {
      visitor(node);
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }
  walk(tree);
}

/**
 * The plain text of a heading: every string value in it,
 * concatenated. Mirrors Fumadocs' flattenNode.
 */
function flattenNode(node: any): string {
  if ("children" in node) {
    return node.children.map(flattenNode).join("");
  }
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  return "";
}

export default function remarkDuplicateAnchors({
  onDuplicateH2 = "warn",
}: RemarkDuplicateAnchorsOptions = {}) {
  if (!DUPLICATE_H2_BEHAVIORS.includes(onDuplicateH2)) {
    throw new Error(
      `[Portosaur] Invalid site.content.on_duplicate_h2 "${onDuplicateH2}" — expected "throw", "warn", or "ignore".`,
    );
  }

  return (tree: any, file: any) => {
    if (onDuplicateH2 === "ignore") {
      return;
    }
    const filePath = file?.path || file?.history?.[0] || "";
    const slugger = new Slugger();
    const seenBases = new Set<string>();

    visit(tree, "heading", (heading) => {
      // Only h2 headings are checked — repeated h3 headings
      // under different sections are a normal pattern.
      if (heading.depth !== 2) {
        return;
      }
      // A trailing `[#id]` on the last text child is the id,
      // used verbatim.
      const lastChild = heading.children?.at(-1);
      let customId: string | null = null;
      if (lastChild?.type === "text") {
        const match = headingIdRegex.exec(lastChild.value);
        if (match?.groups?.slug) {
          customId = match.groups.slug;
        }
      }

      let base: string;
      let id: string;
      let text: string;
      if (customId) {
        base = customId;
        id = customId;
        text = flattenNode(heading);
        // Reserve the custom id in the slugger, so a later plain
        // heading with the same base gets the `-1` suffix.
        slugger.slug(customId);
      } else {
        text = flattenNode(heading);
        base = new Slugger().slug(text);
        if (base === "") {
          return;
        }
        id = slugger.slug(text);
      }

      if (!seenBases.has(base)) {
        seenBases.add(base);
        return;
      }

      const line = heading.position?.start?.line;
      const where = line ? ` (line ${line})` : "";
      const message =
        id === base
          ? `[Portosaur] Duplicate heading id "${base}" in "${filePath}"${where} — two headings share it.`
          : `[Portosaur] Duplicate heading "${text}" in "${filePath}"${where} — this one gets the id "${id}".`;
      if (onDuplicateH2 === "throw") {
        throw new Error(message);
      }
      file.message(message, heading);
      // fumadocs-mdx never reads the vfile messages (its build step
      // returns only code and map), so a file.message alone would
      // never reach the build log. Print it too, so the warning is
      // actually seen at build time.
      console.warn(message);
    });
  };
}
