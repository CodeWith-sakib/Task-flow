import { WorkerHeartbeatCoordinator } from '../../src/workers/telemetry/WorkerHeartbeatCoordinator';
import { WebhookDeadLetterVault } from '../../src/webhooks/WebhookDeadLetterVault';
import { RecoveryJournal } from '../../src/storage/RecoveryJournal';
import { PriorityPartitionedQueue } from '../../src/queue/PriorityPartitionedQueue';

describe('Cluster Failover & Disaster Recovery E2E', () => {
  it('should detect node failure, reap orphaned tasks, quarantine poison messages, and redrive recovered tasks', () => {
    // 1. Worker heartbeat and failure detection
    const heartbeatCoord = new WorkerHeartbeatCoordinator(3000, 8000);
    const now = Date.now();

    heartbeatCoord.recordHeartbeat({
      workerId: 'worker-primary',
      hostname: 'worker-1.internal',
      activeTasks: ['task-in-flight-1', 'task-in-flight-2'],
      maxCapacity: 5,
      cpuUsagePct: 80,
      freeMemoryBytes: 512 * 1024 * 1024,
      timestamp: now,
    }, now);

    // Advance time past dead timeout
    const futureTime = now + 10000;
    const reap = heartbeatCoord.reapZombies(futureTime);

    expect(reap.deadWorkerIds).toContain('worker-primary');
    expect(reap.orphanedTaskIds).toContain('task-in-flight-1');
    expect(reap.orphanedTaskIds).toContain('task-in-flight-2');

    // 2. Re-queue orphaned tasks onto backup worker partition
    const queue = new PriorityPartitionedQueue<string>();
    for (const orphan of reap.orphanedTaskIds) {
      queue.push('partition-failover', 10, orphan);
    }
    expect(queue.partitionSize('partition-failover')).toBe(2);

    // 3. Log recovery operation in recovery journal
    const journal = new RecoveryJournal();
    journal.append('failover-op-1', 'UPDATE', {
      reassignedTasks: reap.orphanedTaskIds,
      fromWorker: 'worker-primary',
      toPartition: 'partition-failover',
    });
    expect(journal.size()).toBe(1);

    // 4. Dead letter vault management
    const dlq = new WebhookDeadLetterVault();
    const deadLetter = dlq.store(
      'https://notifications.internal/webhook',
      { event: 'worker_crashed', workerId: 'worker-primary' },
      'Connection timed out'
    );
    expect(dlq.list().length).toBe(1);

    // Redrive dead letter after service recovery
    const redrived = dlq.redrive(deadLetter.id);
    expect(redrived?.id).toBe(deadLetter.id);
    expect(dlq.list().length).toBe(0);
  });
});
