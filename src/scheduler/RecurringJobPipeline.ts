export interface PipelineJob {
  name: string;
  run: () => Promise<void>;
}

export class RecurringJobPipeline {
  private jobs: PipelineJob[] = [];

  public addStep(name: string, run: () => Promise<void>): this {
    this.jobs.push({ name, run });
    return this;
  }

  public async execute(): Promise<string[]> {
    const executed: string[] = [];
    for (const job of this.jobs) {
      await job.run();
      executed.push(job.name);
    }
    return executed;
  }
}
