import * as crypto from 'crypto';
import { CreateTaskRequest } from '../../types';
import { TaskFlowPlugin } from '../types';

export class DeduplicationPlugin implements TaskFlowPlugin {
  readonly name = 'deduplication';
  readonly version = '1.0.0';

  private windowMs: number;
  private recentHashes: Map<string, number> = new Map();

  constructor(windowMs: number = 30000) {
    this.windowMs = windowMs;
  }

  private computeHash(request: CreateTaskRequest): string {
    const data = `${request.type}:${JSON.stringify(request.payload)}`;
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  async beforeCreateTask(request: CreateTaskRequest): Promise<CreateTaskRequest> {
    const now = Date.now();
    const hash = this.computeHash(request);

    const prevTimestamp = this.recentHashes.get(hash);
    if (prevTimestamp && now - prevTimestamp < this.windowMs) {
      throw new Error(`Duplicate task submission detected within deduplication window (${this.windowMs}ms)`);
    }

    this.recentHashes.set(hash, now);
    this.cleanupOldHashes(now);

    return request;
  }

  private cleanupOldHashes(currentTime: number): void {
    if (this.recentHashes.size > 5000) {
      for (const [hash, ts] of this.recentHashes.entries()) {
        if (currentTime - ts >= this.windowMs) {
          this.recentHashes.delete(hash);
        }
      }
    }
  }

  clear(): void {
    this.recentHashes.clear();
  }
}
