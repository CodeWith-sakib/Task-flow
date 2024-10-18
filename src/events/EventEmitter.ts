import { Task } from '../types';

export enum TaskEvent {
  CREATED = 'task_created',
  STARTED = 'task_started',
  COMPLETED = 'task_completed',
  FAILED = 'task_failed',
  RETRYING = 'task_retrying',
}

export interface EventPayload {
  taskId: string;
  type: string;
  timestamp: Date;
  data?: any;
}

export class EventEmitter {
  private listeners: Map<TaskEvent, ((payload: EventPayload) => void)[]> = new Map();

  on(event: TaskEvent, handler: (payload: EventPayload) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: TaskEvent, handler: (payload: EventPayload) => void): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  async emit(event: TaskEvent, payload: Omit<EventPayload, 'timestamp' | 'type'>): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const eventPayload: EventPayload = {
      ...payload,
      type: event,
      timestamp: new Date(),
    };

    for (const handler of handlers) {
      try {
        handler(eventPayload);
      } catch (error) {
        console.error(`Handler failed for event ${event}:`, error);
      }
    }
  }

  clearAllListeners(): void {
    this.listeners.clear();
  }
}
