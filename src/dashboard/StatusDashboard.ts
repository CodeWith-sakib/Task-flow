import { Task, TaskStatus } from '../types';
import { QueueMetrics } from '../queue/types';

export interface DashboardData {
  uptimeSec: number;
  activeWorkers: number;
  concurrency: number;
  queueMetrics: QueueMetrics;
  tasksByStatus: Record<TaskStatus, number>;
  recentTasks: Task[];
  version: string;
}

export class StatusDashboard {
  static renderHTML(data: DashboardData): string {
    const { uptimeSec, activeWorkers, concurrency, queueMetrics, tasksByStatus, recentTasks, version } = data;

    const statusRows = recentTasks.map(t => `
      <tr>
        <td style="font-family: monospace;">${t.id.substring(0, 8)}...</td>
        <td><strong>${t.type}</strong></td>
        <td><span class="badge status-${t.status}">${t.status.toUpperCase()}</span></td>
        <td>${t.priority ?? 0}</td>
        <td>${t.retryCount}/${t.maxRetries}</td>
        <td style="font-size: 0.85em; color: #666;">${new Date(t.createdAt).toLocaleTimeString()}</td>
      </tr>
    `).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskFlow Engine — Live Operations Dashboard</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --accent: #3b82f6;
      --border: #334155;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    h1 { margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .card-label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; }
    .card-value { font-size: 1.8rem; font-weight: 700; color: #ffffff; }
    table { width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #111827; font-size: 0.85rem; text-transform: uppercase; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .status-pending { background: #3b82f6; color: white; }
    .status-queued { background: #8b5cf6; color: white; }
    .status-running { background: #f59e0b; color: black; }
    .status-success { background: #10b981; color: white; }
    .status-failed { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚙️ TaskFlow Live Engine</h1>
      <div>v${version} | Uptime: ${Math.floor(uptimeSec)}s</div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-label">Queue Depth</div>
        <div class="card-value">${queueMetrics.size}</div>
      </div>
      <div class="card">
        <div class="card-label">Active Workers</div>
        <div class="card-value">${activeWorkers} / ${concurrency}</div>
      </div>
      <div class="card">
        <div class="card-label">In-Flight Tasks</div>
        <div class="card-value">${queueMetrics.inflight}</div>
      </div>
      <div class="card">
        <div class="card-label">Dead-Lettered (DLQ)</div>
        <div class="card-value" style="color: ${queueMetrics.deadLettered > 0 ? '#ef4444' : '#ffffff'};">${queueMetrics.deadLettered}</div>
      </div>
      <div class="card">
        <div class="card-label">Success Rate</div>
        <div class="card-value" style="color: #10b981;">
          ${tasksByStatus.success + tasksByStatus.failed > 0
            ? Math.round((tasksByStatus.success / (tasksByStatus.success + tasksByStatus.failed)) * 100) + '%'
            : '100%'}
        </div>
      </div>
    </div>

    <h2>Recent Task Activity</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Retries</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        ${statusRows.length > 0 ? statusRows : '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No tasks recorded yet</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }
}
