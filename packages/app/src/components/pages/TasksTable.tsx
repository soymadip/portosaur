"use client";

import { useState } from "react";

/**
 * TasksTable — the interactive tasks table (stats, status tabs
 * with counts, the sorted table). Tab filtering is React state,
 * replacing the Astro `tasks-filter` module.
 *
 * Client component, so it cannot import `lib/icons.ts` (the icon
 * packs are megabytes of JSON) — the server page pre-renders the
 * icon HTML and passes it in as strings.
 */

export interface TasksTab {
  id: string;
  label: string;
  iconHtml: string;
  spin?: boolean;
  count: number;
}

export interface TasksRow {
  title: string;
  desc?: string;
  status?: string;
  priority?: string;
}

export interface TasksStats {
  total: number;
  completed: number;
  active: number;
  pending: number;
  percentComplete: number;
}

const STATUS_BADGE: Record<string, string> = {
  completed: "porto-tasks-badge--done",
  active: "porto-tasks-badge--active",
  pending: "porto-tasks-badge--planned",
};

const KNOWN_STATUSES = new Set(["active", "pending", "completed"]);

export function TasksTable({
  heading,
  subheading,
  stats,
  tabs,
  tasks,
  statusIcons,
  priorityIcons,
  emptyIconHtml,
}: {
  heading: string;
  subheading: string;
  stats: TasksStats;
  tabs: TasksTab[];
  tasks: TasksRow[];
  /** Pre-rendered status badge icons, keyed by status. */
  statusIcons: Record<string, string>;
  /** Pre-rendered priority badge icons, keyed by priority. */
  priorityIcons: Record<string, string>;
  emptyIconHtml: string;
}) {
  const [activeTab, setActiveTab] = useState("all");
  const visible =
    activeTab === "all"
      ? tasks
      : tasks.filter((task) => task.status === activeTab);
  return (
    <>
      <div className="porto-tasks-heading">
        <h1 className="porto-tasks-title">{heading}</h1>
        {subheading && <p className="porto-tasks-subtitle">{subheading}</p>}
      </div>
      <div className="porto-tasks-inner">
        <div className="porto-tasks-stats">
          <div className="porto-tasks-stat">
            <div className="porto-tasks-stat-label">Total Tasks</div>
            <div className="porto-tasks-stat-value">{stats.total}</div>
          </div>
          <div className="porto-tasks-stat">
            <div className="porto-tasks-stat-label">Completed</div>
            <div className="porto-tasks-stat-value porto-tasks-stat-value--success">
              {stats.completed}
            </div>
          </div>
          <div className="porto-tasks-stat">
            <div className="porto-tasks-stat-label">In Progress</div>
            <div className="porto-tasks-stat-value porto-tasks-stat-value--accent">
              {stats.active}
            </div>
          </div>
          <div className="porto-tasks-stat">
            <div className="porto-tasks-stat-label">Planned</div>
            <div className="porto-tasks-stat-value porto-tasks-stat-value--warning">
              {stats.pending}
            </div>
          </div>
          <div className="porto-tasks-stat">
            <div className="porto-tasks-stat-label">Progress</div>
            <div className="porto-tasks-stat-value">
              {stats.percentComplete}%
            </div>
            <div className="porto-tasks-progress-track">
              <div
                className="porto-tasks-progress-bar"
                style={{ width: `${stats.percentComplete}%` }}
              />
            </div>
          </div>
        </div>

        <div className="porto-tasks-panel">
          <div
            className="porto-tasks-tabs"
            role="tablist"
            aria-label="Task categories"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`porto-tasks-tab${tab.id === activeTab ? " porto-tasks-tab--active" : ""}`}
                role="tab"
                aria-selected={tab.id === activeTab}
                aria-controls={`tab-content-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span
                  className={`porto-tasks-tab-icon${tab.spin ? " spin" : ""}`}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: tab.iconHtml }}
                />
                <span className="porto-tasks-tab-label">{tab.label}</span>
                <span className="porto-tasks-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div
            className="porto-tasks-content"
            role="tabpanel"
            id={`tab-content-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {tasks.length === 0 ? (
              <div className="porto-tasks-empty">
                <span
                  className="porto-tasks-empty-icon"
                  dangerouslySetInnerHTML={{ __html: emptyIconHtml }}
                />
                <p>No tasks available</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="porto-tasks-empty">
                <span
                  className="porto-tasks-empty-icon"
                  dangerouslySetInnerHTML={{ __html: emptyIconHtml }}
                />
                <p>No tasks in this category</p>
              </div>
            ) : (
              <div className="porto-tasks-table">
                <div className="porto-tasks-table-head">
                  <div className="porto-tasks-table-head-cell">Status</div>
                  <div className="porto-tasks-table-head-cell porto-tasks-table-head-cell--details">
                    Task Details
                  </div>
                  <div className="porto-tasks-table-head-cell porto-tasks-table-head-cell--priority">
                    Priority
                  </div>
                </div>
                <div>
                  {visible.map((task, index) => (
                    <div
                      key={`${task.title}-${index}`}
                      className={`porto-tasks-row${index % 2 === 1 ? " porto-tasks-row--striped" : ""}`}
                    >
                      <div className="porto-tasks-cell">
                        <span
                          className={`porto-tasks-badge ${STATUS_BADGE[task.status ?? ""] ?? ""}`}
                        >
                          {task.status === "completed" && (
                            <>
                              <span
                                className="porto-tasks-badge-icon"
                                dangerouslySetInnerHTML={{
                                  __html: statusIcons.completed ?? "",
                                }}
                              />{" "}
                              Done
                            </>
                          )}
                          {task.status === "active" && (
                            <>
                              <span
                                className="porto-tasks-badge-icon spin"
                                dangerouslySetInnerHTML={{
                                  __html: statusIcons.active ?? "",
                                }}
                              />{" "}
                              In Progress
                            </>
                          )}
                          {task.status === "pending" && (
                            <>
                              <span
                                className="porto-tasks-badge-icon"
                                dangerouslySetInnerHTML={{
                                  __html: statusIcons.pending ?? "",
                                }}
                              />{" "}
                              Planned
                            </>
                          )}
                          {!KNOWN_STATUSES.has(task.status ?? "") &&
                            task.status}
                        </span>
                      </div>
                      <div className="porto-tasks-cell porto-tasks-cell--details">
                        <div
                          className={`porto-tasks-title-text ${
                            task.status === "completed"
                              ? "porto-tasks-title-text--completed"
                              : task.status === "active"
                                ? "porto-tasks-title-text--active"
                                : ""
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.desc && (
                          <div
                            className={`porto-tasks-desc ${
                              task.status === "completed"
                                ? "porto-tasks-desc--completed"
                                : ""
                            }`}
                          >
                            {task.desc}
                          </div>
                        )}
                      </div>
                      <div className="porto-tasks-cell">
                        {task.priority === "high" && (
                          <span className="porto-tasks-badge porto-tasks-badge--high">
                            <span
                              className="porto-tasks-badge-icon"
                              dangerouslySetInnerHTML={{
                                __html: priorityIcons.high ?? "",
                              }}
                            />{" "}
                            High
                          </span>
                        )}
                        {task.priority === "medium" && (
                          <span className="porto-tasks-badge porto-tasks-badge--high porto-tasks-badge--bold">
                            <span
                              className="porto-tasks-badge-icon"
                              dangerouslySetInnerHTML={{
                                __html: priorityIcons.medium ?? "",
                              }}
                            />{" "}
                            Medium
                          </span>
                        )}
                        {task.priority === "low" && (
                          <span className="porto-tasks-badge porto-tasks-badge--low">
                            <span
                              className="porto-tasks-badge-icon"
                              dangerouslySetInnerHTML={{
                                __html: priorityIcons.low ?? "",
                              }}
                            />{" "}
                            Low
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
