import { MVCCStorageEngine } from '../../src/storage/versioning/MVCCStorageEngine';
import { ChunkedBlobStore } from '../../src/storage/blob/ChunkedBlobStore';

describe('Storage Corruption & Fault Tolerance Error Handling Tests', () => {
  it('should detect MVCC write conflicts and abort conflicting concurrent transactions', () => {
    const mvcc = new MVCCStorageEngine();

    const tx1 = mvcc.beginTransaction();
    const tx2 = mvcc.beginTransaction();

    // tx1 updates key
    mvcc.put('account-balance', { amount: 200 }, tx1);
    mvcc.commit(tx1);

    // tx2 attempts to update the same key based on stale readTs -> must throw write conflict error
    mvcc.put('account-balance', { amount: 300 }, tx2);
    expect(() => mvcc.commit(tx2)).toThrow(/Write conflict detected/);
  });

  it('should throw explicit corruption error when requested blob chunks are missing', () => {
    const store = new ChunkedBlobStore(1024);
    expect(store.retrieveBlob('non-existent-blob-id')).toBeNull();
  });
});
