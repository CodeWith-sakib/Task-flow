import { EventPayload, TaskEvent } from '../EventEmitter';

export interface StoredEvent extends EventPayload {
  sequence: number;
}

export class EventStore {
  private events: StoredEvent[] = [];
  private taskIndex: Map<string, number[]> = new Map();

  record(event: TaskEvent, payload: Omit<EventPayload, 'timestamp' | 'type'>): StoredEvent {
    const sequence = this.events.length + 1;
    const stored: StoredEvent = {
      ...payload,
      type: event,
      timestamp: new Date(),
      sequence,
    };
    this.events.push(stored);

    const indices = this.taskIndex.get(payload.taskId) || [];
    indices.push(sequence - 1);
    this.taskIndex.set(payload.taskId, indices);

    return stored;
  }

  getByTaskId(taskId: string): StoredEvent[] {
    const indices = this.taskIndex.get(taskId) || [];
    return indices.map(i => this.events[i]);
  }

  getStream(offset: number = 0, limit: number = 50): StoredEvent[] {
    return this.events.slice(offset, offset + limit);
  }

  count(): number {
    return this.events.length;
  }
}
