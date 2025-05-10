import { DiskSpaceReclaimer } from '../../src/storage/DiskSpaceReclaimer';

describe('DiskSpaceReclaimer', () => {
  it('should identify stale and over-capacity files for deletion', () => {
    const reclaimer = new DiskSpaceReclaimer();
    const now = Date.now();
    const files = [
      { path: '/tmp/file1', sizeBytes: 1000, lastAccessedAt: now - 100000 },
      { path: '/tmp/file2', sizeBytes: 2000, lastAccessedAt: now - 1000 }
    ];

    const res = reclaimer.findReclaimable(files, 50000, 5000);
    expect(res.toDelete.length).toBe(1);
    expect(res.toDelete[0].path).toBe('/tmp/file1');
    expect(res.bytesFreed).toBe(1000);
  });
});
