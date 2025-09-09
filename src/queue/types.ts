export interface EnqueueOptions {
  priority?: number;
  delayMs?: number;
  maxDeliveries?: number;
  visibilityTimeoutMs?: number;
  metadata?: Record<string, any>;
}

export interface QueueMessage {
  id: string;
  taskId: string;
  priority: number;
  enqueuedAt: Date;
  visibleAfter: Date;
  deliveryCount: number;
  maxDeliveries: number;
  visibilityTimeoutMs: number;
  metadata?: Record<string, any>;
}

export interface DeadLetterItem {
  id: string;
  taskId: string;
  originalMessage: QueueMessage;
  failureReason: string;
  deadLetteredAt: Date;
  retryAttempts: number;
}

export interface DeadLetterPolicy {
  maxDeliveries: number;
  dlqName?: string;
  enabled: boolean;
}

export interface QueueMetrics {
  size: number;
  inflight: number;
  delayed: number;
  deadLettered: number;
  totalProcessed: number;
}

export interface IQueue {
  enqueue(taskId: string, priority?: number, options?: EnqueueOptions): Promise<string>;
  dequeue(): Promise<string | null>;
  ack(messageId: string): Promise<boolean>;
  nack(messageId: string, requeue?: boolean): Promise<boolean>;
  size(): Promise<number>;
  clear(): Promise<void>;
  getMetrics?(): Promise<QueueMetrics>;
}
