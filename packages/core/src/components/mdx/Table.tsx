"use client";

import { useRef, useState, type TableHTMLAttributes } from "react";
import { SiteIcon } from "../SiteIcon.tsx";
import { tableToMarkdown } from "../../lib/tableToMarkdown.ts";

/**
 * The `<table>` mapping: Fumadocs wraps markdown tables in a
 * scrolling region (their `Table` in base-ui mdx) so wide tables
 * scroll sideways instead of breaking the layout, while the table
 * itself keeps its rounded corners. The wrapper is keyboard
 * focusable so the table can be scrolled without a mouse.
 *
 * A copy button floats over the table's top-right corner. It
 * copies the table as Markdown, with the header alignment kept
 * in the separator row. The button sits in an outer frame, not
 * the scrolling wrapper, so it stays put while a wide table
 * scrolls underneath it.
 */
export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    const rows = Array.from(table.querySelectorAll("tr"), (row) =>
      Array.from(
        row.querySelectorAll("th, td"),
        (cell) => cell.textContent ?? "",
      ),
    );
    const aligns = Array.from(
      table.querySelectorAll("tr:first-child th, tr:first-child td"),
      (cell) => cell.getAttribute("align"),
    );
    void navigator.clipboard.writeText(tableToMarkdown(rows, aligns)).then(
      () => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1500);
      },
      () => {
        /* Clipboard unavailable — the copy silently fails. */
      },
    );
  };

  return (
    <div className="porto-table-frame">
      <button
        type="button"
        className="porto-table-copy"
        data-copied={copied || undefined}
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy table"}
        title={copied ? "Copied" : "Copy table"}
      >
        {copied ? (
          <SiteIcon icon="lu:check" size="0.875rem" />
        ) : (
          <SiteIcon icon="lu:copy" size="0.875rem" />
        )}
      </button>
      <div
        className="porto-table-wrapper"
        tabIndex={0}
        role="region"
        aria-label="Scrollable table"
      >
        <table ref={tableRef} {...props} />
      </div>
    </div>
  );
}
