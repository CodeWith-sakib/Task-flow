import { StatusDashboard, DashboardData } from '../../src/dashboard/StatusDashboard';
import { TaskStatus } from '../../src/types';

describe('StatusDashboard (UI & Screenshot Evidence Surface)', () => {
  it('should render structured HTML status dashboard with metrics and tasks', () => {
    const data: DashboardData = {
      uptimeSec: 3600,
      activeWorkers: 3,
      concurrency: 8,
      queueMetrics: {
        size: 15,
        inflight: 3,
        delayed: 2,
        deadLettered: 1,
        totalProcessed: 120,
      },
      tasksByStatus: {
        [TaskStatus.PENDING]: 5,
        [TaskStatus.QUEUED]: 10,
        [TaskStatus.RUNNING]: 3,
        [TaskStatus.SUCCESS]: 110,
        [TaskStatus.FAILED]: 10,
      },
      recentTasks: [
        {
          id: 'test_task_12345678',
          type: 'email_dispatch',
          payload: {},
          status: TaskStatus.RUNNING,
          retryCount: 0,
          maxRetries: 3,
          priority: 5,
          scheduledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      version: '1.0.0',
    };

    const html = StatusDashboard.renderHTML(data);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('TaskFlow Live Engine');
    expect(html).toContain('Queue Depth');
    expect(html).toContain('15');
    expect(html).toContain('3 / 8'); // Active / Concurrency
    expect(html).toContain('email_dispatch');
    expect(html).toContain('RUNNING');
  });
});
