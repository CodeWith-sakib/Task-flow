export interface TrackedFile {
  path: string;
  sizeBytes: number;
  lastAccessedAt: number;
}

export class DiskSpaceReclaimer {
  public findReclaimable(files: TrackedFile[], maxAgeMs: number, targetMaxBytes: number): { toDelete: TrackedFile[]; bytesFreed: number } {
    const now = Date.now();
    const sorted = [...files].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    const toDelete: TrackedFile[] = [];
    let currentTotalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
    let bytesFreed = 0;

    for (const f of sorted) {
      const isStale = (now - f.lastAccessedAt) > maxAgeMs;
      const isOverCapacity = currentTotalBytes > targetMaxBytes;

      if (isStale || isOverCapacity) {
        toDelete.push(f);
        bytesFreed += f.sizeBytes;
        currentTotalBytes -= f.sizeBytes;
      }
    }

    return { toDelete, bytesFreed };
  }
}
