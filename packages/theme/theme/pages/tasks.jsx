import { useState } from "react";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "../css/tasks.module.css";
import clsx from "clsx";
import {
  FaClipboardList,
  FaSyncAlt,
  FaClock,
  FaCheckCircle,
  FaFire,
  FaThermometerHalf,
  FaSnowflake,
  FaTasks,
  FaExclamationTriangle,
} from "react-icons/fa";

// --- TaskList ---

function TaskList({ filterStatus, taskList }) {
  if (!taskList || !Array.isArray(taskList)) {
    return (
      <div className={styles["task-empty-state"]}>
        <FaTasks className={styles["task-empty-icon"]} />
        <p>No tasks available</p>
      </div>
    );
  }

  const filteredTasks = taskList.filter((task) =>
    filterStatus ? task.status === filterStatus : true,
  );

  if (filteredTasks.length === 0) {
    return (
      <div className={styles["task-empty-state"]}>
        <FaTasks className={styles["task-empty-icon"]} />
        <p>No tasks in this category</p>
      </div>
    );
  }

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const statusOrder = { active: 1, pending: 2, completed: 3 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className={styles["task-list-container"]}>
      <div className={styles["task-list-table"]}>
        {/* Table header */}
        <div className={styles["task-list-header"]}>
          <div
            className={clsx(styles["task-cell"], styles["task-cell-status"])}
          >
            Status
          </div>
          <div className={clsx(styles["task-cell"], styles["task-cell-title"])}>
            Task Details
          </div>
          <div
            className={clsx(styles["task-cell"], styles["task-cell-priority"])}
          >
            Priority
          </div>
        </div>

        {/* Task rows */}
        <div className={styles["task-rows"]}>
          {sortedTasks.map((task, index) => (
            <div
              key={index}
              className={clsx(
                styles["task-row"],
                task.status === "completed"
                  ? "task-row-completed"
                  : "" && styles["task-row-completed"],
                index % 2 === 1
                  ? "task-row-striped"
                  : "" && styles["task-row-striped"],
              )}
            >
              {/* Status cell */}
              <div
                className={clsx(
                  styles["task-cell"],
                  styles["task-cell-status"],
                )}
              >
                <span
                  className={clsx(
                    styles["badge"],
                    styles[`badge-status-${task.status}`],
                  )}
                >
                  {task.status === "completed" && (
                    <>
                      <FaCheckCircle className={styles["badge-icon"]} /> Done
                    </>
                  )}
                  {task.status === "active" && (
                    <>
                      <FaSyncAlt
                        className={clsx(styles["badge-icon"], styles["spin"])}
                      />{" "}
                      In Progress
                    </>
                  )}
                  {task.status === "pending" && (
                    <>
                      <FaClock className={styles["badge-icon"]} /> Planned
                    </>
                  )}
                </span>
              </div>

              {/* Title cell */}
              <div
                className={clsx(styles["task-cell"], styles["task-cell-title"])}
              >
                <div className={styles["task-title"]}>{task.title}</div>
                {task.desc && (
                  <div className={styles["task-description"]}>{task.desc}</div>
                )}
              </div>

              {/* Priority cell */}
              <div
                className={clsx(
                  styles["task-cell"],
                  styles["task-cell-priority"],
                )}
              >
                <span
                  className={clsx(
                    styles["badge"],
                    styles[`badge-priority-${task.priority}`],
                  )}
                >
                  {task.priority === "high" && (
                    <>
                      <FaFire className={styles["badge-icon"]} /> High
                    </>
                  )}
                  {task.priority === "medium" && (
                    <>
                      <FaThermometerHalf className={styles["badge-icon"]} />{" "}
                      Medium
                    </>
                  )}
                  {task.priority === "low" && (
                    <>
                      <FaSnowflake className={styles["badge-icon"]} /> Low
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- TaskStats ---

function TaskStats({ taskList }) {
  if (!taskList || !Array.isArray(taskList)) {
    return null;
  }

  const total = taskList.length;
  const completed = taskList.filter(
    (task) => task.status === "completed",
  ).length;
  const active = taskList.filter((task) => task.status === "active").length;
  const pending = taskList.filter((task) => task.status === "pending").length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={styles["stats-container"]}>
      <div className={styles["stat-box"]}>
        <div className={styles["stat-label"]}>Total Tasks</div>
        <div className={styles["stat-value"]}>{total}</div>
      </div>
      <div className={styles["stat-box"]}>
        <div className={styles["stat-label"]}>Completed</div>
        <div
          className={clsx(styles["stat-value"], styles["stat-value-completed"])}
        >
          {completed}
        </div>
      </div>
      <div className={styles["stat-box"]}>
        <div className={styles["stat-label"]}>In Progress</div>
        <div
          className={clsx(styles["stat-value"], styles["stat-value-active"])}
        >
          {active}
        </div>
      </div>
      <div className={styles["stat-box"]}>
        <div className={styles["stat-label"]}>Planned</div>
        <div
          className={clsx(styles["stat-value"], styles["stat-value-pending"])}
        >
          {pending}
        </div>
      </div>
      <div className={styles["stat-box"]}>
        <div className={styles["stat-label"]}>Progress</div>
        <div className={styles["stat-value"]}>{percentComplete}%</div>
        <div className={styles["progress-bar-container"]}>
          <div
            className={styles["progress-bar"]}
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// --- TaskTabs ---

function TaskTabs({ taskList }) {
  const [activeTab, setActiveTab] = useState("all");

  if (!taskList || !Array.isArray(taskList)) {
    return null;
  }

  const tabData = [
    {
      id: "all",
      label: "All Tasks",
      icon: <FaClipboardList />,
      count: taskList.length,
    },
    {
      id: "active",
      label: "In Progress",
      icon: <FaSyncAlt className={styles["spin"]} />,
      count: taskList.filter((t) => t.status === "active").length,
    },
    {
      id: "pending",
      label: "Planned",
      icon: <FaClock />,
      count: taskList.filter((t) => t.status === "pending").length,
    },
    {
      id: "completed",
      label: "Completed",
      icon: <FaCheckCircle />,
      count: taskList.filter((t) => t.status === "completed").length,
    },
  ];

  return (
    <div className={styles["task-tabs-container"]}>
      <div
        className={styles["task-tabs"]}
        role="tablist"
        aria-label="Task categories"
      >
        {tabData.map((tab) => (
          <button
            key={tab.id}
            className={clsx(
              styles["task-tab"],
              activeTab === tab.id
                ? "task-tab-active"
                : ""
                  ? styles["task-tab-active"]
                  : "",
            )}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-content-${tab.id}`}
            id={`tab-${tab.id}`}
          >
            <span className={styles["task-tab-icon"]} aria-hidden="true">
              {tab.icon}
            </span>
            <span className={styles["task-tab-label"]}>{tab.label}</span>
            <span className={styles["task-tab-count"]}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div
        className={styles["task-tab-content"]}
        role="tabpanel"
        id={`tab-content-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "all" && <TaskList taskList={taskList} />}
        {activeTab === "active" && (
          <TaskList taskList={taskList} filterStatus="active" />
        )}
        {activeTab === "pending" && (
          <TaskList taskList={taskList} filterStatus="pending" />
        )}
        {activeTab === "completed" && (
          <TaskList taskList={taskList} filterStatus="completed" />
        )}
      </div>
    </div>
  );
}

// --- TasksPage (default export) ---

export default function TasksPage() {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig || {};
  const tasksPage = customFields?.tasksPage;

  if (!tasksPage || !tasksPage.enable) {
    return (
      <Layout
        title="Tasks are Disabled"
        description="Tasks are currently disabled"
      >
        <div className={styles["tasks-container"]}>
          <div className={styles["tasks-content"]}>
            <div className={styles["tasks-disabled-notice"]}>
              <div className={styles["disabled-icon"]}>
                <FaExclamationTriangle aria-hidden="true" />
              </div>
              <h2 className={styles["disabled-title"]}>
                Tasks are currently disabled
              </h2>
              <p className={styles["disabled-help"]}>
                To enable tasks, set <code>tasks.enable</code> to{" "}
                <code>true</code>
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const heading = tasksPage.heading || "Tasks";
  const subheading = tasksPage.subheading || "Roadmap & Goals";
  const taskList = tasksPage.taskList ?? [];

  return (
    <Layout title={heading} description={subheading}>
      <Head>
        <meta property="og:title" content={heading} />
        <meta property="og:description" content={subheading} />
        <meta name="twitter:title" content={heading} />
        <meta name="twitter:description" content={subheading} />
      </Head>
      <div className={styles["tasks-container"]}>
        <div className={styles["tasks-header"]}>
          <h1 className={styles["tasks-heading"]}>{heading}</h1>
          {subheading && (
            <p className={styles["tasks-subheading"]}>{subheading}</p>
          )}
        </div>
        <div className={styles["tasks-content"]}>
          <TaskStats taskList={taskList} />
          <TaskTabs taskList={taskList} />
        </div>
      </div>
    </Layout>
  );
}
