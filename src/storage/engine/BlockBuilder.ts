/**
 * BlockBuilder assembles keys and values into an SSTable block with prefix delta encoding
 * and an index restart array for fast random binary-seek lookup within the block.
 */
export class BlockBuilder {
  private restartInterval: number;
  private buffer: Buffer[] = [];
  private restarts: number[] = [0];
  private counter: number = 0;
  private lastKey: string = '';
  private finished: boolean = false;
  private currentBytes: number = 0;

  constructor(restartInterval: number = 16) {
    this.restartInterval = restartInterval;
  }

  public add(key: string, value: Buffer): void {
    if (this.finished) throw new Error('Cannot add to finished BlockBuilder');

    let shared = 0;
    if (this.counter < this.restartInterval) {
      const minLen = Math.min(this.lastKey.length, key.length);
      while (shared < minLen && this.lastKey.charCodeAt(shared) === key.charCodeAt(shared)) {
        shared++;
      }
    } else {
      this.restarts.push(this.currentBytes);
      this.counter = 0;
    }

    const nonShared = key.length - shared;
    const keySuffix = Buffer.from(key.substring(shared), 'utf8');

    // Header: shared_len (uint16), non_shared_len (uint16), value_len (uint32)
    const header = Buffer.alloc(8);
    header.writeUInt16BE(shared, 0);
    header.writeUInt16BE(nonShared, 2);
    header.writeUInt32BE(value.length, 4);

    this.buffer.push(header, keySuffix, value);
    this.currentBytes += header.length + keySuffix.length + value.length;
    this.lastKey = key;
    this.counter++;
  }

  public finish(): Buffer {
    if (!this.finished) {
      this.finished = true;
      // Append restart array
      const restartBuffer = Buffer.alloc(this.restarts.length * 4 + 4);
      for (let i = 0; i < this.restarts.length; i++) {
        restartBuffer.writeUInt32BE(this.restarts[i], i * 4);
      }
      restartBuffer.writeUInt32BE(this.restarts.length, this.restarts.length * 4);
      this.buffer.push(restartBuffer);
      this.currentBytes += restartBuffer.length;
    }

    return Buffer.concat(this.buffer);
  }

  public estimatedSize(): number {
    return this.currentBytes + (this.restarts.length * 4) + 4;
  }

  public isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  public reset(): void {
    this.buffer = [];
    this.restarts = [0];
    this.counter = 0;
    this.lastKey = '';
    this.finished = false;
    this.currentBytes = 0;
  }
}
