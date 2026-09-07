/**
 * Storage Space & Write Amplification Analyzer.
 * Computes space amplification ratio (SAR) and write amplification factor (WAF),
 * predicting disk bloat from dead versions and tombstone accumulation.
 */

export interface AmplificationMetrics {
  totalDiskSizeBytes: number;
  liveDataSizeBytes: number;
  tombstoneCount: number;
  deadVersionCount: number;
  spaceAmplificationRatio: number; // totalDiskSizeBytes / liveDataSizeBytes
  writeAmplificationFactor: number;
  recommendedAction: 'NONE' | 'MINOR_COMPACTION' | 'MAJOR_COMPACTION' | 'VACUUM';
}

export class SpaceAmplificationAnalyzer {
  private totalBytesWritten = 0;
  private userBytesWritten = 0;

  public recordWrite(userBytes: number, diskBytesWritten: number): void {
    this.userBytesWritten += userBytes;
    this.totalBytesWritten += diskBytesWritten;
  }

  public analyzeStorage(
    totalDiskSizeBytes: number,
    liveDataSizeBytes: number,
    tombstoneCount: number,
    deadVersionCount: number
  ): AmplificationMetrics {
    const safeLiveBytes = Math.max(1, liveDataSizeBytes);
    const spaceAmplificationRatio = totalDiskSizeBytes / safeLiveBytes;

    const safeUserBytes = Math.max(1, this.userBytesWritten);
    const writeAmplificationFactor = this.totalBytesWritten > 0 ? this.totalBytesWritten / safeUserBytes : 1.0;

    let recommendedAction: AmplificationMetrics['recommendedAction'] = 'NONE';

    if (spaceAmplificationRatio > 2.5 || tombstoneCount > 10000) {
      recommendedAction = 'MAJOR_COMPACTION';
    } else if (deadVersionCount > 5000) {
      recommendedAction = 'VACUUM';
    } else if (spaceAmplificationRatio > 1.5) {
      recommendedAction = 'MINOR_COMPACTION';
    }

    return {
      totalDiskSizeBytes,
      liveDataSizeBytes,
      tombstoneCount,
      deadVersionCount,
      spaceAmplificationRatio,
      writeAmplificationFactor,
      recommendedAction,
    };
  }

  public getWriteStats(): { totalBytesWritten: number; userBytesWritten: number } {
    return {
      totalBytesWritten: this.totalBytesWritten,
      userBytesWritten: this.userBytesWritten,
    };
  }
}
