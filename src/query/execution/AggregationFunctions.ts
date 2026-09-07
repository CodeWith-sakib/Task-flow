export interface IAggregateAccumulator {
  step(val: any): void;
  result(): any;
}

export class CountAccumulator implements IAggregateAccumulator {
  private count: number = 0;
  public step(val: any): void {
    if (val !== undefined && val !== null) {
      this.count++;
    }
  }
  public result(): number {
    return this.count;
  }
}

export class SumAccumulator implements IAggregateAccumulator {
  private sum: number = 0;
  public step(val: any): void {
    const num = Number(val);
    if (!isNaN(num)) {
      this.sum += num;
    }
  }
  public result(): number {
    return this.sum;
  }
}

export class AvgAccumulator implements IAggregateAccumulator {
  private sum: number = 0;
  private count: number = 0;
  public step(val: any): void {
    const num = Number(val);
    if (!isNaN(num)) {
      this.sum += num;
      this.count++;
    }
  }
  public result(): number | null {
    return this.count > 0 ? this.sum / this.count : null;
  }
}

export class MinAccumulator implements IAggregateAccumulator {
  private min: any = undefined;
  public step(val: any): void {
    if (val !== undefined && val !== null) {
      if (this.min === undefined || val < this.min) {
        this.min = val;
      }
    }
  }
  public result(): any {
    return this.min === undefined ? null : this.min;
  }
}

export class MaxAccumulator implements IAggregateAccumulator {
  private max: any = undefined;
  public step(val: any): void {
    if (val !== undefined && val !== null) {
      if (this.max === undefined || val > this.max) {
        this.max = val;
      }
    }
  }
  public result(): any {
    return this.max === undefined ? null : this.max;
  }
}
