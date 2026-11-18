import type { TableHTMLAttributes } from "react";

/**
 * The `<table>` mapping: Fumadocs wraps markdown tables in a
 * scrolling region (their `Table` in base-ui mdx) so wide tables
 * scroll sideways instead of breaking the layout, while the table
 * itself keeps its rounded corners. The wrapper is keyboard
 * focusable so the table can be scrolled without a mouse.
 */
export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div
      className="porto-table-wrapper"
      tabIndex={0}
      role="region"
      aria-label="Scrollable table"
    >
      <table {...props} />
    </div>
  );
}
