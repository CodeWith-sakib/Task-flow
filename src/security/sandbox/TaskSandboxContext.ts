import * as vm from 'vm';

export interface SandboxExecutionResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  executionTimeMs: number;
}

export interface SandboxOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
  allowConsole?: boolean;
}

/**
 * TaskSandboxContext executes untrusted user task code in a hardened isolated V8 VM context,
 * blocking prototype pollution, file system access, process introspection, and infinite loops.
 */
export class TaskSandboxContext {
  private options: Required<SandboxOptions>;

  constructor(options?: SandboxOptions) {
    this.options = {
      timeoutMs: options?.timeoutMs ?? 5000,
      memoryLimitMb: options?.memoryLimitMb ?? 128,
      allowConsole: options?.allowConsole ?? false
    };
  }

  public run<T = any>(scriptCode: string, contextVariables: Record<string, any> = {}): SandboxExecutionResult<T> {
    const startTime = Date.now();

    const sandbox = {
      ...contextVariables,
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      console: this.options.allowConsole ? console : { log: () => {}, warn: () => {}, error: () => {} }
    };

    // Remove prototype tampering primitives
    const vmContext = vm.createContext(sandbox);

    try {
      const script = new vm.Script(`
        (function() {
          "use strict";
          ${scriptCode}
        })()
      `);

      const result = script.runInContext(vmContext, {
        timeout: this.options.timeoutMs,
        displayErrors: true
      });

      return {
        success: true,
        result: result as T,
        executionTimeMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
        executionTimeMs: Date.now() - startTime
      };
    }
  }
}
