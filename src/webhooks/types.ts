export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: 'ACTIVE' | 'DISABLED';
  failureCount: number;
  maxConsecutiveFailures?: number;
  createdAt: Date;
}

export interface WebhookPayload {
  deliveryId: string;
  event: string;
  taskId: string;
  data: any;
  timestamp: string;
}

export interface WebhookDeliveryResult {
  deliveryId: string;
  subscriptionId: string;
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
  timestamp: Date;
}
