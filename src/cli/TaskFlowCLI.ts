import { TaskService } from '../core/TaskService';
import { VisibilityQueue } from '../queue/visibility/VisibilityQueue';
import { MetricsRegistry } from '../observability/metrics/MetricsRegistry';

export class TaskFlowCLI {
  constructor(
    private taskService: TaskService,
    private queue?: VisibilityQueue,
    private metrics?: MetricsRegistry
  ) {}

  async execute(args: string[]): Promise<{ exitCode: number; output: string }> {
    const command = args[0] || 'help';

    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        return {
          exitCode: 0,
          output: `TaskFlow CLI — Operator and Diagnostic Tooling

Usage:
  taskflow <command> [options]

Commands:
  submit <type> <payloadJson>   Submit a new task
  status <taskId>               Inspect task details and lifecycle state
  list [status]                 List all tasks optionally filtered by status
  queue-stats                   Display current queue depths and metrics
  dlq-list                      Inspect dead-lettered messages
  dlq-replay <dlqId>            Replay a dead-lettered task
  metrics                       Output Prometheus telemetry exposition
  health                        Run system health and connectivity check
  version                       Show CLI version
`,
        };

      case 'version':
      case '--version':
      case '-v':
        return { exitCode: 0, output: 'TaskFlow Engine CLI v1.0.0' };

      case 'health': {
        const tasks = await this.taskService.getAllTasks();
        return {
          exitCode: 0,
          output: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            totalTasksStored: tasks.length,
          }, null, 2),
        };
      }

      case 'submit': {
        const type = args[1];
        if (!type) return { exitCode: 1, output: 'Error: Task type required' };

        let payload: any = {};
        if (args[2]) {
          try {
            payload = JSON.parse(args[2]);
          } catch {
            return { exitCode: 1, output: 'Error: Invalid JSON payload' };
          }
        }

        const task = await this.taskService.createTask({ type, payload });
        return {
          exitCode: 0,
          output: `Task created successfully: ${task.id} (status: ${task.status})`,
        };
      }

      case 'status': {
        const taskId = args[1];
        if (!taskId) return { exitCode: 1, output: 'Error: Task ID required' };

        const task = await this.taskService.getTask(taskId);
        if (!task) return { exitCode: 1, output: `Error: Task '${taskId}' not found` };

        return { exitCode: 0, output: JSON.stringify(task, null, 2) };
      }

      case 'list': {
        const statusFilter = args[1];
        const tasks = statusFilter
          ? await this.taskService.getTasksByStatus(statusFilter as any)
          : await this.taskService.getAllTasks();

        return { exitCode: 0, output: JSON.stringify(tasks, null, 2) };
      }

      case 'queue-stats': {
        if (!this.queue) {
          return { exitCode: 0, output: 'Queue metrics unavailable in current profile' };
        }
        const metrics = await this.queue.getMetrics();
        return { exitCode: 0, output: JSON.stringify(metrics, null, 2) };
      }

      case 'dlq-list': {
        if (!this.queue) return { exitCode: 0, output: 'DLQ unavailable' };
        const dlqItems = await this.queue.getDLQ().list();
        return { exitCode: 0, output: JSON.stringify(dlqItems, null, 2) };
      }

      case 'dlq-replay': {
        const dlqId = args[1];
        if (!dlqId) return { exitCode: 1, output: 'Error: DLQ item ID required' };
        if (!this.queue) return { exitCode: 1, output: 'Error: Queue unavailable' };

        const replayed = await this.queue.getDLQ().replay(dlqId, async (taskId, priority) => {
          await this.queue!.enqueue(taskId, priority);
        });

        if (!replayed) {
          return { exitCode: 1, output: `Error: DLQ message '${dlqId}' not found` };
        }
        return { exitCode: 0, output: `Replayed message ${dlqId} back to queue` };
      }

      case 'metrics': {
        if (!this.metrics) return { exitCode: 0, output: '# Metrics unavailable\n' };
        return { exitCode: 0, output: this.metrics.exportPrometheusText() };
      }

      default:
        return { exitCode: 1, output: `Unknown command: '${command}'. Run 'taskflow help' for usage.` };
    }
  }
}
