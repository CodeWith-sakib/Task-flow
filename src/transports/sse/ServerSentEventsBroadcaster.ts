/**
 * Server-Sent Events (SSE) Broadcaster.
 * Manages HTTP text/event-stream connections, periodic comment keepalive heartbeats (:ping),
 * monotonic `id:` sequencing, and client `Last-Event-ID` reconnection catchup.
 */

export interface SSEClientConnection {
  connectionId: string;
  channel: string;
  lastEventId: number;
  sendRaw: (data: string) => void;
  connectedAt: number;
}

export interface SSEEvent {
  id: number;
  event?: string;
  data: any;
  retry?: number;
}

export class ServerSentEventsBroadcaster {
  private clients = new Map<string, SSEClientConnection>();
  private history = new Map<string, SSEEvent[]>(); // channel -> events
  private nextEventId = 1;
  private maxHistoryPerChannel: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(maxHistoryPerChannel: number = 200) {
    this.maxHistoryPerChannel = maxHistoryPerChannel;
  }

  public registerClient(client: SSEClientConnection, lastEventId?: number): void {
    this.clients.set(client.connectionId, client);

    // Replay missed events if Last-Event-ID was provided
    if (lastEventId !== undefined && lastEventId > 0) {
      const channelEvents = this.history.get(client.channel) || [];
      for (const evt of channelEvents) {
        if (evt.id > lastEventId) {
          client.sendRaw(this.formatSSE(evt));
        }
      }
    }
  }

  public unregisterClient(connectionId: string): void {
    this.clients.delete(connectionId);
  }

  public broadcast(channel: string, eventName: string, payload: any): number {
    const event: SSEEvent = {
      id: this.nextEventId++,
      event: eventName,
      data: payload,
    };

    // Buffer in channel history
    let channelHistory = this.history.get(channel);
    if (!channelHistory) {
      channelHistory = [];
      this.history.set(channel, channelHistory);
    }
    channelHistory.push(event);
    if (channelHistory.length > this.maxHistoryPerChannel) {
      channelHistory.shift();
    }

    const formatted = this.formatSSE(event);
    let delivered = 0;

    for (const client of this.clients.values()) {
      if (client.channel === channel || client.channel === '*') {
        client.sendRaw(formatted);
        delivered++;
      }
    }

    return delivered;
  }

  public startHeartbeat(intervalMs: number = 15000): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients.values()) {
        client.sendRaw(': heartbeat\n\n');
      }
    }, intervalMs);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  private formatSSE(evt: SSEEvent): string {
    let out = `id: ${evt.id}\n`;
    if (evt.event) {
      out += `event: ${evt.event}\n`;
    }
    if (evt.retry) {
      out += `retry: ${evt.retry}\n`;
    }
    const dataStr = typeof evt.data === 'string' ? evt.data : JSON.stringify(evt.data);
    out += `data: ${dataStr}\n\n`;
    return out;
  }
}
