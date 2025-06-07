export class QueueBackpressureController {
  private maxDepth: number;
  private highWatermark: number;
  private lowWatermark: number;
  private paused: boolean = false;

  constructor(maxDepth: number = 10000, highRatio: number = 0.8, lowRatio: number = 0.5) {
    this.maxDepth = maxDepth;
    this.highWatermark = Math.floor(maxDepth * highRatio);
    this.lowWatermark = Math.floor(maxDepth * lowRatio);
  }

  public updateDepth(currentDepth: number): { accept: boolean; stateChanged: boolean } {
    const wasPaused = this.paused;
    if (currentDepth >= this.highWatermark) {
      this.paused = true;
    } else if (currentDepth <= this.lowWatermark) {
      this.paused = false;
    }
    return {
      accept: !this.paused && currentDepth < this.maxDepth,
      stateChanged: wasPaused !== this.paused
    };
  }

  public isPaused(): boolean {
    return this.paused;
  }
}
