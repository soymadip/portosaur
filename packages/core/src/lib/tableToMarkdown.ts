/**
 * Serializes table rows to a Markdown table. The first row is the
 * header and the second line is the alignment row. Cell text is
 * trimmed, pipes are escaped, and line breaks collapse to spaces
 * so a cell never breaks its row. Short rows are padded to the
 * widest row so every line has the same cell count.
 */
export function tableToMarkdown(
  rows: string[][],
  aligns?: (string | null)[],
): string {
  if (rows.length === 0) {
    return "";
  }
  const width = Math.max(...rows.map((row) => row.length));
  const clean = (cell: string) =>
    cell.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => clean(row[i] ?? "")).join(" | ")} |`;
  const marker = (align: string | null | undefined) => {
    if (align === "center") {
      return ":---:";
    }
    if (align === "right") {
      return "---:";
    }
    return "---";
  };
  const separator = `| ${Array.from({ length: width }, (_, i) => marker(aligns?.[i])).join(" | ")} |`;
  return [line(rows[0]), separator, ...rows.slice(1).map(line)].join("\n");
}
