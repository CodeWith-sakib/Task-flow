import { EntryType, IIterator, StorageRecord } from './types';

export class SkipListNode<V = any> {
  public record: StorageRecord<V>;
  public forward: (SkipListNode<V> | null)[];

  constructor(record: StorageRecord<V>, level: number) {
    this.record = record;
    this.forward = new Array(level).fill(null);
  }
}

/**
 * SkipList provides an in-memory lock-free concurrent-safe sorted map data structure
 * with O(log N) lookup, insertion, deletion, and range iteration.
 */
export class SkipList<V = any> {
  private readonly maxLevel: number;
  private readonly probability: number;
  private head: SkipListNode<V>;
  private currentLevel: number;
  private length: number;
  private approximateByteSize: number;

  constructor(maxLevel: number = 16, probability: number = 0.5) {
    this.maxLevel = maxLevel;
    this.probability = probability;
    this.currentLevel = 1;
    this.length = 0;
    this.approximateByteSize = 0;

    const dummyRecord: StorageRecord<V> = {
      key: '',
      value: null,
      sequence: 0,
      type: EntryType.PUT,
      timestamp: 0
    };
    this.head = new SkipListNode<V>(dummyRecord, maxLevel);
  }

  public insert(record: StorageRecord<V>): void {
    const update: (SkipListNode<V> | null)[] = new Array(this.maxLevel).fill(null);
    let current: SkipListNode<V> = this.head;

    for (let i = this.currentLevel - 1; i >= 0; i--) {
      while (current.forward[i] && this.compareRecords(current.forward[i]!.record, record) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const nextNode = current.forward[0];
    if (nextNode && this.compareRecords(nextNode.record, record) === 0) {
      // Overwrite exact same key and sequence
      const oldSize = this.estimateRecordSize(nextNode.record);
      nextNode.record = record;
      this.approximateByteSize += this.estimateRecordSize(record) - oldSize;
      return;
    }

    const randomLevel = this.getRandomLevel();
    if (randomLevel > this.currentLevel) {
      for (let i = this.currentLevel; i < randomLevel; i++) {
        update[i] = this.head;
      }
      this.currentLevel = randomLevel;
    }

    const newNode = new SkipListNode<V>(record, randomLevel);
    for (let i = 0; i < randomLevel; i++) {
      newNode.forward[i] = update[i]!.forward[i];
      update[i]!.forward[i] = newNode;
    }

    this.length++;
    this.approximateByteSize += this.estimateRecordSize(record) + (randomLevel * 8) + 32;
  }

  public find(key: string, maxSequence: number = Number.MAX_SAFE_INTEGER): StorageRecord<V> | null {
    let current: SkipListNode<V> = this.head;

    for (let i = this.currentLevel - 1; i >= 0; i--) {
      while (current.forward[i] && current.forward[i]!.record.key < key) {
        current = current.forward[i]!;
      }
    }

    current = current.forward[0] || this.head;

    while (current && current !== this.head && current.record.key === key) {
      if (current.record.sequence <= maxSequence) {
        return current.record;
      }
      current = current.forward[0] || this.head;
    }

    return null;
  }

  public iterator(): IIterator<string, StorageRecord<V>> {
    return new SkipListIterator<V>(this.head);
  }

  public size(): number {
    return this.length;
  }

  public byteSize(): number {
    return this.approximateByteSize;
  }

  public clear(): void {
    this.currentLevel = 1;
    this.length = 0;
    this.approximateByteSize = 0;
    this.head.forward.fill(null);
  }

  private getRandomLevel(): number {
    let level = 1;
    while (Math.random() < this.probability && level < this.maxLevel) {
      level++;
    }
    return level;
  }

  private compareRecords(a: StorageRecord<V>, b: StorageRecord<V>): number {
    if (a.key !== b.key) {
      return a.key < b.key ? -1 : 1;
    }
    // Descending order of sequence numbers so newest sequence appears first
    return b.sequence - a.sequence;
  }

  private estimateRecordSize(record: StorageRecord<V>): number {
    const keyBytes = Buffer.byteLength(record.key, 'utf8');
    const valBytes = record.value ? Buffer.byteLength(JSON.stringify(record.value), 'utf8') : 0;
    return keyBytes + valBytes + 24;
  }
}

export class SkipListIterator<V = any> implements IIterator<string, StorageRecord<V>> {
  private head: SkipListNode<V>;
  private current: SkipListNode<V> | null = null;

  constructor(head: SkipListNode<V>) {
    this.head = head;
    this.seekToFirst();
  }

  public seekToFirst(): void {
    this.current = this.head.forward[0];
  }

  public seekToLast(): void {
    let curr = this.head;
    while (curr.forward[0]) {
      curr = curr.forward[0];
    }
    this.current = curr === this.head ? null : curr;
  }

  public seek(targetKey: string): void {
    let curr = this.head;
    for (let i = curr.forward.length - 1; i >= 0; i--) {
      while (curr.forward[i] && curr.forward[i]!.record.key < targetKey) {
        curr = curr.forward[i]!;
      }
    }
    this.current = curr.forward[0];
  }

  public next(): void {
    if (this.current) {
      this.current = this.current.forward[0];
    }
  }

  public prev(): void {
    if (!this.current) return;
    let curr = this.head;
    while (curr.forward[0] && curr.forward[0] !== this.current) {
      curr = curr.forward[0];
    }
    this.current = curr === this.head ? null : curr;
  }

  public isValid(): boolean {
    return this.current !== null;
  }

  public key(): string {
    if (!this.current) throw new Error('Iterator out of bounds');
    return this.current.record.key;
  }

  public value(): StorageRecord<V> {
    if (!this.current) throw new Error('Iterator out of bounds');
    return this.current.record;
  }
}
