import { TaskPriorityCoordinator } from '../../src/concurrency/TaskPriorityCoordinator';

describe('TaskPriorityCoordinator', () => {
  it('should boost priority of starved tasks', () => {
    const coordinator = new TaskPriorityCoordinator(1000);
    const now = 5000;
    const task = { id: 't1', basePriority: 5, enqueuedAt: now - 3500 };

    const effective = coordinator.calculateEffectivePriority(task, now);
    expect(effective).toBe(35); // 5 + 3 * 10
  });
});
