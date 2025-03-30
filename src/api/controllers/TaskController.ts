import { Request, Response } from 'express';
import { TaskService } from '../../core/TaskService';
import { CreateTaskRequest } from '../../types';

export class TaskController {
  constructor(private taskService: TaskService) {}

  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const { type, payload, maxRetries, scheduledAt } = req.body;

      if (!type || !payload) {
        res.status(400).json({ error: 'type and payload are required' });
        return;
      }

      const request: CreateTaskRequest = {
        type,
        payload,
        maxRetries: maxRetries ?? 3,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      };

      const task = await this.taskService.createTask(request);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const task = await this.taskService.getTask(id);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.status(200).json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const tasks = await this.taskService.getAllTasks();
      res.status(200).json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTasksByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;

      if (!status || typeof status !== 'string') {
        res.status(400).json({ error: 'status query parameter is required' });
        return;
      }

      const tasks = await this.taskService.getTasksByStatus(status as any);
      res.status(200).json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async enqueueTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      await this.taskService.enqueueTask(id, priority ?? 0);

      const task = await this.taskService.getTask(id);
      res.status(200).json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
