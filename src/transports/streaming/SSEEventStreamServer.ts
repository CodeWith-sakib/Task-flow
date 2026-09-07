export interface SSEClient {
  id: string;
  tenantId: string;
  topics: Set<string>;
  send: (eventText: string) => void;
  lastEventId?: string;
  connectedAt: number;
}

export interface SSEMessage {
  id?: string;
  event?: string;
  data: any;
  retryMs?: number;
}

/**
 * SSEEventStreamServer manages real-time Server-Sent Events (SSE) streaming connections,
 * topic-based broadcast pub/sub, heartbeat pings, and reconnection catch-up.
 */
export class SSEEventStreamServer {
  private clients: Map<string, SSEClient> = new Map();
  private eventHistory: { id: string; topic: string; message: SSEMessage }[] = [];
  private maxHistorySize: number;
  private pingTimer: NodeJS.Timeout | null = null;
  private pingIntervalMs: number;

  constructor(maxHistorySize: number = 1000, pingIntervalMs: number = 15000) {
    this.maxHistorySize = maxHistorySize;
    this.pingIntervalMs = pingIntervalMs;
  }

  public registerClient(
    id: string,
    tenantId: string,
    sendFn: (data: string) => void,
    topics: string[] = ['*'],
    lastEventId?: string
  ): SSEClient {
    const client: SSEClient = {
      id,
      tenantId,
      topics: new Set(topics),
      send: sendFn,
      lastEventId,
      connectedAt: Date.now()
    };

    this.clients.set(id, client);

    // Send initial connection ACK
    client.send(`: connected at ${new Date().toISOString()}\n\n`);

    // Replay missed events if client reconnected with Last-Event-ID
    if (lastEventId) {
      this.replayMissedEvents(client, lastEventId);
    }

    return client;
  }

  public removeClient(id: string): void {
    this.clients.delete(id);
  }

  public publish(topic: string, message: SSEMessage, tenantId?: string): number {
    const eventId = message.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const formatted = this.formatSSE(message, eventId);

    // Save to history buffer for reconnection catch-up
    this.eventHistory.push({ id: eventId, topic, message });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    let recipientCount = 0;
    for (const client of this.clients.values()) {
      if (tenantId && client.tenantId !== tenantId) {
        continue;
      }
      if (client.topics.has('*') || client.topics.has(topic)) {
        try {
          client.send(formatted);
          client.lastEventId = eventId;
          recipientCount++;
        } catch {
          this.removeClient(client.id);
        }
      }
    }

    return recipientCount;
  }

  public startPing(): void {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        try {
          client.send(`: ping ${Date.now()}\n\n`);
        } catch {
          this.removeClient(client.id);
        }
      }
    }, this.pingIntervalMs);
  }

  public stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }

  private formatSSE(msg: SSEMessage, id: string): string {
    let output = '';
    output += `id: ${id}\n`;
    if (msg.event) output += `event: ${msg.event}\n`;
    if (msg.retryMs) output += `retry: ${msg.retryMs}\n`;
    const dataStr = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);
    output += `data: ${dataStr}\n\n`;
    return output;
  }

  private replayMissedEvents(client: SSEClient, lastEventId: string): void {
    const lastIdx = this.eventHistory.findIndex(e => e.id === lastEventId);
    if (lastIdx !== -1) {
      const missed = this.eventHistory.slice(lastIdx + 1);
      for (const item of missed) {
        if (client.topics.has('*') || client.topics.has(item.topic)) {
          client.send(this.formatSSE(item.message, item.id));
        }
      }
    }
  }
}
