import { WorkStealingPool } from '../../src/concurrency/WorkStealingPool';

describe('WorkStealingPool', () => {
  it('should steal tasks from busy workers when idle', () => {
    const pool = new WorkStealingPool<string>();
    pool.registerWorker('w1');
    pool.registerWorker('w2');

    pool.pushTask('w1', 'task-1');
    pool.pushTask('w1', 'task-2');

    // w2 is idle, should steal from w1
    expect(pool.popTask('w2')).toBe('task-1');
    // w1 pops remaining
    expect(pool.popTask('w1')).toBe('task-2');
    expect(pool.popTask('w1')).toBeUndefined();
  });
});
