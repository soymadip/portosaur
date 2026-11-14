/**
 * Tasks page tab filtering (ported from the old `TaskTabs` React state
 * in `pages/tasks.jsx`).
 *
 * The page renders one table with every task (sorted by status, then
 * priority) plus one empty state. Each row carries a `data-task-status`
 * attribute; each tab button carries `data-task-tab` (`all`, `active`,
 * `pending`, `completed`). Clicking a tab shows only that status's rows
 * (or all of them), updates the active tab styling + aria state, and
 * swaps the table for the empty state when the filter matches nothing.
 *
 * Scoped to `[data-porto-tasks]` so the script is inert on other pages.
 */

export function initTasksFilter(): void {
  const container = document.querySelector("[data-porto-tasks]");
  if (!container) {
    return;
  }

  const tabs = container.querySelectorAll<HTMLElement>("[data-task-tab]");
  const rows = container.querySelectorAll<HTMLElement>("[data-task-status]");
  const table = container.querySelector<HTMLElement>("[data-task-table]");
  const emptyState = container.querySelector<HTMLElement>("[data-task-empty]");
  const panel = container.querySelector<HTMLElement>("[data-task-panel]");

  function selectTab(status: string): void {
    tabs.forEach((tab) => {
      const active = tab.dataset.taskTab === status;
      tab.classList.toggle("task-tab-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    let visible = 0;
    rows.forEach((row) => {
      const show = status === "all" || row.dataset.taskStatus === status;
      row.style.display = show ? "" : "none";
      if (show) {
        visible += 1;
      }
    });

    if (table) {
      table.style.display = visible === 0 ? "none" : "";
    }
    if (emptyState) {
      emptyState.style.display = visible === 0 ? "" : "none";
    }
    if (panel) {
      panel.setAttribute("aria-labelledby", `tab-${status}`);
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      selectTab(tab.dataset.taskTab ?? "all");
    });
  });
}
