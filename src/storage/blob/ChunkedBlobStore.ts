/**
 * Content-Addressed Chunked Blob Store.
 * Splits large workflow payloads, artifacts, and logs into fixed-size chunks,
 * computing SHA-256 content hashes for universal chunk-level deduplication.
 */

import * as crypto from 'crypto';

export interface BlobManifest {
  blobId: string;
  totalSizeBytes: number;
  chunkHashes: string[];
  createdAt: number;
  mimeType?: string;
}

export class ChunkedBlobStore {
  private chunks = new Map<string, Buffer>(); // chunkHash -> data
  private manifests = new Map<string, BlobManifest>(); // blobId -> manifest
  private chunkSize: number;

  constructor(chunkSize: number = 65536) {
    this.chunkSize = chunkSize;
  }

  public storeBlob(blobId: string, data: Buffer | string, mimeType?: string): BlobManifest {
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    const chunkHashes: string[] = [];

    for (let offset = 0; offset < dataBuf.length; offset += this.chunkSize) {
      const slice = dataBuf.slice(offset, offset + this.chunkSize);
      const hash = crypto.createHash('sha256').update(slice).digest('hex');

      if (!this.chunks.has(hash)) {
        this.chunks.set(hash, slice);
      }
      chunkHashes.push(hash);
    }

    const manifest: BlobManifest = {
      blobId,
      totalSizeBytes: dataBuf.length,
      chunkHashes,
      createdAt: Date.now(),
      mimeType,
    };

    this.manifests.set(blobId, manifest);
    return manifest;
  }

  public retrieveBlob(blobId: string): Buffer | null {
    const manifest = this.manifests.get(blobId);
    if (!manifest) return null;

    const parts: Buffer[] = [];
    for (const hash of manifest.chunkHashes) {
      const chunk = this.chunks.get(hash);
      if (!chunk) {
        throw new Error(`Corrupted blob ${blobId}: missing chunk ${hash}`);
      }
      parts.push(chunk);
    }

    return Buffer.concat(parts);
  }

  public deleteBlob(blobId: string): boolean {
    return this.manifests.delete(blobId);
  }

  public getManifest(blobId: string): BlobManifest | undefined {
    return this.manifests.get(blobId);
  }

  public getAllManifests(): BlobManifest[] {
    return Array.from(this.manifests.values());
  }

  public getChunkStore(): Map<string, Buffer> {
    return this.chunks;
  }
}
