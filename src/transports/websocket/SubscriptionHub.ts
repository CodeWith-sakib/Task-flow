/**
 * Pub/Sub WebSocket Subscription Hub.
 * Maintains topic and wildcard subscriptions (`workflows.*`, `tasks.priority.>`),
 * routing live event broadcasts to registered client session handlers.
 */

export type SubscriptionCallback = (topic: string, message: any) => void;

export class SubscriptionHub {
  private exactSubscriptions = new Map<string, Set<string>>(); // topic -> Set<sessionId>
  private wildcardSubscriptions = new Map<string, Set<string>>(); // pattern -> Set<sessionId>
  private sessionCallbacks = new Map<string, SubscriptionCallback>();

  public registerSession(sessionId: string, callback: SubscriptionCallback): void {
    this.sessionCallbacks.set(sessionId, callback);
  }

  public unregisterSession(sessionId: string): void {
    this.sessionCallbacks.delete(sessionId);
    for (const set of this.exactSubscriptions.values()) {
      set.delete(sessionId);
    }
    for (const set of this.wildcardSubscriptions.values()) {
      set.delete(sessionId);
    }
  }

  public subscribe(sessionId: string, topicPattern: string): void {
    if (topicPattern.includes('*') || topicPattern.includes('>')) {
      let set = this.wildcardSubscriptions.get(topicPattern);
      if (!set) {
        set = new Set();
        this.wildcardSubscriptions.set(topicPattern, set);
      }
      set.add(sessionId);
    } else {
      let set = this.exactSubscriptions.get(topicPattern);
      if (!set) {
        set = new Set();
        this.exactSubscriptions.set(topicPattern, set);
      }
      set.add(sessionId);
    }
  }

  public unsubscribe(sessionId: string, topicPattern: string): void {
    this.exactSubscriptions.get(topicPattern)?.delete(sessionId);
    this.wildcardSubscriptions.get(topicPattern)?.delete(sessionId);
  }

  public publish(topic: string, message: any): number {
    const targetSessionIds = new Set<string>();

    // 1. Exact matches
    const exact = this.exactSubscriptions.get(topic);
    if (exact) {
      exact.forEach((id) => targetSessionIds.add(id));
    }

    // 2. Wildcard matches
    for (const [pattern, sessions] of this.wildcardSubscriptions.entries()) {
      if (this.matchPattern(pattern, topic)) {
        sessions.forEach((id) => targetSessionIds.add(id));
      }
    }

    // 3. Dispatch to sessions
    let deliveredCount = 0;
    for (const sessionId of targetSessionIds) {
      const cb = this.sessionCallbacks.get(sessionId);
      if (cb) {
        cb(topic, message);
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  private matchPattern(pattern: string, topic: string): boolean {
    const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+').replace(/>/g, '.*') + '$';
    const regex = new RegExp(regexStr);
    return regex.test(topic);
  }
}
