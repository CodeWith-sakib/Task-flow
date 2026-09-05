export type MiddlewareFn = (context: Record<string, unknown>, next: () => Promise<void>) => Promise<void>;

export class TaskExecutionPipeline {
  private middlewares: MiddlewareFn[] = [];

  public use(fn: MiddlewareFn): this {
    this.middlewares.push(fn);
    return this;
  }

  public async execute(context: Record<string, unknown>): Promise<void> {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = this.middlewares[i];
      if (fn) {
        await fn(context, () => dispatch(i + 1));
      }
    };
    await dispatch(0);
  }
}
