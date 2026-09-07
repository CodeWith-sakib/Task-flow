/**
 * Software Transactional Memory (STM) Engine.
 * Provides lock-free composable atomic transactions (atomic blocks)
 * with read-set/write-set tracking, validation, retry, and rollback semantics.
 */

import { TransactionalRef } from './TransactionalRef';

export interface STMTransactionContext {
  readSet: Map<TransactionalRef<any>, number>;
  writeSet: Map<TransactionalRef<any>, any>;
}

export class SoftwareTransactionalMemory {
  private globalClock = 0;

  /**
   * Executes an atomic STM transaction block with automatic retry on conflict.
   */
  public async atomically<R>(
    block: (tx: {
      get: <T>(ref: TransactionalRef<T>) => T;
      set: <T>(ref: TransactionalRef<T>, val: T) => void;
    }) => Promise<R> | R,
    maxRetries: number = 10
  ): Promise<R> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const ctx: STMTransactionContext = {
        readSet: new Map(),
        writeSet: new Map(),
      };

      const txApi = {
        get: <T>(ref: TransactionalRef<T>): T => {
          if (ctx.writeSet.has(ref)) {
            return ctx.writeSet.get(ref);
          }
          if (!ctx.readSet.has(ref)) {
            ctx.readSet.set(ref, ref.getVersion());
          }
          return ref.getRawValue();
        },
        set: <T>(ref: TransactionalRef<T>, val: T): void => {
          if (!ctx.readSet.has(ref)) {
            ctx.readSet.set(ref, ref.getVersion());
          }
          ctx.writeSet.set(ref, val);
        },
      };

      let result: R;
      try {
        result = await block(txApi);
      } catch (err) {
        throw err;
      }

      // Validation phase
      if (this.validate(ctx)) {
        this.commit(ctx);
        return result;
      }

      // Conflict: backoff slightly and retry
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
    }

    throw new Error(`STM transaction failed to commit after ${maxRetries} attempts due to conflict.`);
  }

  private validate(ctx: STMTransactionContext): boolean {
    for (const [ref, initialVersion] of ctx.readSet.entries()) {
      if (ref.getVersion() !== initialVersion) {
        return false;
      }
    }
    return true;
  }

  private commit(ctx: STMTransactionContext): void {
    const commitClock = ++this.globalClock;
    for (const [ref, val] of ctx.writeSet.entries()) {
      ref.setRawValue(val, commitClock);
    }
  }
}
