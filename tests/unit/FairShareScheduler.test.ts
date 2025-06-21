import { FairShareScheduler } from '../../src/queue/FairShareScheduler';

describe('FairShareScheduler', () => {
  it('should interleave tasks across tenants fairly', () => {
    const scheduler = new FairShareScheduler<string>();
    scheduler.enqueue('t1', 't1-task1');
    scheduler.enqueue('t1', 't1-task2');
    scheduler.enqueue('t2', 't2-task1');

    const first = scheduler.scheduleNext();
    expect(first?.tenantId).toBe('t1');
    expect(first?.item).toBe('t1-task1');

    const second = scheduler.scheduleNext();
    expect(second?.tenantId).toBe('t2');
    expect(second?.item).toBe('t2-task1');

    const third = scheduler.scheduleNext();
    expect(third?.tenantId).toBe('t1');
    expect(third?.item).toBe('t1-task2');
  });
});
