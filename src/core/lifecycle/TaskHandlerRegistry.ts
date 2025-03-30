import { TaskHandler, TaskPayload } from '../../types';

export class TaskHandlerRegistry {
  private handlers: Map<string, TaskHandler> = new Map();

  register(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  getHandler(taskType: string): TaskHandler | undefined {
    return this.handlers.get(taskType);
  }

  has(taskType: string): boolean {
    return this.handlers.has(taskType);
  }

  clear(): void {
    this.handlers.clear();
  }

  async executeHandler(taskType: string, payload: TaskPayload): Promise<any> {
    const handler = this.getHandler(taskType);
    if (!handler) {
      throw new Error(`No handler registered for task type: ${taskType}`);
    }

    return handler(payload);
  }
}
