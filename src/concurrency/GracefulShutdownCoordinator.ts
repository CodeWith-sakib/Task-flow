export type ShutdownHook = () => Promise<void>;

export class GracefulShutdownCoordinator {
  private hooks: ShutdownHook[] = [];
  private isShuttingDown: boolean = false;

  public registerHook(hook: ShutdownHook): void {
    this.hooks.push(hook);
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    for (const hook of this.hooks) {
      await hook();
    }
  }

  public isTerminating(): boolean {
    return this.isShuttingDown;
  }
}
