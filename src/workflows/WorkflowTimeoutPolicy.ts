export class WorkflowTimeoutPolicy {
  public static async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string = 'Workflow step timed out'): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    });

    return Promise.race([
      promise.finally(() => clearTimeout(timer)),
      timeoutPromise
    ]);
  }
}
