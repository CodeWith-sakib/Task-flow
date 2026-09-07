import { LocalityAwareTaskDispatcher } from '../../src/workers/dispatcher/LocalityAwareTaskDispatcher';
import { PredictiveWorkerAutoscaler } from '../../src/workers/autoscaling/PredictiveWorkerAutoscaler';
import { WorkerResourceMonitor } from '../../src/workers/isolation/WorkerResourceMonitor';
import { WorkerHeartbeatCoordinator } from '../../src/workers/telemetry/WorkerHeartbeatCoordinator';

describe('Workers & Execution Subsystems Integration Tests', () => {
  it('should dispatch tasks based on data locality and affinity', () => {
    const dispatcher = new LocalityAwareTaskDispatcher();
    dispatcher.registerWorker({
      workerId: 'worker-zone-1',
      nodeRegion: 'us-east-1',
      cachedDatasetKeys: new Set(['dataset-alpha']),
      cpuUsagePct: 20,
      availableMemoryBytes: 4 * 1024 * 1024 * 1024,
      activeTasks: 1,
      maxTasks: 10,
      tags: ['gpu'],
    });

    dispatcher.registerWorker({
      workerId: 'worker-zone-2',
      nodeRegion: 'us-west-1',
      cachedDatasetKeys: new Set(['dataset-beta']),
      cpuUsagePct: 15,
      availableMemoryBytes: 4 * 1024 * 1024 * 1024,
      activeTasks: 1,
      maxTasks: 10,
      tags: ['cpu'],
    });

    const match = dispatcher.selectBestWorker({
      taskId: 't-loc-1',
      requiredDataKeys: ['dataset-alpha'],
      preferredRegion: 'us-east-1',
    });

    expect(match?.workerId).toBe('worker-zone-1');
  });

  it('should scale worker pools predictively based on queue arrival velocity', () => {
    const autoscaler = new PredictiveWorkerAutoscaler({
      minWorkers: 2,
      maxWorkers: 20,
      targetQueueLatencySec: 5,
      scaleUpCooldownSec: 0,
      scaleDownCooldownSec: 0,
      taskDurationSec: 2,
    });

    autoscaler.recordArrivalRate(25);
    const decision = autoscaler.evaluate(50);
    expect(decision.targetWorkers).toBeGreaterThan(2);
    expect(decision.action).toBe('SCALE_UP');
  });

  it('should monitor worker resource usage and detect degraded state', () => {
    const monitor = new WorkerResourceMonitor('worker-1', 512, 2000);
    const stats = monitor.getStats(10);
    expect(stats.workerId).toBe('worker-1');
    expect(stats.status).toBe('HEALTHY');
  });

  it('should track heartbeats and reap dead zombie worker nodes', () => {
    const heartbeatCoord = new WorkerHeartbeatCoordinator(5000, 15000);
    const now = Date.now();

    heartbeatCoord.recordHeartbeat({
      workerId: 'worker-healthy',
      hostname: 'node-1.internal',
      activeTasks: ['t-1'],
      maxCapacity: 10,
      cpuUsagePct: 30,
      freeMemoryBytes: 1024 * 1024 * 1024,
      timestamp: now,
    }, now);

    heartbeatCoord.recordHeartbeat({
      workerId: 'worker-stale',
      hostname: 'node-2.internal',
      activeTasks: ['t-2', 't-3'],
      maxCapacity: 10,
      cpuUsagePct: 10,
      freeMemoryBytes: 1024 * 1024 * 1024,
      timestamp: now - 20000,
    }, now - 20000);

    const reapResult = heartbeatCoord.reapZombies(now);
    expect(reapResult.deadWorkerIds).toContain('worker-stale');
    expect(reapResult.orphanedTaskIds).toContain('t-2');
    expect(reapResult.orphanedTaskIds).toContain('t-3');
  });
});
