import { TransactionIsolationManager } from '../../src/storage/TransactionIsolationManager';

describe('TransactionIsolationManager', () => {
  it('should successfully commit non-conflicting transactions', () => {
    const manager = new TransactionIsolationManager();
    manager.beginTransaction('tx-1');
    manager.recordWrite('tx-1', 'account:A', 100);
    expect(manager.validateAndCommit('tx-1')).toBe(true);
  });

  it('should abort conflicting concurrent transactions', () => {
    const manager = new TransactionIsolationManager();
    const tx1 = manager.beginTransaction('tx-1');
    const tx2 = manager.beginTransaction('tx-2');

    manager.recordWrite('tx-1', 'row-1', 'value1');
    manager.recordWrite('tx-2', 'row-1', 'value2');

    // tx-1 commits first
    expect(manager.validateAndCommit('tx-1')).toBe(true);

    // tx-2 should detect conflict because row-1 was committed after tx2 snapshot
    tx2.snapshotTimestamp = 0; // ensure older
    expect(manager.validateAndCommit('tx-2')).toBe(false);
  });
});
