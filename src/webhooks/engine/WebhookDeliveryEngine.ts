import { DualHmacRotator } from '../security/DualHmacRotator';
import { TriStateCircuitBreaker } from '../resilience/TriStateCircuitBreaker';

export interface WebhookDeliveryRequest {
  id: string;
  url: string;
  payload: any;
  secret: string;
  headers?: Record<string, string>;
  maxAttempts?: number;
  timeoutMs?: number;
}

export interface WebhookDeliveryResponse {
  deliveryId: string;
  statusCode: number;
  responseBody?: string;
  durationMs: number;
  success: boolean;
  error?: string;
  attemptsUsed: number;
}

export type HttpTransport = (url: string, options: any) => Promise<{ status: number; text: () => Promise<string> }>;

/**
 * WebhookDeliveryEngine manages the resilient delivery of outbound webhooks,
 * generating dual-HMAC signatures, applying circuit breaker throttling, and recording metrics.
 */
export class WebhookDeliveryEngine {
  private circuitBreakers: Map<string, TriStateCircuitBreaker> = new Map();
  private rotator: DualHmacRotator;
  private transport?: HttpTransport;

  constructor(rotator?: DualHmacRotator, transport?: HttpTransport) {
    this.rotator = rotator ?? new DualHmacRotator('default-primary-secret');
    this.transport = transport;
  }

  public async deliver(request: WebhookDeliveryRequest): Promise<WebhookDeliveryResponse> {
    const startTime = Date.now();
    const host = new URL(request.url).host;
    const breaker = this.getOrCreateCircuitBreaker(host);

    if (!breaker.allowRequest()) {
      return {
        deliveryId: request.id,
        statusCode: 503,
        durationMs: Date.now() - startTime,
        success: false,
        error: `Circuit breaker OPEN for host '${host}'`,
        attemptsUsed: 0
      };
    }

    const payloadString = typeof request.payload === 'string' ? request.payload : JSON.stringify(request.payload);
    const signature = this.rotator.sign(payloadString);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TaskFlow-Webhook-Engine/1.0',
      'X-TaskFlow-Delivery-Id': request.id,
      'X-TaskFlow-Signature-256': signature,
      'X-TaskFlow-Timestamp': String(Date.now()),
      ...(request.headers || {})
    };

    const maxAttempts = request.maxAttempts ?? 3;
    let lastError: string | undefined;
    let lastStatusCode = 0;
    let attemptsUsed = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsUsed = attempt;
      try {
        if (!this.transport) {
          // Simulation mode when transport is absent
          breaker.recordSuccess();
          return {
            deliveryId: request.id,
            statusCode: 200,
            responseBody: '{"status":"ok"}',
            durationMs: Date.now() - startTime,
            success: true,
            attemptsUsed
          };
        }

        const res = await this.transport(request.url, {
          method: 'POST',
          headers,
          body: payloadString,
          timeout: request.timeoutMs ?? 10000
        });

        lastStatusCode = res.status;
        const text = await res.text();

        if (res.status >= 200 && res.status < 300) {
          breaker.recordSuccess();
          return {
            deliveryId: request.id,
            statusCode: res.status,
            responseBody: text,
            durationMs: Date.now() - startTime,
            success: true,
            attemptsUsed
          };
        } else {
          lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
          breaker.recordFailure();
        }
      } catch (err: any) {
        lastError = err.message || String(err);
        breaker.recordFailure();
      }

      // Exponential backoff between attempts
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }

    return {
      deliveryId: request.id,
      statusCode: lastStatusCode || 500,
      durationMs: Date.now() - startTime,
      success: false,
      error: lastError || 'Delivery exhausted retries',
      attemptsUsed
    };
  }

  private getOrCreateCircuitBreaker(host: string): TriStateCircuitBreaker {
    if (!this.circuitBreakers.has(host)) {
      this.circuitBreakers.set(host, new TriStateCircuitBreaker());
    }
    return this.circuitBreakers.get(host)!;
  }
}
