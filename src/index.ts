import express, { Express } from 'express';
import { DatabaseFactory } from './storage/db';
import { QueueFactory } from './queue/redis';
import { EventEmitter } from './events/EventEmitter';
import { StateTransitioner } from './core/state/StateTransitioner';
import { RetryManager } from './core/retry/RetryManager';
import { TaskScheduler } from './core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from './core/lifecycle/TaskHandlerRegistry';
import { TaskService } from './core/TaskService';
import { Worker } from './workers/Worker';
import { TaskController } from './api/controllers/TaskController';
import { createTaskRoutes } from './api/routes/taskRoutes';
import { errorHandler, requestLogger } from './middleware';
import { MetricsRegistry } from './observability/metrics/MetricsRegistry';
import { StatusDashboard } from './dashboard/StatusDashboard';

export class Application {
  private app: Express;
  private taskService: TaskService;
  private worker: Worker | null = null;
  private metricsRegistry: MetricsRegistry;
  private startTime: number = Date.now();

  constructor() {
    this.app = express();
    this.metricsRegistry = new MetricsRegistry();
    this.setupMiddleware();

    // Initialize components
    const db = DatabaseFactory.createDatabase();
    const queue = QueueFactory.createQueue();
    const eventEmitter = new EventEmitter();
    const stateTransitioner = new StateTransitioner();
    const retryManager = new RetryManager();
    const scheduler = new TaskScheduler();
    const handlerRegistry = new TaskHandlerRegistry();

    // Initialize task service
    this.taskService = new TaskService(
      db,
      queue,
      eventEmitter,
      stateTransitioner,
      retryManager,
      scheduler,
      handlerRegistry
    );

    // Initialize worker
    const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
    const timeout = parseInt(process.env.TASK_TIMEOUT_MS || '30000', 10);

    this.worker = new Worker(
      this.taskService,
      queue,
      db,
      eventEmitter,
      scheduler,
      handlerRegistry,
      concurrency,
      timeout
    );

    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(requestLogger);
  }

  private setupRoutes(): void {
    const controller = new TaskController(this.taskService);
    const routes = createTaskRoutes(controller);

    this.app.use('/api', routes);

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Prometheus Metrics
    this.app.get('/metrics', (req, res) => {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(this.metricsRegistry.exportPrometheusText());
    });

    // HTML Operations Dashboard
    this.app.get(['/status', '/dashboard'], async (req, res) => {
      try {
        const tasks = await this.taskService.getAllTasks();
        const counts: Record<string, number> = {
          pending: 0,
          queued: 0,
          running: 0,
          success: 0,
          failed: 0,
        };
        for (const t of tasks) {
          counts[t.status] = (counts[t.status] || 0) + 1;
        }

        const html = StatusDashboard.renderHTML({
          uptimeSec: (Date.now() - this.startTime) / 1000,
          activeWorkers: this.worker?.getActiveCount() ?? 0,
          concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
          queueMetrics: {
            size: counts.queued,
            inflight: this.worker?.getActiveCount() ?? 0,
            delayed: 0,
            deadLettered: 0,
            totalProcessed: counts.success + counts.failed,
          },
          tasksByStatus: counts as any,
          recentTasks: tasks.slice(-20).reverse(),
          version: '1.0.0',
        });
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (err: any) {
        res.status(500).send(`Failed to render status dashboard: ${err.message}`);
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    this.app.use(errorHandler);
  }

  getApp(): Express {
    return this.app;
  }

  getTaskService(): TaskService {
    return this.taskService;
  }

  getWorker(): Worker | null {
    return this.worker;
  }

  getMetricsRegistry(): MetricsRegistry {
    return this.metricsRegistry;
  }

  async start(port: number = 3000): Promise<void> {
    const server = this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // Start worker
    if (this.worker) {
      this.worker.start().catch(console.error);
    }

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      if (this.worker) {
        this.worker.stop();
      }
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  }
}
