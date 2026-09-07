import { HierarchicalTimingWheel } from '../../src/scheduler/wheel/HierarchicalTimingWheel';
import { WindowFunctionExecutor } from '../../src/query/execution/WindowFunctions';
import { JoinEngine } from '../../src/query/execution/JoinEngine';
import { PriorityPartitionedQueue } from '../../src/queue/PriorityPartitionedQueue';

describe('Scheduler, Queue & Query Boundary Conditions', () => {
  describe('HierarchicalTimingWheel boundary checks', () => {
    it('should handle delay scheduling and fire on clock tick', () => {
      const now = Date.now();
      const wheel = new HierarchicalTimingWheel(10, 60, now);
      const expired: string[] = [];

      wheel.schedule('test-delay', 20, 'payload-0', () => expired.push('test-delay'));
      wheel.tick(now + 30);
      expect(expired).toContain('test-delay');
    });

    it('should handle cancel on non-existent or completed tasks', () => {
      const wheel = new HierarchicalTimingWheel(10, 60);
      expect(wheel.cancel('unknown-id')).toBe(false);

      wheel.schedule('task-1', 100, {}, () => {});
      expect(wheel.cancel('task-1')).toBe(true);
      expect(wheel.cancel('task-1')).toBe(false);
    });
  });

  describe('WindowFunctionExecutor boundary checks', () => {
    it('should handle empty dataset and empty window invocations', () => {
      const executor = new WindowFunctionExecutor();
      expect(executor.execute([], [])).toEqual([]);
      expect(executor.execute([{ id: 1 }], [])).toEqual([{ id: 1 }]);
    });

    it('should handle single partition with multiple window functions', () => {
      const executor = new WindowFunctionExecutor();
      const rows = [
        { id: 1, val: 100 },
        { id: 2, val: 200 },
      ];

      const res = executor.execute(rows, [
        {
          functionType: 'ROW_NUMBER',
          outputField: 'rn',
          spec: { orderBy: [{ field: 'val', direction: 'ASC' }] },
        },
      ]);

      expect(res.length).toBe(2);
      expect(res[0].rn).toBe(1);
      expect(res[1].rn).toBe(2);
    });
  });

  describe('JoinEngine boundary checks', () => {
    it('should handle empty left or right tables gracefully', () => {
      const joinEngine = new JoinEngine();
      const left = [{ id: 1, name: 'Alice' }];
      const right: any[] = [];

      const inner = joinEngine.execute(left, right, {
        type: 'INNER',
        conditions: [{ leftKey: 'id', rightKey: 'id' }],
      });
      expect(inner.length).toBe(0);

      const cross = joinEngine.execute(left, right, {
        type: 'CROSS',
        conditions: [],
      });
      expect(cross.length).toBe(0);
    });
  });

  describe('PriorityPartitionedQueue boundary checks', () => {
    it('should return undefined when popping from empty partition', () => {
      const queue = new PriorityPartitionedQueue<string>();
      expect(queue.popPartition('non-existent')).toBeUndefined();
      expect(queue.partitionSize('non-existent')).toBe(0);
    });
  });
});
