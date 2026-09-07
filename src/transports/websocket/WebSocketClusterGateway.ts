/**
 * Multiplexed WebSocket Cluster Gateway.
 * Manages active client WebSocket connections, frame protocol parsing,
 * heartbeat pings, and reconnection message replay buffers.
 */

import { SubscriptionHub } from './SubscriptionHub';

export interface WebSocketClientSession {
  sessionId: string;
  userId: string;
  connectedAt: number;
  lastPingAt: number;
  messageBuffer: any[];
}

export class WebSocketClusterGateway {
  private sessions = new Map<string, WebSocketClientSession>();
  private hub = new SubscriptionHub();
  private maxReplayBufferSize: number;

  constructor(maxReplayBufferSize: number = 100) {
    this.maxReplayBufferSize = maxReplayBufferSize;
  }

  public getHub(): SubscriptionHub {
    return this.hub;
  }

  public handleConnection(sessionId: string, userId: string): WebSocketClientSession {
    const session: WebSocketClientSession = {
      sessionId,
      userId,
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
      messageBuffer: [],
    };

    this.sessions.set(sessionId, session);
    this.hub.registerSession(sessionId, (topic, msg) => {
      this.bufferMessage(session, { topic, msg, timestamp: Date.now() });
    });

    return session;
  }

  public handleDisconnection(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.hub.unregisterSession(sessionId);
  }

  public handleIncomingFrame(
    sessionId: string,
    frame: { type: 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PING' | 'REPLAY'; topic?: string; fromTimestamp?: number }
  ): any {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found' };

    switch (frame.type) {
      case 'SUBSCRIBE':
        if (frame.topic) {
          this.hub.subscribe(sessionId, frame.topic);
          return { status: 'SUBSCRIBED', topic: frame.topic };
        }
        break;

      case 'UNSUBSCRIBE':
        if (frame.topic) {
          this.hub.unsubscribe(sessionId, frame.topic);
          return { status: 'UNSUBSCRIBED', topic: frame.topic };
        }
        break;

      case 'PING':
        session.lastPingAt = Date.now();
        return { type: 'PONG', timestamp: session.lastPingAt };

      case 'REPLAY': {
        const fromTs = frame.fromTimestamp || 0;
        const replayed = session.messageBuffer.filter((m) => m.timestamp >= fromTs);
        return { type: 'REPLAY_RESPONSE', messages: replayed };
      }
    }

    return { error: 'Invalid frame' };
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  private bufferMessage(session: WebSocketClientSession, msg: any): void {
    session.messageBuffer.push(msg);
    if (session.messageBuffer.length > this.maxReplayBufferSize) {
      session.messageBuffer.shift();
    }
  }
}
