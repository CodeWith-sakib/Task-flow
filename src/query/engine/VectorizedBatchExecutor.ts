/**
 * SIMD-Style Vectorized Batch Execution Engine for TaskQL.
 * Operates directly on contiguous typed buffers (Int32Array, Float64Array)
 * executing arithmetic expressions, filtering, and aggregation in vectorized batches.
 */

export interface VectorBatch {
  size: number;
  intColumns: Map<string, Int32Array>;
  floatColumns: Map<string, Float64Array>;
  selectionVector?: Uint32Array; // indices of active rows
  selectedCount: number;
}

export class VectorizedBatchExecutor {
  /**
   * Evaluates filter: `col > threshold` into a selection vector.
   */
  public filterGreaterThanInt(
    batch: VectorBatch,
    colName: string,
    threshold: number
  ): Uint32Array {
    const col = batch.intColumns.get(colName);
    if (!col) throw new Error(`Column ${colName} not found`);

    const sel = new Uint32Array(batch.size);
    let count = 0;

    if (batch.selectionVector) {
      for (let i = 0; i < batch.selectedCount; i++) {
        const rowIdx = batch.selectionVector[i];
        if (col[rowIdx] > threshold) {
          sel[count++] = rowIdx;
        }
      }
    } else {
      for (let i = 0; i < batch.size; i++) {
        if (col[i] > threshold) {
          sel[count++] = i;
        }
      }
    }

    batch.selectionVector = sel;
    batch.selectedCount = count;
    return sel;
  }

  /**
   * Vectorized addition: `targetCol = colA + colB`
   */
  public addFloatColumns(
    batch: VectorBatch,
    colAName: string,
    colBName: string,
    targetColName: string
  ): Float64Array {
    const colA = batch.floatColumns.get(colAName);
    const colB = batch.floatColumns.get(colBName);
    if (!colA || !colB) throw new Error('Columns not found');

    const result = new Float64Array(batch.size);

    if (batch.selectionVector) {
      for (let i = 0; i < batch.selectedCount; i++) {
        const idx = batch.selectionVector[i];
        result[idx] = colA[idx] + colB[idx];
      }
    } else {
      for (let i = 0; i < batch.size; i++) {
        result[i] = colA[i] + colB[i];
      }
    }

    batch.floatColumns.set(targetColName, result);
    return result;
  }

  /**
   * Vectorized Sum reduction.
   */
  public sumFloat(batch: VectorBatch, colName: string): number {
    const col = batch.floatColumns.get(colName);
    if (!col) return 0;

    let sum = 0;
    if (batch.selectionVector) {
      for (let i = 0; i < batch.selectedCount; i++) {
        sum += col[batch.selectionVector[i]];
      }
    } else {
      for (let i = 0; i < batch.size; i++) {
        sum += col[i];
      }
    }

    return sum;
  }

  /**
   * Vectorized Min reduction.
   */
  public minFloat(batch: VectorBatch, colName: string): number {
    const col = batch.floatColumns.get(colName);
    if (!col || batch.selectedCount === 0) return 0;

    let min = Infinity;
    if (batch.selectionVector) {
      for (let i = 0; i < batch.selectedCount; i++) {
        const v = col[batch.selectionVector[i]];
        if (v < min) min = v;
      }
    } else {
      for (let i = 0; i < batch.size; i++) {
        if (col[i] < min) min = col[i];
      }
    }

    return min === Infinity ? 0 : min;
  }
}
