export interface ResourceBudget {
  maxExecutionTimeMs: number;
  maxMemoryBytes: number;
  maxIterations: number;
  maxStackDepth: number;
}

export interface ResourceUsage {
  elapsedTimeMs: number;
  iterationCount: number;
  currentStackDepth: number;
  allocatedBytes: number;
}

/**
 * ResourceBudgetGuard tracks and enforces multi-dimensional compute budgets during task evaluation,
 * interrupting execution if time, memory, loop iterations, or recursion stack bounds are violated.
 */
export class ResourceBudgetGuard {
  private budget: ResourceBudget;
  private startTime: number;
  private iterations: number = 0;
  private stackDepth: number = 0;
  private allocatedBytes: number = 0;

  constructor(budget?: Partial<ResourceBudget>) {
    this.budget = {
      maxExecutionTimeMs: budget?.maxExecutionTimeMs ?? 10000,
      maxMemoryBytes: budget?.maxMemoryBytes ?? 64 * 1024 * 1024,
      maxIterations: budget?.maxIterations ?? 1000000,
      maxStackDepth: budget?.maxStackDepth ?? 500
    };
    this.startTime = Date.now();
  }

  public tick(iterationsDelta: number = 1): void {
    this.iterations += iterationsDelta;
    if (this.iterations > this.budget.maxIterations) {
      throw new Error(`Resource limit exceeded: iteration count ${this.iterations} > ${this.budget.maxIterations}`);
    }

    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.budget.maxExecutionTimeMs) {
      throw new Error(`Resource limit exceeded: execution time ${elapsed}ms > ${this.budget.maxExecutionTimeMs}ms`);
    }
  }

  public enterCall(): void {
    this.stackDepth++;
    if (this.stackDepth > this.budget.maxStackDepth) {
      throw new Error(`Resource limit exceeded: call stack depth ${this.stackDepth} > ${this.budget.maxStackDepth}`);
    }
  }

  public exitCall(): void {
    this.stackDepth = Math.max(0, this.stackDepth - 1);
  }

  public allocate(bytes: number): void {
    this.allocatedBytes += bytes;
    if (this.allocatedBytes > this.budget.maxMemoryBytes) {
      throw new Error(`Resource limit exceeded: allocated memory ${this.allocatedBytes}B > ${this.budget.maxMemoryBytes}B`);
    }
  }

  public deallocate(bytes: number): void {
    this.allocatedBytes = Math.max(0, this.allocatedBytes - bytes);
  }

  public getUsage(): ResourceUsage {
    return {
      elapsedTimeMs: Date.now() - this.startTime,
      iterationCount: this.iterations,
      currentStackDepth: this.stackDepth,
      allocatedBytes: this.allocatedBytes
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.iterations = 0;
    this.stackDepth = 0;
    this.allocatedBytes = 0;
  }
}
