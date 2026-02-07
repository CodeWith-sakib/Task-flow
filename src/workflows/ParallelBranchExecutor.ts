export interface BranchTask<T> {
  id: string;
  run: () => Promise<T>;
}

export class ParallelBranchExecutor {
  public static async executeAll<T>(branches: BranchTask<T>[]): Promise<Array<{ id: string; result?: T; error?: Error }>> {
    return Promise.all(
      branches.map(async b => {
        try {
          const res = await b.run();
          return { id: b.id, result: res };
        } catch (err) {
          return { id: b.id, error: err as Error };
        }
      })
    );
  }
}
