import { TaskSandboxContext } from '../../security/sandbox/TaskSandboxContext';
import { ResourceBudgetGuard } from '../../security/sandbox/ResourceBudgetGuard';

export interface ScriptRunConfig {
  code: string;
  context: Record<string, any>;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

/**
 * ScriptSandboxRunner executes user-defined JavaScript task code within a secure sandbox
 * under CPU and memory budget guards.
 */
export class ScriptSandboxRunner {
  public async executeScript<T = any>(config: ScriptRunConfig): Promise<{ result: T; durationMs: number }> {
    const sandbox = new TaskSandboxContext({
      timeoutMs: config.timeoutMs ?? 5000,
      memoryLimitMb: config.memoryLimitMb ?? 64
    });

    const guard = new ResourceBudgetGuard({
      maxExecutionTimeMs: config.timeoutMs ?? 5000
    });

    guard.tick();
    const res = sandbox.run<T>(config.code, config.context);

    if (!res.success) {
      throw new Error(`Script execution error: ${res.error}`);
    }

    return {
      result: res.result as T,
      durationMs: res.executionTimeMs
    };
  }
}
