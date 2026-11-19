import type { SearchResultItem } from "fumadocs-core/search/client";

/**
 * Shared search-result shaping for the search dialog and the search
 * page: ZBSearch items flattened so table rows become one entry
 * each — their Markdown parsed into plain-text cells, so the
 * results show a table instead of raw `| pipes |` — then grouped
 * by page: the page itself as the header, its matching headings
 * and text chunks as entries underneath, which the flat list
 * renders in order.
 */

export interface FlatResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text" | "table-row";
  content: string;
  breadcrumbs?: string[];
  /** Table rows only: the table this row belongs to. */
  tableId?: string;
  /** Table rows only: the header cells, shared by the table's rows. */
  headerCells?: string[];
  /** Table rows only: this row's cells, as plain text. */
  cells?: string[];
}

/** One page's results: its header plus its matching sections. */
export interface SearchGroup {
  /** The page's URL without any `#anchor`. */
  pageUrl: string;
  /** The page's own result, or a synthesized one. */
  header: FlatResult;
  /** The top-level docs section the page belongs to ("Getting Started"). */
  section: string;
  /** The page's matching headings and text chunks, in search order. */
  entries: FlatResult[];
}

/** One run of text from `splitMatches` — matched runs render bold, in the accent color, and underlined. */
export interface MatchSegment {
  text: string;
  matched: boolean;
}

/** Flattens search items: table rows become one entry each, their Markdown parsed into cells. */
export function flattenResults(items: SearchResultItem[]): FlatResult[] {
  const flat: FlatResult[] = [];
  for (const item of items) {
    if (item.type === "table") {
      for (const row of item.rows) {
        const parsed = parseTableRow(row.content);
        if (parsed) {
          flat.push({
            id: row.id,
            url: row.url,
            type: "table-row",
            content: parsed.cells.join(" · "),
            breadcrumbs: row.breadcrumbs,
            tableId: item.id,
            headerCells: parsed.header,
            cells: parsed.cells,
          });
        } else {
          // Not shaped like a table after all — show the text
          // without its pipes instead of the raw Markdown.
          flat.push({
            id: row.id,
            url: row.url,
            type: "text",
            content: flattenTableText(row.content),
            breadcrumbs: row.breadcrumbs,
          });
        }
      }
      continue;
    }
    flat.push({
      id: item.id,
      url: item.url,
      type: item.type,
      // Page titles, headings, and text chunks carry inline
      // Markdown too (532 indexed docs have backticks, 132 have
      // bold) — strip it so excerpts read as plain text.
      content: stripInlineMarkdown(item.content),
      breadcrumbs: item.breadcrumbs,
    });
  }
  return flat;
}

/** A table row's Markdown parsed into plain-text cells. */
export interface ParsedTableRow {
  header: string[];
  cells: string[];
}

/**
 * Parses a table row's Markdown — a header line, a separator line,
 * and the row itself, one line each — into plain-text cells. The
 * search index stores every table row this way (header + separator
 * + the one row). Returns null when the content isn't shaped like
 * that. The caller falls back to plain text.
 */
export function parseTableRow(content: string): ParsedTableRow | null {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 3 || !isSeparatorRow(lines[1])) {
    return null;
  }
  const header = splitTableRow(lines[0]);
  const cells = splitTableRow(lines[2]);
  if (header.length === 0 || cells.length === 0) {
    return null;
  }
  return { header, cells };
}

/** A separator line: every cell is dashes, with optional `:` alignment markers. */
function isSeparatorRow(line: string): boolean {
  const cells = line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * Splits one Markdown table line into plain-text cells. Pipes split
 * cells, except an escaped `\|` (a literal pipe in the cell) and a
 * pipe inside a code span (`` `a|b` ``) — backtick runs open and
 * close spans, so double-backtick spans work too. The leading and
 * trailing pipes of the line itself produce empty edge cells, which
 * are dropped. An empty cell in the middle is kept.
 */
function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  // 0 when outside a code span, otherwise the opening run's length.
  let inCode = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === "\\" && line[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }
    if (char === "`") {
      let run = 0;
      while (line[i + run] === "`") {
        run++;
      }
      if (inCode === 0) {
        inCode = run;
      } else if (run === inCode) {
        inCode = 0;
      }
      current += line.slice(i, i + run);
      i += run - 1;
      continue;
    }
    if (char === "|" && inCode === 0) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  const trimmed = cells.map((cell) => stripInlineMarkdown(cell.trim()));
  if (trimmed.length > 0 && trimmed[0] === "") {
    trimmed.shift();
  }
  if (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  return trimmed;
}

/**
 * Strips the inline Markdown search content can carry — code
 * spans, bold, links — leaving plain text. Shared by table cells
 * and by page, heading, and text excerpts. Single `*` and `_`
 * italics are deliberately left alone: stripping them would mangle
 * `snake_case` names and `2 * 3` arithmetic, which are far more
 * common in docs than italics.
 */
function stripInlineMarkdown(cell: string): string {
  return cell
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`+/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\\([\\*_|`])/g, "$1");
}

/**
 * A table-shaped blob that didn't parse as one row: every
 * non-separator line's cells joined with middots, so it still
 * reads as text instead of raw Markdown.
 */
function flattenTableText(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isSeparatorRow(line));
  return lines.map((line) => splitTableRow(line).join(" · ")).join(" · ");
}

/**
 * Groups flat results by page, keeping the search's order (the
 * search already returns one page result followed by its hits, so
 * groups form in first-seen order). A group whose page result is
 * missing gets a synthesized header from the first entry's
 * breadcrumbs or the URL's last segment — the real search always
 * returns the page first, so this only fires for hand-built lists.
 */
export function groupResults(flat: FlatResult[]): SearchGroup[] {
  const groups = new Map<string, SearchGroup>();
  for (const result of flat) {
    const pageUrl = result.url.split("#")[0];
    let group = groups.get(pageUrl);
    if (!group) {
      group = {
        pageUrl,
        header: synthesizeHeader(pageUrl, result),
        section: "",
        entries: [],
      };
      groups.set(pageUrl, group);
    }
    if (result.type === "page") {
      group.header = result;
      continue;
    }
    group.entries.push(result);
  }
  for (const group of groups.values()) {
    group.section = sectionOf(group.header);
  }
  return [...groups.values()];
}

/** The flat entry list behind grouped results — keyboard navigation walks this. */
export function flattenGroups(groups: SearchGroup[]): FlatResult[] {
  const flat: FlatResult[] = [];
  for (const group of groups) {
    flat.push(group.header);
    flat.push(...group.entries);
  }
  return flat;
}

/**
 * The top-level docs section a page belongs to. Breadcrumbs run
 * from the docs root down ("Portosaur Docs", "Getting Started"),
 * so the last one is the page's section — except for pages sitting
 * directly under the root, whose only breadcrumb is the root
 * itself. Those are their own section, named by their title.
 */
export function sectionOf(header: FlatResult): string {
  const breadcrumbs = header.breadcrumbs;
  if (breadcrumbs && breadcrumbs.length > 1) {
    return breadcrumbs[breadcrumbs.length - 1];
  }
  return header.content;
}

/** A stand-in header for a group with no page result of its own. */
function synthesizeHeader(pageUrl: string, first: FlatResult): FlatResult {
  const breadcrumbs = first.breadcrumbs;
  const title =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1]
      : titleFromUrl(pageUrl);
  return {
    id: `page:${pageUrl}`,
    url: pageUrl,
    type: "page",
    content: title,
    breadcrumbs,
  };
}

/** The URL's last segment as a readable title ("code-blocks" → "Code blocks"). */
function titleFromUrl(pageUrl: string): string {
  const segment = pageUrl.replace(/\/+$/, "").split("/").pop() ?? "";
  const words = decodeURIComponent(segment).replace(/-/g, " ").trim();
  if (!words) {
    return pageUrl;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Splits content into matched and unmatched runs for `<mark>`
 * highlighting (bold, in the accent color, and underlined — no
 * background). Terms are the query's whitespace-separated words,
 * matched case-insensitively, longest first so "installation"
 * bolds whole instead of matching "install" inside it. The
 * escaping mirrors Fumadocs' `buildRegexFromQuery`.
 */
export function splitMatches(content: string, query: string): MatchSegment[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (terms.length === 0) {
    return [{ text: content, matched: false }];
  }
  const pattern = new RegExp(terms.join("|"), "gi");
  const segments: MatchSegment[] = [];
  let index = 0;
  for (const match of content.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > index) {
      segments.push({ text: content.slice(index, start), matched: false });
    }
    segments.push({ text: match[0], matched: true });
    index = start + match[0].length;
  }
  if (index < content.length) {
    segments.push({ text: content.slice(index), matched: false });
  }
  if (segments.length === 0) {
    return [{ text: content, matched: false }];
  }
  return segments;
}
