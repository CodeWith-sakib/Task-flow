export interface DomainEvent<T = any> {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  payload: T;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * EventJournal stores immutable domain events with optimistic concurrency version checking
 * and aggregate-scoped event stream retrieval.
 */
export class EventJournal {
  private events: DomainEvent[] = [];
  private aggregateStreams: Map<string, DomainEvent[]> = new Map();
  private globalSequence: number = 0;

  public append(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: any,
    expectedVersion?: number,
    metadata?: Record<string, any>
  ): DomainEvent {
    let stream = this.aggregateStreams.get(aggregateId);
    if (!stream) {
      stream = [];
      this.aggregateStreams.set(aggregateId, stream);
    }

    const currentVersion = stream.length;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new Error(
        `Optimistic concurrency violation for aggregate '${aggregateId}': expected version ${expectedVersion}, got ${currentVersion}`
      );
    }

    this.globalSequence++;
    const version = currentVersion + 1;
    const event: DomainEvent = {
      eventId: `evt-${this.globalSequence}-${Date.now()}`,
      aggregateId,
      aggregateType,
      eventType,
      version,
      payload,
      metadata,
      timestamp: Date.now()
    };

    stream.push(event);
    this.events.push(event);
    return event;
  }

  public getEventsForAggregate(aggregateId: string, fromVersion: number = 1): DomainEvent[] {
    const stream = this.aggregateStreams.get(aggregateId);
    if (!stream) return [];
    return stream.filter(e => e.version >= fromVersion);
  }

  public getAllEvents(fromSequence: number = 0, limit: number = 100): DomainEvent[] {
    return this.events.slice(fromSequence, fromSequence + limit);
  }

  public getAggregateVersion(aggregateId: string): number {
    return this.aggregateStreams.get(aggregateId)?.length ?? 0;
  }

  public totalEvents(): number {
    return this.events.length;
  }
}
