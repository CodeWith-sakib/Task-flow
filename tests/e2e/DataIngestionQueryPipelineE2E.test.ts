import { ColumnarTableStore } from '../../src/storage/columnar/ColumnarTableStore';
import { BitmapIndex } from '../../src/storage/indexing/BitmapIndex';
import { JoinEngine } from '../../src/query/execution/JoinEngine';
import { WindowFunctionExecutor } from '../../src/query/execution/WindowFunctions';
import { PrometheusExporter } from '../../src/observability/metrics/PrometheusExporter';

describe('Data Ingestion & Analytical Query Pipeline E2E', () => {
  it('should ingest records into columnar store, index attributes, execute join/window queries, and export metrics', () => {
    // 1. Ingest tasks into columnar store
    const table = new ColumnarTableStore(
      {
        taskId: 'STRING',
        workflowId: 'STRING',
        executionDurationMs: 'INT32',
        status: 'STRING',
      },
      10
    );

    const rows = [
      { taskId: 't-1', workflowId: 'wf-1', executionDurationMs: 120, status: 'SUCCESS' },
      { taskId: 't-2', workflowId: 'wf-1', executionDurationMs: 240, status: 'SUCCESS' },
      { taskId: 't-3', workflowId: 'wf-2', executionDurationMs: 310, status: 'FAILED' },
      { taskId: 't-4', workflowId: 'wf-2', executionDurationMs: 95, status: 'SUCCESS' },
    ];

    table.insertBatch(rows);
    expect(table.getTotalRowCount()).toBe(4);

    // 2. Index in BitmapIndex
    const bitmap = new BitmapIndex();
    for (const r of rows) {
      bitmap.indexEntity(r.taskId, {
        status: r.status,
        workflow: r.workflowId,
      });
    }

    const successInWf1 = bitmap.queryAnd([
      { attribute: 'status', value: 'SUCCESS' },
      { attribute: 'workflow', value: 'wf-1' },
    ]);
    expect(successInWf1).toEqual(['t-1', 't-2']);

    // 3. Join with workflow metadata
    const workflowMeta = [
      { wfId: 'wf-1', team: 'Analytics', priority: 'High' },
      { wfId: 'wf-2', team: 'Finance', priority: 'Critical' },
    ];

    const joinEngine = new JoinEngine();
    const joined = joinEngine.execute(rows, workflowMeta, {
      type: 'INNER',
      algorithm: 'HASH',
      conditions: [{ leftKey: 'workflowId', rightKey: 'wfId' }],
    });

    expect(joined.length).toBe(4);
    expect(joined[0].team).toBe('Analytics');

    // 4. Window function calculation
    const windowExec = new WindowFunctionExecutor();
    const ranked = windowExec.execute(joined, [
      {
        functionType: 'ROW_NUMBER',
        outputField: 'duration_rank',
        spec: {
          partitionBy: ['workflowId'],
          orderBy: [{ field: 'executionDurationMs', direction: 'DESC' }],
        },
      },
    ]);

    expect(ranked.find((r) => r.taskId === 't-2')?.duration_rank).toBe(1);
    expect(ranked.find((r) => r.taskId === 't-1')?.duration_rank).toBe(2);

    // 5. Export metrics
    const exporter = new PrometheusExporter();
    exporter.register('tasks_ingested_total', 'Total ingested tasks', 'counter', {}, 4);
    exporter.register('avg_duration_ms', 'Average task duration', 'gauge', {}, 191.25);

    const rendered = exporter.renderText();
    expect(rendered).toContain('tasks_ingested_total 4');
  });
});
