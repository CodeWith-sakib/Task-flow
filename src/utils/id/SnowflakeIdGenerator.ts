export class SnowflakeIdGenerator {
  private workerId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;
  private epoch: bigint = 1704067200000n; // 2024-01-01

  constructor(workerId: number = 1) {
    if (workerId < 0 || workerId > 1023) {
      throw new Error('Worker ID must be between 0 and 1023');
    }
    this.workerId = BigInt(workerId);
  }

  nextId(): string {
    let timestamp = BigInt(Date.now());

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 4095n;
      if (this.sequence === 0n) {
        // Wait till next millisecond
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id =
      ((timestamp - this.epoch) << 22n) |
      (this.workerId << 12n) |
      this.sequence;

    return id.toString();
  }
}
