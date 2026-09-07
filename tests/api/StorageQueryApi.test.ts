import { ColumnarTableStore } from '../../src/storage/columnar/ColumnarTableStore';
import { BitmapIndex } from '../../src/storage/indexing/BitmapIndex';
import { BPlusTreeIndex } from '../../src/storage/indexing/BPlusTreeIndex';

describe('Storage & Query REST API Endpoints', () => {
  it('should execute columnar analytical scan queries via API', () => {
    const table = new ColumnarTableStore({
      taskId: 'STRING',
      durationMs: 'INT32',
      status: 'STRING',
    });

    table.insertBatch([
      { taskId: 't-1', durationMs: 120, status: 'SUCCESS' },
      { taskId: 't-2', durationMs: 450, status: 'FAILED' },
      { taskId: 't-3', durationMs: 80, status: 'SUCCESS' },
    ]);

    const result = table.scan(['taskId', 'durationMs']);
    expect(result.length).toBe(3);
    expect(result[0].taskId).toBe('t-1');
    expect(result[1].durationMs).toBe(450);
  });

  it('should query multi-attribute filter tags via BitmapIndex API', () => {
    const bitmap = new BitmapIndex();
    bitmap.indexEntity('t-101', { tenant: 'alpha', priority: 'high', region: 'us-east' });
    bitmap.indexEntity('t-102', { tenant: 'alpha', priority: 'low', region: 'us-east' });
    bitmap.indexEntity('t-103', { tenant: 'beta', priority: 'high', region: 'eu-west' });

    const filtered = bitmap.queryAnd([
      { attribute: 'tenant', value: 'alpha' },
      { attribute: 'priority', value: 'high' },
    ]);

    expect(filtered).toEqual(['t-101']);
  });

  it('should execute range scan search via BPlusTreeIndex API', () => {
    const btree = new BPlusTreeIndex<number, string>(4);
    for (let p = 1; p <= 10; p++) {
      btree.insert(p * 10, `task-p${p}`);
    }

    const range = btree.rangeScan(30, 60);
    expect(range.length).toBe(4);
    expect(range[0].value).toBe('task-p3');
    expect(range[3].value).toBe('task-p6');
  });
});
