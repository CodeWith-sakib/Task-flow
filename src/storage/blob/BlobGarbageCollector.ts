/**
 * Mark-and-Sweep Blob Garbage Collector.
 * Scans active blob manifests to compute reachable chunk reference sets,
 * sweeping and freeing orphaned/unreferenced chunks from CAS storage.
 */

import { ChunkedBlobStore } from './ChunkedBlobStore';

export interface GCReport {
  scannedManifests: number;
  referencedChunks: number;
  totalChunksBefore: number;
  purgedChunks: number;
  reclaimedBytes: number;
  durationMs: number;
}

export class BlobGarbageCollector {
  private blobStore: ChunkedBlobStore;

  constructor(blobStore: ChunkedBlobStore) {
    this.blobStore = blobStore;
  }

  public runSweep(): GCReport {
    const startTime = Date.now();
    const chunkStore = this.blobStore.getChunkStore();
    const totalChunksBefore = chunkStore.size;

    // 1. Mark Phase: Collect all referenced chunk hashes from manifests
    const referencedChunks = new Set<string>();
    const manifests = this.blobStore.getAllManifests();

    for (const manifest of manifests) {
      for (const hash of manifest.chunkHashes) {
        referencedChunks.add(hash);
      }
    }

    // 2. Sweep Phase: Delete unreferenced chunks
    let purgedChunks = 0;
    let reclaimedBytes = 0;

    for (const [hash, chunk] of chunkStore.entries()) {
      if (!referencedChunks.has(hash)) {
        reclaimedBytes += chunk.length;
        chunkStore.delete(hash);
        purgedChunks++;
      }
    }

    return {
      scannedManifests: manifests.length,
      referencedChunks: referencedChunks.size,
      totalChunksBefore,
      purgedChunks,
      reclaimedBytes,
      durationMs: Date.now() - startTime,
    };
  }
}
