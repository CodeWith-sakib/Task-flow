import { v4 as uuidv4 } from 'uuid';
import { WebhookSubscription, WebhookPayload, WebhookDeliveryResult } from './types';
import { WebhookCrypto } from './crypto/hmac';
import { CircuitBreaker } from './breaker/CircuitBreaker';

export type HttpTransport = (
  url: string,
  payload: string,
  headers: Record<string, string>
) => Promise<{ statusCode: number; body?: string }>;

export class WebhookDispatcher {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private transport: HttpTransport;

  constructor(transport?: HttpTransport) {
    this.transport = transport || this.defaultTransport;
  }

  private async defaultTransport(
    url: string,
    payload: string,
    headers: Record<string, string>
  ): Promise<{ statusCode: number }> {
    // In-process transport fallback
    return { statusCode: 200 };
  }

  registerSubscription(sub: Omit<WebhookSubscription, 'id' | 'failureCount' | 'createdAt'>): WebhookSubscription {
    const id = `sub_${uuidv4()}`;
    const fullSub: WebhookSubscription = {
      ...sub,
      id,
      failureCount: 0,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, fullSub);
    if (!this.circuitBreakers.has(fullSub.url)) {
      this.circuitBreakers.set(fullSub.url, new CircuitBreaker());
    }

    return fullSub;
  }

  removeSubscription(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getCircuitBreaker(url: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(url);
    if (!breaker) {
      breaker = new CircuitBreaker();
      this.circuitBreakers.set(url, breaker);
    }
    return breaker;
  }

  async dispatch(event: string, taskId: string, data: any): Promise<WebhookDeliveryResult[]> {
    const results: WebhookDeliveryResult[] = [];
    const matchingSubs = Array.from(this.subscriptions.values()).filter(
      s => s.status === 'ACTIVE' && (s.events.includes(event) || s.events.includes('*'))
    );

    for (const sub of matchingSubs) {
      const breaker = this.getCircuitBreaker(sub.url);
      const deliveryId = `dlv_${uuidv4()}`;

      if (!breaker.canExecute()) {
        results.push({
          deliveryId,
          subscriptionId: sub.id,
          success: false,
          latencyMs: 0,
          error: `Circuit breaker OPEN for URL: ${sub.url}`,
          timestamp: new Date(),
        });
        continue;
      }

      const payloadObj: WebhookPayload = {
        deliveryId,
        event,
        taskId,
        data,
        timestamp: new Date().toISOString(),
      };

      const payloadStr = JSON.stringify(payloadObj);
      const signature = WebhookCrypto.computeSignature(sub.secret, payloadStr);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-TaskFlow-Delivery': deliveryId,
        'X-TaskFlow-Event': event,
        'X-TaskFlow-Signature': `sha256=${signature}`,
      };

      const startTime = Date.now();
      try {
        const response = await this.transport(sub.url, payloadStr, headers);
        const latencyMs = Date.now() - startTime;

        if (response.statusCode >= 200 && response.statusCode < 300) {
          breaker.recordSuccess();
          sub.failureCount = 0;
          results.push({
            deliveryId,
            subscriptionId: sub.id,
            success: true,
            statusCode: response.statusCode,
            latencyMs,
            timestamp: new Date(),
          });
        } else {
          breaker.recordFailure();
          sub.failureCount++;
          results.push({
            deliveryId,
            subscriptionId: sub.id,
            success: false,
            statusCode: response.statusCode,
            latencyMs,
            error: `HTTP status ${response.statusCode}`,
            timestamp: new Date(),
          });
        }
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        breaker.recordFailure();
        sub.failureCount++;
        results.push({
          deliveryId,
          subscriptionId: sub.id,
          success: false,
          latencyMs,
          error: err?.message || 'Network error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }
}
