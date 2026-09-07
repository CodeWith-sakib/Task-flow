import { DAGValidator } from '../../src/workflows/dag/DAGValidator';
import { PriorityPartitionedQueue } from '../../src/queue/PriorityPartitionedQueue';
import { WorkerHeartbeatCoordinator } from '../../src/workers/telemetry/WorkerHeartbeatCoordinator';
import { MerkleAuditTree } from '../../src/security/audit/MerkleAuditTree';
import { WorkflowStateCheckpoint } from '../../src/workflows/WorkflowStateCheckpoint';
import { WorkflowDefinition } from '../../src/workflows/types';

describe('Distributed Workflow Execution E2E', () => {
  it('should validate, schedule, execute, checkpoint, and audit a multi-step workflow end-to-end', () => {
    // 1. Define and validate DAG workflow
    const workflow: WorkflowDefinition = {
      id: 'e2e-data-pipeline',
      name: 'ETL Pipeline',
      version: 1,
      steps: [
        { id: 'fetch-data', taskType: 'io_fetch', dependsOn: [] },
        { id: 'process-chunk-1', taskType: 'compute', dependsOn: ['fetch-data'] },
        { id: 'process-chunk-2', taskType: 'compute', dependsOn: ['fetch-data'] },
        { id: 'aggregate', taskType: 'reduce', dependsOn: ['process-chunk-1', 'process-chunk-2'] },
      ],
    };

    const valResult = DAGValidator.validate(workflow);
    expect(valResult.valid).toBe(true);
    expect(valResult.executionTiers.length).toBe(3);

    // 2. Queue steps per execution tier
    const queue = new PriorityPartitionedQueue<string>();
    for (const step of valResult.executionTiers[0]) {
      queue.push('partition-0', 10, step);
    }
    expect(queue.partitionSize('partition-0')).toBe(1);

    // 3. Worker heartbeat check
    const heartbeatCoord = new WorkerHeartbeatCoordinator(5000, 15000);
    const now = Date.now();
    heartbeatCoord.recordHeartbeat({
      workerId: 'worker-node-1',
      hostname: 'node-1.cluster.local',
      activeTasks: ['fetch-data'],
      maxCapacity: 4,
      cpuUsagePct: 25,
      freeMemoryBytes: 2 * 1024 * 1024 * 1024,
      timestamp: now,
    });

    const onlineWorkers = heartbeatCoord.getOnlineWorkers();
    expect(onlineWorkers.map((w) => w.workerId)).toContain('worker-node-1');

    // 4. Checkpoint step completion
    const checkpointer = new WorkflowStateCheckpoint();
    checkpointer.saveCheckpoint(workflow.id, 'fetch-data', { rowCount: 50000 });
    const cp = checkpointer.getCheckpoint(workflow.id);
    expect(cp?.lastCompletedStep).toBe('fetch-data');

    // 5. Append audit log
    const auditTree = new MerkleAuditTree();
    const auditRes = auditTree.append({
      id: 'audit-e2e-1',
      timestamp: now,
      actor: 'worker-node-1',
      action: 'step.completed',
      payloadHash: 'hash-fetch-data',
    });

    expect(auditRes.rootHash.length).toBe(64);
    expect(auditTree.size()).toBe(1);
  });
});
