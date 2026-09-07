/**
 * OpenLineage Standard Event Formatter & Exporter.
 * Formats data lineage run events to OpenLineage v1-0-2 standard JSON schemas
 * for consumption by Marquez, Apache Atlas, and OpenMetadata.
 */

import { LineageRunEvent } from './DataLineageTracker';

export interface OpenLineageEvent {
  eventType: 'START' | 'RUNNING' | 'COMPLETE' | 'FAIL';
  eventTime: string;
  run: {
    runId: string;
    facets: Record<string, any>;
  };
  job: {
    namespace: string;
    name: string;
    facets: Record<string, any>;
  };
  inputs: {
    namespace: string;
    name: string;
    facets: Record<string, any>;
  }[];
  outputs: {
    namespace: string;
    name: string;
    facets: Record<string, any>;
  }[];
  producer: string;
  schemaURL: string;
}

export class OpenLineageExporter {
  public formatEvent(event: LineageRunEvent, eventType: OpenLineageEvent['eventType'] = 'COMPLETE'): OpenLineageEvent {
    return {
      eventType,
      eventTime: new Date(event.timestamp).toISOString(),
      run: {
        runId: event.runId,
        facets: {
          nominalTime: {
            nominalStartTime: new Date(event.timestamp).toISOString(),
          },
        },
      },
      job: {
        namespace: event.job.namespace,
        name: event.job.name,
        facets: {
          jobType: {
            processingType: 'BATCH',
            integration: 'TASKFLOW',
            jobType: event.job.jobType,
          },
        },
      },
      inputs: event.inputs.map((inp) => ({
        namespace: inp.namespace,
        name: inp.name,
        facets: inp.facets || {},
      })),
      outputs: event.outputs.map((out) => ({
        namespace: out.namespace,
        name: out.name,
        facets: out.facets || {},
      })),
      producer: 'https://github.com/CodeWith-sakib/Task-flow',
      schemaURL: 'https://openlineage.io/spec/1-0-2/OpenLineage.json#/definitions/RunEvent',
    };
  }

  public exportBatch(events: LineageRunEvent[]): string {
    return events.map((e) => JSON.stringify(this.formatEvent(e))).join('\n');
  }
}
