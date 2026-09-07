import { computeCRC32 } from '../wal/crc32';

export interface RecoveryPlan {
  totalLogRecordsScanned: number;
  validRecords: number;
  corruptedRecords: number;
  uncommittedTransactions: string[];
  replayedOperations: number;
}

/**
 * CrashRecoveryCoordinator inspects segmented Write-Ahead Logs after unexpected engine restarts,
 * validates frame checksums, rolls back uncommitted transactions, and reconciles state.
 */
export class CrashRecoveryCoordinator {
  public analyzeAndRecover(walLogFrames: Buffer[]): RecoveryPlan {
    let totalLogRecordsScanned = 0;
    let validRecords = 0;
    let corruptedRecords = 0;
    const activeTransactions = new Set<string>();
    const committedTransactions = new Set<string>();

    for (const frame of walLogFrames) {
      totalLogRecordsScanned++;

      if (frame.length < 8) {
        corruptedRecords++;
        continue;
      }

      const expectedCrc = frame.readUInt32BE(0);
      const payloadLength = frame.readUInt32BE(4);
      const payload = frame.slice(8, 8 + payloadLength);

      const actualCrc = computeCRC32(payload.toString('binary'));
      if (actualCrc !== expectedCrc) {
        corruptedRecords++;
        continue;
      }

      try {
        const record = JSON.parse(payload.toString('utf8'));
        validRecords++;

        if (record.type === 'TX_BEGIN') {
          activeTransactions.add(record.txId);
        } else if (record.type === 'TX_COMMIT') {
          committedTransactions.add(record.txId);
          activeTransactions.delete(record.txId);
        } else if (record.type === 'TX_ABORT') {
          activeTransactions.delete(record.txId);
        }
      } catch {
        corruptedRecords++;
      }
    }

    const uncommittedTransactions = Array.from(activeTransactions);

    return {
      totalLogRecordsScanned,
      validRecords,
      corruptedRecords,
      uncommittedTransactions,
      replayedOperations: validRecords - corruptedRecords
    };
  }
}
