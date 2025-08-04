import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskStatus } from '../../types';
import {
  PersistentStorageEngine,
  StorageStats,
  StorageTransaction,
  TaskQueryFilter,
  TaskQueryResult,
} from '../types';
import { SecondaryIndex } from '../index/SecondaryIndex';
import { computeCRC32 } from './crc32';

export interface WALRecord {
  seq: number;
  timestamp: string;
  op: 'CREATE' | 'UPDATE' | 'DELETE' | 'CHECKPOINT';
  taskId: string;
  data?: any;
  checksum: number;
}

export class WALStorageEngine implements PersistentStorageEngine {
  private baseDir: string;
  private walPath: string;
  private snapshotPath: string;
  private currentSeq: number = 0;
  private tasks: Map<string, Task> = new Map();
  private index: SecondaryIndex = new SecondaryIndex();
  private fd: number | null = null;
  private initialized: boolean = false;

  constructor(baseDir: string = './data/wal') {
    this.baseDir = baseDir;
    this.walPath = path.join(baseDir, 'tasks.wal');
    this.snapshotPath = path.join(baseDir, 'snapshot.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    // Step 1: Recover from snapshot if present
    await this.recoverSnapshot();

    // Step 2: Replay WAL log records on top of snapshot
    await this.replayWAL();

    // Step 3: Open WAL file descriptor for append
    this.fd = fs.openSync(this.walPath, 'a');
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
    this.initialized = false;
  }

  private async recoverSnapshot(): Promise<void> {
    if (!fs.existsSync(this.snapshotPath)) return;

    try {
      const raw = fs.readFileSync(this.snapshotPath, 'utf8');
      const snapshot: { seq: number; tasks: Task[] } = JSON.parse(raw);
      this.currentSeq = snapshot.seq || 0;

      for (const t of snapshot.tasks) {
        const reconstructed: Task = {
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          scheduledAt: t.scheduledAt ? new Date(t.scheduledAt) : null,
          deadline: t.deadline ? new Date(t.deadline) : null,
        };
        this.tasks.set(reconstructed.id, reconstructed);
        this.index.index(reconstructed);
      }
    } catch (err) {
      console.error('Failed to parse snapshot, falling back to clean state:', err);
    }
  }

  private async replayWAL(): Promise<void> {
    if (!fs.existsSync(this.walPath)) return;

    const content = fs.readFileSync(this.walPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      try {
        const record: WALRecord = JSON.parse(line);
        const payloadStr = JSON.stringify({
          seq: record.seq,
          timestamp: record.timestamp,
          op: record.op,
          taskId: record.taskId,
          data: record.data,
        });

        const expectedChecksum = computeCRC32(payloadStr);
        if (expectedChecksum !== record.checksum) {
          console.warn(`WAL checksum mismatch at seq ${record.seq}. Skipping corrupted line.`);
          continue;
        }

        if (record.seq > this.currentSeq) {
          this.currentSeq = record.seq;
        }

        if (record.op === 'CREATE' || record.op === 'UPDATE') {
          const t: Task = {
            ...record.data,
            createdAt: new Date(record.data.createdAt),
            updatedAt: new Date(record.data.updatedAt),
            scheduledAt: record.data.scheduledAt ? new Date(record.data.scheduledAt) : null,
            deadline: record.data.deadline ? new Date(record.data.deadline) : null,
          };
          this.tasks.set(t.id, t);
          this.index.index(t);
        } else if (record.op === 'DELETE') {
          this.tasks.delete(record.taskId);
          this.index.unindex(record.taskId);
        }
      } catch (e) {
        console.warn('Failed to parse WAL line:', line);
      }
    }
  }

  private appendWALRecord(op: 'CREATE' | 'UPDATE' | 'DELETE' | 'CHECKPOINT', taskId: string, data?: any): void {
    if (this.fd === null) {
      throw new Error('WALStorageEngine is not initialized');
    }

    this.currentSeq++;
    const timestamp = new Date().toISOString();
    const payloadStr = JSON.stringify({
      seq: this.currentSeq,
      timestamp,
      op,
      taskId,
      data,
    });

    const checksum = computeCRC32(payloadStr);
    const fullRecord: WALRecord = {
      seq: this.currentSeq,
      timestamp,
      op,
      taskId,
      data,
      checksum,
    };

    fs.writeSync(this.fd, JSON.stringify(fullRecord) + '\n');
    fs.fsyncSync(this.fd);
  }

  async createTask(task: Task): Promise<Task> {
    const copy: Task = {
      ...task,
      createdAt: task.createdAt ?? new Date(),
      updatedAt: task.updatedAt ?? new Date(),
    };

    this.tasks.set(copy.id, copy);
    this.index.index(copy);
    this.appendWALRecord('CREATE', copy.id, copy);
    return copy;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) return null;

    const updated: Task = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    this.index.index(updated);
    this.appendWALRecord('UPDATE', id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    const existing = this.tasks.get(id);
    if (!existing) return false;

    this.tasks.delete(id);
    this.index.unindex(id);
    this.appendWALRecord('DELETE', id);
    return true;
  }

  async queryTasks(filter: TaskQueryFilter): Promise<TaskQueryResult> {
    let candidateIds: Set<string> | null = null;

    // Utilize index if status filter provided
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      candidateIds = new Set<string>();
      for (const st of statuses) {
        for (const id of this.index.getByStatus(st)) {
          candidateIds.add(id);
        }
      }
    }

    // Utilize index if type filter provided
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      const typeMatches = new Set<string>();
      for (const tp of types) {
        for (const id of this.index.getByType(tp)) {
          typeMatches.add(id);
        }
      }
      candidateIds = candidateIds ? new Set([...candidateIds].filter(id => typeMatches.has(id))) : typeMatches;
    }

    let items: Task[] = candidateIds
      ? Array.from(candidateIds).map(id => this.tasks.get(id)!).filter(Boolean)
      : Array.from(this.tasks.values());

    // Apply priority range filters
    if (filter.priorityMin !== undefined) {
      items = items.filter(t => (t.priority ?? 0) >= filter.priorityMin!);
    }
    if (filter.priorityMax !== undefined) {
      items = items.filter(t => (t.priority ?? 0) <= filter.priorityMax!);
    }

    // Apply date filters
    if (filter.scheduledBefore) {
      items = items.filter(t => t.scheduledAt && new Date(t.scheduledAt) <= filter.scheduledBefore!);
    }
    if (filter.createdAfter) {
      items = items.filter(t => new Date(t.createdAt) >= filter.createdAfter!);
    }

    // Sorting
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';
    items.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;
      if (sortBy === 'priority') {
        valA = a.priority ?? 0;
        valB = b.priority ?? 0;
      } else if (sortBy === 'scheduledAt') {
        valA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        valB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      } else if (sortBy === 'updatedAt') {
        valA = new Date(a.updatedAt).getTime();
        valB = new Date(b.updatedAt).getTime();
      } else {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const total = items.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    const paged = items.slice(offset, offset + limit);

    return {
      tasks: paged,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getStats(): Promise<StorageStats> {
    const counts = this.index.countByStatus();
    return {
      totalTasks: this.tasks.size,
      countsByStatus: counts,
    };
  }

  async compact(): Promise<void> {
    const snapshotData = {
      seq: this.currentSeq,
      tasks: Array.from(this.tasks.values()),
    };

    const tempSnapshot = `${this.snapshotPath}.tmp`;
    fs.writeFileSync(tempSnapshot, JSON.stringify(snapshotData, null, 2), 'utf8');
    fs.renameSync(tempSnapshot, this.snapshotPath);

    // Truncate WAL file
    if (this.fd !== null) {
      fs.closeSync(this.fd);
    }
    fs.writeFileSync(this.walPath, '', 'utf8');
    this.fd = fs.openSync(this.walPath, 'a');
  }

  async beginTransaction(): Promise<StorageTransaction> {
    const stagedOperations: Array<{ op: 'CREATE' | 'UPDATE' | 'DELETE'; task?: Task; id: string; updates?: Partial<Task> }> = [];
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: txId,
      createTask: async (task: Task) => {
        stagedOperations.push({ op: 'CREATE', task, id: task.id });
      },
      updateTask: async (id: string, updates: Partial<Task>) => {
        stagedOperations.push({ op: 'UPDATE', id, updates });
        const existing = this.tasks.get(id);
        return existing ? { ...existing, ...updates } : null;
      },
      deleteTask: async (id: string) => {
        stagedOperations.push({ op: 'DELETE', id });
        return true;
      },
      commit: async () => {
        for (const op of stagedOperations) {
          if (op.op === 'CREATE' && op.task) {
            await this.createTask(op.task);
          } else if (op.op === 'UPDATE' && op.updates) {
            await this.updateTask(op.id, op.updates);
          } else if (op.op === 'DELETE') {
            await this.deleteTask(op.id);
          }
        }
      },
      rollback: async () => {
        stagedOperations.length = 0;
      },
    };
  }
}
