/**
 * Query Execution Telemetry & Performance Metrics.
 * Collects runtime performance counters for executed physical plans:
 * scanned row counts, emitted row counts, execution time per operator,
 * memory peak, and index usage efficiency.
 */

export interface OperatorMetricSnapshot {
  operatorId: string;
  operatorType: string;
  executionTimeMs: number;
  inputRows: number;
  outputRows: number;
  peakMemoryBytes: number;
}

export interface QueryMetricsReport {
  queryId: string;
  totalTimeMs: number;
  totalScannedRows: number;
  totalEmittedRows: number;
  operatorBreakdown: OperatorMetricSnapshot[];
}

export class QueryExecutionMetrics {
  private queryId: string;
  private startTime = Date.now();
  private operatorMetrics = new Map<string, OperatorMetricSnapshot>();

  constructor(queryId: string) {
    this.queryId = queryId;
  }

  public recordOperator(
    operatorId: string,
    operatorType: string,
    executionTimeMs: number,
    inputRows: number,
    outputRows: number,
    peakMemoryBytes: number = 0
  ): void {
    this.operatorMetrics.set(operatorId, {
      operatorId,
      operatorType,
      executionTimeMs,
      inputRows,
      outputRows,
      peakMemoryBytes,
    });
  }

  public generateReport(): QueryMetricsReport {
    const operatorBreakdown = Array.from(this.operatorMetrics.values());
    const totalScannedRows = operatorBreakdown
      .filter((o) => o.operatorType.includes('Scan'))
      .reduce((acc, o) => acc + o.inputRows, 0);

    const lastOp = operatorBreakdown[operatorBreakdown.length - 1];
    const totalEmittedRows = lastOp ? lastOp.outputRows : 0;

    return {
      queryId: this.queryId,
      totalTimeMs: Date.now() - this.startTime,
      totalScannedRows,
      totalEmittedRows,
      operatorBreakdown,
    };
  }
}
