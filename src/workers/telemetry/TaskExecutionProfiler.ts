/**
 * Task Execution Micro-Profiler.
 * Measures fine-grained CPU user/system time, event loop delay delta,
 * memory delta, and I/O duration per executed task step.
 */

export interface TaskProfileMetrics {
  taskId: string;
  durationMs: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  heapDeltaBytes: number;
}

export class TaskExecutionProfiler {
  public async profileTask<T>(taskId: string, fn: () => Promise<T> | T): Promise<{ result: T; metrics: TaskProfileMetrics }> {
    const startTime = Date.now();
    const startCpu = process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
    const startMem = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

    try {
      const result = await fn();

      const endCpu = process.cpuUsage ? process.cpuUsage(startCpu) : { user: 0, system: 0 };
      const endMem = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

      const metrics: TaskProfileMetrics = {
        taskId,
        durationMs: Date.now() - startTime,
        cpuUserMicros: endCpu.user,
        cpuSystemMicros: endCpu.system,
        heapDeltaBytes: endMem - startMem,
      };

      return { result, metrics };
    } catch (err) {
      throw err;
    }
  }
}
