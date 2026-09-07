import * as fs from 'fs';
import * as path from 'path';
import { ColumnarTableStore } from '../../src/storage/columnar/ColumnarTableStore';
import { BPlusTreeIndex } from '../../src/storage/indexing/BPlusTreeIndex';
import { BitmapIndex } from '../../src/storage/indexing/BitmapIndex';
import { GorillaTimeSeriesCodec } from '../../src/storage/timeseries/GorillaTimeSeriesCodec';
import { MVCCStorageEngine } from '../../src/storage/versioning/MVCCStorageEngine';
import { JoinEngine } from '../../src/query/execution/JoinEngine';
import { VectorizedBatchExecutor, VectorBatch } from '../../src/query/engine/VectorizedBatchExecutor';
import { WindowFunctionExecutor } from '../../src/query/execution/WindowFunctions';

describe('StorageEngine & Query Integration Tests', () => {
  const testDir = path.join(__dirname, '../temp_storage_integration');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should write and scan columnar table chunks with compression', () => {
    const table = new ColumnarTableStore(
      {
        id: 'STRING',
        priority: 'INT32',
        status: 'STRING',
      },
      50
    );

    const rows = [];
    for (let i = 0; i < 120; i++) {
      rows.push({
        id: `t-${i}`,
        priority: (i % 5) * 10,
        status: i % 2 === 0 ? 'SUCCESS' : 'PENDING',
      });
    }

    table.insertBatch(rows);
    expect(table.getTotalRowCount()).toBe(120);
    expect(table.getSegmentCount()).toBe(2); // 50 + 50 flushed, 20 buffered

    const scanResult = table.scan(['id', 'priority']);
    expect(scanResult.length).toBe(120);
    expect(scanResult[0].id).toBe('t-0');
  });

  it('should index and range-scan items with BPlusTree and BitmapIndex', () => {
    const btree = new BPlusTreeIndex<number, string>(4);
    const bitmap = new BitmapIndex();

    for (let i = 1; i <= 50; i++) {
      btree.insert(i, `val-${i}`);
      bitmap.indexEntity(`item-${i}`, {
        parity: i % 2 === 0 ? 'even' : 'odd',
        div: i % 5 === 0 ? 'div5' : 'other',
      });
    }

    const range = btree.rangeScan(10, 20);
    expect(range.length).toBe(11);
    expect(range[0].value).toBe('val-10');
    expect(range[10].value).toBe('val-20');

    const evenAndDiv5 = bitmap.queryAnd([
      { attribute: 'parity', value: 'even' },
      { attribute: 'div', value: 'div5' },
    ]);
    expect(evenAndDiv5).toContain('item-10');
    expect(evenAndDiv5).toContain('item-20');
    expect(evenAndDiv5).toContain('item-30');
    expect(evenAndDiv5).toContain('item-40');
    expect(evenAndDiv5).toContain('item-50');
    expect(evenAndDiv5.length).toBe(5);
  });

  it('should encode and decode time-series metrics with Gorilla compression', () => {
    const codec = new GorillaTimeSeriesCodec();
    const baseTime = 1700000000;
    const series = [
      { timestamp: baseTime, value: 42.5 },
      { timestamp: baseTime + 10, value: 42.8 },
      { timestamp: baseTime + 20, value: 43.1 },
      { timestamp: baseTime + 30, value: 43.1 },
      { timestamp: baseTime + 40, value: 42.0 },
    ];

    const compressed = codec.compress(series);
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = codec.decompress(compressed, series.length);
    expect(decompressed.length).toBe(series.length);
    for (let i = 0; i < series.length; i++) {
      expect(decompressed[i].timestamp).toBe(series[i].timestamp);
      expect(decompressed[i].value).toBeCloseTo(series[i].value, 4);
    }
  });

  it('should manage multi-version concurrency control (MVCC) with snapshot isolation', () => {
    const mvcc = new MVCCStorageEngine();

    const tx1 = mvcc.beginTransaction();
    mvcc.put('user:100', { name: 'Alice', balance: 500 }, tx1);
    mvcc.commit(tx1);

    const tx2 = mvcc.beginTransaction();
    const snap1 = mvcc.get('user:100', tx2);
    expect((snap1 as any)?.balance).toBe(500);

    const tx3 = mvcc.beginTransaction();
    mvcc.put('user:100', { name: 'Alice', balance: 750 }, tx3);
    mvcc.commit(tx3);

    // tx2 snapshot isolation should still read 500
    const snap2 = mvcc.get('user:100', tx2);
    expect((snap2 as any)?.balance).toBe(500);
    mvcc.commit(tx2);

    // New transaction reads updated balance
    const tx4 = mvcc.beginTransaction();
    const snap4 = mvcc.get('user:100', tx4);
    expect((snap4 as any)?.balance).toBe(750);
    mvcc.commit(tx4);
  });

  it('should execute hash joins across datasets', () => {
    const leftRecords = [
      { taskId: '1', workflowId: 'wf-A', cost: 10 },
      { taskId: '2', workflowId: 'wf-A', cost: 20 },
      { taskId: '3', workflowId: 'wf-B', cost: 30 },
    ];

    const rightRecords = [
      { wfId: 'wf-A', team: 'Platform' },
      { wfId: 'wf-B', team: 'DataEng' },
      { wfId: 'wf-C', team: 'Infra' },
    ];

    const joinEngine = new JoinEngine();
    const joined = joinEngine.execute(leftRecords, rightRecords, {
      type: 'INNER',
      algorithm: 'HASH',
      conditions: [{ leftKey: 'workflowId', rightKey: 'wfId' }],
    });

    expect(joined.length).toBe(3);
    expect(joined[0].taskId).toBe('1');
    expect(joined[0].team).toBe('Platform');
  });

  it('should filter vectorized batch columns efficiently', () => {
    const intCols = new Map<string, Int32Array>();
    intCols.set('priority', new Int32Array([10, 50, 20, 80, 5]));

    const batch: VectorBatch = {
      size: 5,
      intColumns: intCols,
      floatColumns: new Map(),
      selectedCount: 5,
    };

    const executor = new VectorizedBatchExecutor();
    executor.filterGreaterThanInt(batch, 'priority', 25);

    expect(batch.selectedCount).toBe(2);
    expect(batch.selectionVector?.[0]).toBe(1); // 50
    expect(batch.selectionVector?.[1]).toBe(3); // 80
  });

  it('should calculate window functions over analytical partitions', () => {
    const data = [
      { dept: 'eng', salary: 100 },
      { dept: 'eng', salary: 150 },
      { dept: 'eng', salary: 200 },
      { dept: 'sales', salary: 80 },
      { dept: 'sales', salary: 120 },
    ];

    const executor = new WindowFunctionExecutor();
    const result = executor.execute(data, [
      {
        functionType: 'ROW_NUMBER',
        outputField: 'row_num',
        spec: {
          partitionBy: ['dept'],
          orderBy: [{ field: 'salary', direction: 'DESC' }],
        },
      },
    ]);

    expect(result.length).toBe(5);
    expect(result[0].row_num).toBe(1);
    expect(result[0].salary).toBe(200);
  });
});
