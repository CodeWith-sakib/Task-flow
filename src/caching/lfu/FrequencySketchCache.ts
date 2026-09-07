import { CountMinSketch } from '../../utils/structures/CountMinSketch';

/**
 * FrequencySketchCache (TinyLFU) maintains an admission filter backed by a CountMinSketch
 * to admit only frequently accessed candidates over the least-frequent resident items.
 */
export class FrequencySketchCache<V = any> {
  private capacity: number;
  private sketch: CountMinSketch;
  private cache: Map<string, V> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.sketch = new CountMinSketch(capacity * 4, 4);
  }

  public get(key: string): V | undefined {
    this.sketch.add(key, 1);
    const value = this.cache.get(key);

    if (value !== undefined) {
      this.hits++;
      return value;
    }

    this.misses++;
    return undefined;
  }

  public put(key: string, value: V): void {
    this.sketch.add(key, 1);

    if (this.cache.has(key)) {
      this.cache.set(key, value);
      return;
    }

    if (this.cache.size < this.capacity) {
      this.cache.set(key, value);
      return;
    }

    // Cache is full: TinyLFU Admission Policy
    // Find victim with lowest frequency among a random sample of cached keys
    const victimKey = this.selectVictim();
    const candidateFreq = this.sketch.estimate(key);
    const victimFreq = this.sketch.estimate(victimKey);

    if (candidateFreq > victimFreq) {
      // Evict victim and admit candidate
      this.cache.delete(victimKey);
      this.cache.set(key, value);
    }
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public size(): number {
    return this.cache.size;
  }

  public getStats(): { hits: number; misses: number; hitRatio: number; size: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : 0,
      size: this.cache.size
    };
  }

  public clear(): void {
    this.cache.clear();
    this.sketch.clear();
    this.hits = 0;
    this.misses = 0;
  }

  private selectVictim(): string {
    const sampleSize = Math.min(5, this.cache.size);
    const keys = Array.from(this.cache.keys());
    let lowestKey = keys[0];
    let lowestFreq = this.sketch.estimate(lowestKey);

    for (let i = 1; i < sampleSize; i++) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const freq = this.sketch.estimate(randomKey);
      if (freq < lowestFreq) {
        lowestFreq = freq;
        lowestKey = randomKey;
      }
    }

    return lowestKey;
  }
}
