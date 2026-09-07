import * as crypto from 'crypto';

export interface BlobMetadata {
  hash: string;
  sizeBytes: number;
  mimeType?: string;
  createdAt: number;
  refCount: number;
}

/**
 * ContentAddressableStore provides immutable, content-addressed blob storage for workflow
 * task payloads, binary artifacts, and intermediate step outputs with SHA-256 deduplication.
 */
export class ContentAddressableStore {
  private blobs: Map<string, Buffer> = new Map();
  private metadata: Map<string, BlobMetadata> = new Map();

  public put(content: Buffer | string, mimeType?: string): string {
    const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    if (this.metadata.has(hash)) {
      const meta = this.metadata.get(hash)!;
      meta.refCount++;
      return hash;
    }

    this.blobs.set(hash, buf);
    this.metadata.set(hash, {
      hash,
      sizeBytes: buf.length,
      mimeType,
      createdAt: Date.now(),
      refCount: 1
    });

    return hash;
  }

  public get(hash: string): Buffer | null {
    return this.blobs.get(hash) ?? null;
  }

  public getString(hash: string): string | null {
    const buf = this.get(hash);
    return buf ? buf.toString('utf8') : null;
  }

  public getMetadata(hash: string): BlobMetadata | null {
    const meta = this.metadata.get(hash);
    return meta ? { ...meta } : null;
  }

  public retain(hash: string): void {
    const meta = this.metadata.get(hash);
    if (meta) {
      meta.refCount++;
    }
  }

  public release(hash: string): boolean {
    const meta = this.metadata.get(hash);
    if (!meta) return false;

    meta.refCount--;
    if (meta.refCount <= 0) {
      this.blobs.delete(hash);
      this.metadata.delete(hash);
      return true;
    }
    return false;
  }

  public getStats(): { totalBlobs: number; totalBytes: number; deduplicationRatio: number } {
    let totalBytes = 0;
    let totalRefs = 0;

    for (const meta of this.metadata.values()) {
      totalBytes += meta.sizeBytes;
      totalRefs += meta.refCount;
    }

    const deduplicationRatio = this.metadata.size > 0 ? totalRefs / this.metadata.size : 1.0;
    return {
      totalBlobs: this.blobs.size,
      totalBytes,
      deduplicationRatio
    };
  }

  public clear(): void {
    this.blobs.clear();
    this.metadata.clear();
  }
}
