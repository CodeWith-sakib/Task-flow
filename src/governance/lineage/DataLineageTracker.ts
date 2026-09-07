/**
 * Enterprise Data Provenance & Lineage DAG Tracker.
 * Tracks dataset inputs, task execution transformations, and output dependencies,
 * providing recursive upstream root-cause and downstream blast-radius impact analysis.
 */

export interface LineageDataset {
  namespace: string;
  name: string;
  facets?: Record<string, any>;
}

export interface LineageJob {
  namespace: string;
  name: string;
  jobType: string;
}

export interface LineageRunEvent {
  runId: string;
  job: LineageJob;
  inputs: LineageDataset[];
  outputs: LineageDataset[];
  timestamp: number;
}

export class DataLineageTracker {
  private events: LineageRunEvent[] = [];
  private upstreamEdges = new Map<string, Set<string>>(); // dataset -> Set<dataset>
  private downstreamEdges = new Map<string, Set<string>>(); // dataset -> Set<dataset>

  public recordRun(event: LineageRunEvent): void {
    this.events.push(event);

    for (const out of event.outputs) {
      const outKey = `${out.namespace}:${out.name}`;

      for (const inp of event.inputs) {
        const inKey = `${inp.namespace}:${inp.name}`;

        // inKey -> outKey
        let down = this.downstreamEdges.get(inKey);
        if (!down) {
          down = new Set();
          this.downstreamEdges.set(inKey, down);
        }
        down.add(outKey);

        // outKey -> inKey
        let up = this.upstreamEdges.get(outKey);
        if (!up) {
          up = new Set();
          this.upstreamEdges.set(outKey, up);
        }
        up.add(inKey);
      }
    }
  }

  /**
   * Computes downstream blast-radius: all datasets transitively impacted by an input dataset.
   */
  public getDownstreamImpact(datasetKey: string): string[] {
    const visited = new Set<string>();
    const queue = [datasetKey];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const down = this.downstreamEdges.get(curr);
      if (down) {
        for (const target of down) {
          if (!visited.has(target)) {
            visited.add(target);
            queue.push(target);
          }
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * Computes upstream data sources: all original datasets contributing to this output.
   */
  public getUpstreamProvenance(datasetKey: string): string[] {
    const visited = new Set<string>();
    const queue = [datasetKey];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const up = this.upstreamEdges.get(curr);
      if (up) {
        for (const source of up) {
          if (!visited.has(source)) {
            visited.add(source);
            queue.push(source);
          }
        }
      }
    }

    return Array.from(visited);
  }

  public getEventCount(): number {
    return this.events.length;
  }
}
