import { DomainEvent } from './EventJournal';

export type ProjectionHandler = (event: DomainEvent, state: any) => Promise<any> | any;

export interface ProjectionDefinition {
  name: string;
  initialState: () => any;
  handlers: Record<string, ProjectionHandler>;
}

/**
 * ProjectionEngine drives asynchronous materialized view projections from raw domain event streams.
 */
export class ProjectionEngine {
  private projections: Map<string, { definition: ProjectionDefinition; state: any; lastProcessedSeq: number }> = new Map();

  public registerProjection(definition: ProjectionDefinition): void {
    this.projections.set(definition.name, {
      definition,
      state: definition.initialState(),
      lastProcessedSeq: 0
    });
  }

  public async processEvent(event: DomainEvent): Promise<void> {
    for (const [, proj] of this.projections.entries()) {
      const handler = proj.definition.handlers[event.eventType];
      if (handler) {
        try {
          const newState = await handler(event, proj.state);
          if (newState !== undefined) {
            proj.state = newState;
          }
          proj.lastProcessedSeq++;
        } catch {
          // Log projection handler error and continue
        }
      }
    }
  }

  public async replayEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event);
    }
  }

  public getState(projectionName: string): any {
    return this.projections.get(projectionName)?.state;
  }

  public reset(projectionName?: string): void {
    if (projectionName) {
      const proj = this.projections.get(projectionName);
      if (proj) {
        proj.state = proj.definition.initialState();
        proj.lastProcessedSeq = 0;
      }
    } else {
      for (const proj of this.projections.values()) {
        proj.state = proj.definition.initialState();
        proj.lastProcessedSeq = 0;
      }
    }
  }
}
