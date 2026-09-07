export interface BlockEntry {
  key: string;
  value: Buffer;
}

/**
 * BlockReader decodes an SSTable block with prefix expansion and binary search over restart offsets.
 */
export class BlockReader {
  private data: Buffer;
  private restartsOffset: number;
  private numRestarts: number;

  constructor(data: Buffer) {
    this.data = data;
    if (data.length < 4) {
      throw new Error('Corrupted block data: buffer too small');
    }
    this.numRestarts = data.readUInt32BE(data.length - 4);
    this.restartsOffset = data.length - 4 - (this.numRestarts * 4);
    if (this.restartsOffset < 0) {
      throw new Error('Corrupted block data: invalid restart offset');
    }
  }

  public getRestartOffset(index: number): number {
    if (index < 0 || index >= this.numRestarts) {
      throw new Error(`Restart index out of range: ${index}`);
    }
    return this.data.readUInt32BE(this.restartsOffset + (index * 4));
  }

  public readAllEntries(): BlockEntry[] {
    const entries: BlockEntry[] = [];
    let offset = 0;
    let lastKey = '';

    while (offset < this.restartsOffset) {
      if (offset + 8 > this.restartsOffset) break;

      const shared = this.data.readUInt16BE(offset);
      const nonShared = this.data.readUInt16BE(offset + 2);
      const valueLen = this.data.readUInt32BE(offset + 4);
      offset += 8;

      const keySuffix = this.data.toString('utf8', offset, offset + nonShared);
      offset += nonShared;

      const fullKey = lastKey.substring(0, shared) + keySuffix;
      const value = this.data.slice(offset, offset + valueLen);
      offset += valueLen;

      lastKey = fullKey;
      entries.push({ key: fullKey, value });
    }

    return entries;
  }

  public find(targetKey: string): Buffer | null {
    // Binary search across restart points
    let left = 0;
    let right = this.numRestarts - 1;

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      const restartOffset = this.getRestartOffset(mid);
      const shared = this.data.readUInt16BE(restartOffset);
      const nonShared = this.data.readUInt16BE(restartOffset + 2);
      const keySuffix = this.data.toString('utf8', restartOffset + 8, restartOffset + 8 + nonShared);
      const midKey = keySuffix; // At restart point, shared is always 0

      if (midKey <= targetKey) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    // Linear scan from selected restart offset
    let offset = this.getRestartOffset(left);
    let lastKey = '';

    while (offset < this.restartsOffset) {
      const shared = this.data.readUInt16BE(offset);
      const nonShared = this.data.readUInt16BE(offset + 2);
      const valueLen = this.data.readUInt32BE(offset + 4);
      offset += 8;

      const keySuffix = this.data.toString('utf8', offset, offset + nonShared);
      offset += nonShared;

      const fullKey = lastKey.substring(0, shared) + keySuffix;
      const value = this.data.slice(offset, offset + valueLen);
      offset += valueLen;

      lastKey = fullKey;

      if (fullKey === targetKey) {
        return value;
      }
      if (fullKey > targetKey) {
        break;
      }
    }

    return null;
  }
}
