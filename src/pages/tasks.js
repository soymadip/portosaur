/*
                    __     ___ _                ____          _
                    \ \   / (_) |__   ___      / ___|___   __| | ___
                     \ \ / /| | '_ \ / _ \    | |   / _ \ / _` |/ _ \
                      \ V / | | |_) |  __/    | |__| (_) | (_| |  __/
                       \_/  |_|_.__/ \___|     \____\___/ \__,_|\___|

      This Page is completely Vibe coded. No code except small tweaks is written by me.
*/


import { useState } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import '../css/tasks.css';
import { 
  FaClipboardList, 
  FaSyncAlt, 
  FaClock, 
  FaCheckCircle,
  FaFire,
  FaThermometerHalf,
  FaSnowflake,
  FaTasks,
  FaExclamationTriangle
} from 'react-icons/fa';

function TaskList({ filterStatus, taskList }) {
  if (!taskList || !Array.isArray(taskList)) {
    return (
      <div className="task-empty-state">
        <FaTasks className="task-empty-icon" />
        <p>No tasks available</p>
      </div>
    );
  }
  
  const filteredTasks = taskList.filter(task => 
    filterStatus ? task.status === filterStatus : true
  );

  if (filteredTasks.length === 0) {
    return (
      <div className="task-empty-state">
        <FaTasks className="task-empty-icon" />
        <p>No tasks in this category</p>
      </div>
    );
  }

  // Sort tasks by status first (with completed tasks at bottom), then by priority
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const statusOrder = { active: 1, pending: 2, completed: 3 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    
    if (statusDiff !== 0) return statusDiff;
    
    // Priority order: high, medium, low
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return (
    <div className="task-list-container">
      <div className="task-list-table">
        <div className="task-list-header">
          <div className="task-cell task-cell-status">Status</div>
          <div className="task-cell task-cell-title">Task Details</div>
          <div className="task-cell task-cell-priority">Priority</div>
        </div>

        <div className="task-rows">
          {sortedTasks.map((task, index) => (
            <div 
              key={index} 
              className={`task-row ${task.status === 'completed' ? 'task-row-completed' : ''} ${index % 2 === 1 ? 'task-row-striped' : ''}`}
            >
              <div className="task-cell task-cell-status">
                <span className={`badge badge-status-${task.status}`}>
                  {task.status === 'completed' && <><FaCheckCircle className="badge-icon" /> Done</>}
                  {task.status === 'active' && <><FaSyncAlt className="badge-icon spin" /> In Progress</>}
                  {task.status === 'pending' && <><FaClock className="badge-icon" /> Planned</>}
                </span>
              </div>

              <div className="task-cell task-cell-title">
                <div className="task-title">{task.title}</div>
                {task.description && (
                  <div className="task-description">{task.description}</div>
                )}
              </div>

              <div className="task-cell task-cell-priority">
                <span className={`badge badge-priority-${task.priority}`}>
                  {task.priority === 'high' && <><FaFire className="badge-icon" /> High</>}
                  {task.priority === 'medium' && <><FaThermometerHalf className="badge-icon" /> Medium</>}
                  {task.priority === 'low' && <><FaSnowflake className="badge-icon" /> Low</>}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function TaskStats({ taskList }) {
  if (!taskList || !Array.isArray(taskList)) {
    return null;
  }
  
  const total = taskList.length;
  const completed = taskList.filter(task => task.status === 'completed').length;
  const active = taskList.filter(task => task.status === 'active').length;
  const pending = taskList.filter(task => task.status === 'pending').length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="stats-container">
      <div className="stat-box">
        <div className="stat-label">Total Tasks</div>
        <div className="stat-value">{total}</div>
      </div>
      <div className="stat-box">
        <div className="stat-label">Completed</div>
        <div className="stat-value stat-value-completed">{completed}</div>
      </div>
      <div className="stat-box">
        <div className="stat-label">In Progress</div>
        <div className="stat-value stat-value-active">{active}</div>
      </div>
      <div className="stat-box">
        <div className="stat-label">Planned</div>
        <div className="stat-value stat-value-pending">{pending}</div>
      </div>
      <div className="stat-box">
        <div className="stat-label">Progress</div>
        <div className="stat-value">{percentComplete}%</div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{width: `${percentComplete}%`}}></div>
        </div>
      </div>
    </div>
  );
}

function TaskTabs({ taskList }) {
  const [activeTab, setActiveTab] = useState('all');
  
  if (!taskList || !Array.isArray(taskList)) {
    return null;
  }
  
  const tabData = [
    { id: 'all', label: 'All Tasks', icon: <FaClipboardList />, count: taskList.length },
    { id: 'active', label: 'In Progress', icon: <FaSyncAlt className="spin" />, count: taskList.filter(t => t.status === 'active').length },
    { id: 'pending', label: 'Planned', icon: <FaClock />, count: taskList.filter(t => t.status === 'pending').length },
    { id: 'completed', label: 'Completed', icon: <FaCheckCircle />, count: taskList.filter(t => t.status === 'completed').length },
  ];
  
  return (
    <div className="task-tabs-container">
      <div className="task-tabs" role="tablist" aria-label="Task categories">
        {tabData.map(tab => (
          <button 
            key={tab.id}
            className={`task-tab ${activeTab === tab.id ? 'task-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tab-content-${tab.id}`}
            id={`tab-${tab.id}`}
          >
            <span className="task-tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="task-tab-label">{tab.label}</span>
            <span className="task-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>
      
      <div 
        className="task-tab-content" 
        role="tabpanel" 
        id={`tab-content-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'all' && <TaskList taskList={taskList} />}
        {activeTab === 'active' && <TaskList taskList={taskList} filterStatus="active" />}
        {activeTab === 'pending' && <TaskList taskList={taskList} filterStatus="pending" />}
        {activeTab === 'completed' && <TaskList taskList={taskList} filterStatus="completed" />}
      </div>
    </div>
  );
}


export default function TasksPage() {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig || {};

  const tasksPage = customFields?.tasksPage;
  const title = tasksPage.title;
  const description = tasksPage.description;
  const taskList = tasksPage.enable && tasksPage.taskList ? tasksPage.taskList : [];

  // If tasks are disabled, show a notice box instead
  if (!tasksPage || !tasksPage.enable) {
    return (
      <Layout title="Tasks are Disabled" description="Tasks are currently disabled">
        <div className="tasks-container">
          <div className="tasks-content">
            <div className="tasks-disabled-notice">
              <div className="disabled-icon">
                <FaExclamationTriangle aria-hidden="true" />
              </div>
              <h2 className="disabled-title">Tasks are currently disabled</h2>
              <p className="disabled-help">
                To enable tasks, set <code>tasks_page.enable</code> to <code>true</code>
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={title} description={description}>
      <Head>
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Head>

      <div className="tasks-container">
        <div className="tasks-header">
          <h1 className="tasks-heading">{title}</h1>
        </div>

        <div className="tasks-content">
          <TaskStats taskList={taskList} />
          <TaskTabs taskList={taskList} />
        </div>
      </div>
    </Layout>
  );
}
