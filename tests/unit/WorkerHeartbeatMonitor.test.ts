import { WorkerHeartbeatMonitor } from '../../src/concurrency/WorkerHeartbeatMonitor';

describe('WorkerHeartbeatMonitor', () => {
  it('should detect workers that missed their heartbeat window', () => {
    const monitor = new WorkerHeartbeatMonitor(5000);
    const now = 10000;
    monitor.recordHeartbeat('w1', now - 1000);
    monitor.recordHeartbeat('w2', now - 6000);

    const dead = monitor.getDeadWorkers(now);
    expect(dead).toEqual(['w2']);
  });
});
