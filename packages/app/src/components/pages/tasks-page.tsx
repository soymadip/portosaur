import type { PortosaurOptions } from "../../lib/config.ts";
import { renderIcon } from "../../lib/icons.ts";
import { SiteShell } from "./frame/SiteShell.tsx";
import { TasksTable, type TasksRow, type TasksTab } from "./TasksTable.tsx";

/**
 * TasksPage — the tasks page (`/tasks`).
 *
 * Full task table from `config.tasks` (title/subtitle/list —
 * the resolved engine shape). Stats, status tabs with counts,
 * and one table sorted by status order then priority.
 *
 * Server component: it computes the stats/sorted list and
 * pre-renders the icon HTML (the icon packs can't ship to the
 * client) for the `TasksTable` client component, which owns the
 * tab-filter state.
 *
 * Status is the string `"completed"` (not "Done"). Unknown
 * statuses sort after the known ones and get a neutral badge
 * with the raw status text. Tasks without a priority get no
 * priority badge.
 */

const STATUS_ORDER: Record<string, number> = {
  active: 1,
  pending: 2,
  completed: 3,
};
const PRIORITY_ORDER: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

export function TasksPage({ config }: { config: PortosaurOptions }) {
  const tasks = config.tasks ?? {};
  const enabled = tasks.enable === true;
  const heading = tasks.title || "Tasks";
  const subheading = tasks.subtitle || "Roadmap & Goals";
  const list: TasksRow[] = Array.isArray(tasks.list) ? tasks.list : [];

  // Stats (unknown statuses count toward the total only).
  const total = list.length;
  const completedCount = list.filter(
    (task) => task.status === "completed",
  ).length;
  const activeCount = list.filter((task) => task.status === "active").length;
  const pendingCount = list.filter((task) => task.status === "pending").length;
  const percentComplete =
    total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // Sort: status order (active, pending, completed, unknown
  // last), then priority (high, medium, low, missing last —
  // degrades to "as listed").
  const sorted = [...list].sort((a, b) => {
    const statusDiff =
      (STATUS_ORDER[a.status ?? ""] ?? 99) -
      (STATUS_ORDER[b.status ?? ""] ?? 99);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return (
      (PRIORITY_ORDER[a.priority ?? ""] ?? 99) -
      (PRIORITY_ORDER[b.priority ?? ""] ?? 99)
    );
  });

  const tabs: TasksTab[] = [
    {
      id: "all",
      label: "All Tasks",
      iconHtml: renderIcon("md:clipboard-text"),
      count: total,
    },
    {
      id: "active",
      label: "In Progress",
      iconHtml: renderIcon("md:loading"),
      spin: true,
      count: activeCount,
    },
    {
      id: "pending",
      label: "Planned",
      iconHtml: renderIcon("md:clock-outline"),
      count: pendingCount,
    },
    {
      id: "completed",
      label: "Completed",
      iconHtml: renderIcon("md:check-circle"),
      count: completedCount,
    },
  ];

  return (
    <SiteShell config={config}>
      <div className="porto-tasks">
        {!enabled ? (
          <div className="porto-tasks-inner">
            <div className="porto-tasks-disabled">
              <div className="porto-tasks-disabled-icon">
                <span
                  dangerouslySetInnerHTML={{
                    __html: renderIcon("ml:alert"),
                  }}
                />
              </div>
              <h2 className="porto-tasks-disabled-title">
                Tasks are currently disabled
              </h2>
              <p className="porto-tasks-disabled-text">
                To enable tasks, set <code>tasks.enable</code> to{" "}
                <code>true</code>
              </p>
            </div>
          </div>
        ) : (
          <TasksTable
            heading={heading}
            subheading={subheading}
            stats={{
              total,
              completed: completedCount,
              active: activeCount,
              pending: pendingCount,
              percentComplete,
            }}
            tabs={tabs}
            tasks={sorted}
            statusIcons={{
              completed: renderIcon("md:check-circle"),
              active: renderIcon("md:loading"),
              pending: renderIcon("md:clock-outline"),
            }}
            priorityIcons={{
              high: renderIcon("md:fire"),
              medium: renderIcon("md:thermometer"),
              low: renderIcon("md:snowflake"),
            }}
            emptyIconHtml={renderIcon("md:format-list-checks")}
          />
        )}
      </div>
    </SiteShell>
  );
}
