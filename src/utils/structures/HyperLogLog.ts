import { MurmurHash3 } from '../MurmurHash3';

/**
 * HyperLogLog provides near-optimal approximate cardinality estimation using logarithmic registers
 * and Flajolet-Martin harmonic averaging with small and large range bias corrections.
 */
export class HyperLogLog {
  private b: number; // Precision bits (e.g. 14 -> m = 16384)
  private m: number; // Number of registers (2^b)
  private registers: Uint8Array;
  private alphaMM: number;

  constructor(precisionBits: number = 14) {
    this.b = Math.min(16, Math.max(4, precisionBits));
    this.m = 1 << this.b;
    this.registers = new Uint8Array(this.m);

    // Calculate alpha_m * m^2 constant
    let alpha: number;
    switch (this.m) {
      case 16: alpha = 0.673; break;
      case 32: alpha = 0.697; break;
      case 64: alpha = 0.709; break;
      default: alpha = 0.7213 / (1.0 + 1.079 / this.m); break;
    }
    this.alphaMM = alpha * this.m * this.m;
  }

  public add(value: string): void {
    const hash = MurmurHash3.hash32(value, 0x9747b28c) >>> 0;
    const registerIndex = hash >>> (32 - this.b);
    const remainingBits = (hash << this.b) >>> 0;
    const leadingZeros = this.countLeadingZeros(remainingBits, 32 - this.b) + 1;

    if (leadingZeros > this.registers[registerIndex]) {
      this.registers[registerIndex] = leadingZeros;
    }
  }

  public count(): number {
    let sum = 0;
    let zeroCount = 0;

    for (let i = 0; i < this.m; i++) {
      const val = this.registers[i];
      sum += Math.pow(2, -val);
      if (val === 0) zeroCount++;
    }

    let estimate = this.alphaMM / sum;

    // Small range correction (Linear Counting)
    if (estimate <= 2.5 * this.m) {
      if (zeroCount > 0) {
        estimate = this.m * Math.log(this.m / zeroCount);
      }
    } else if (estimate > (1 / 30) * 4294967296) {
      // Large range correction
      estimate = -4294967296 * Math.log(1.0 - estimate / 4294967296);
    }

    return Math.round(estimate);
  }

  public merge(other: HyperLogLog): void {
    if (this.b !== other.b) {
      throw new Error(`Cannot merge HyperLogLog with different precision: ${this.b} vs ${other.b}`);
    }

    for (let i = 0; i < this.m; i++) {
      if (other.registers[i] > this.registers[i]) {
        this.registers[i] = other.registers[i];
      }
    }
  }

  public clear(): void {
    this.registers.fill(0);
  }

  private countLeadingZeros(val: number, maxBits: number): number {
    if (val === 0) return maxBits;
    let zeros = 0;
    for (let i = 31; i >= 32 - maxBits; i--) {
      if ((val & (1 << i)) === 0) {
        zeros++;
      } else {
        break;
      }
    }
    return zeros;
  }
}
