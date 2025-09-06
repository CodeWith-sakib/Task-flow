import { RecurringJobPipeline } from '../../src/scheduler/RecurringJobPipeline';

describe('RecurringJobPipeline', () => {
  it('should execute pipeline steps sequentially', async () => {
    const log: string[] = [];
    const pipeline = new RecurringJobPipeline()
      .addStep('step1', async () => { log.push('step1'); })
      .addStep('step2', async () => { log.push('step2'); });

    const executed = await pipeline.execute();
    expect(executed).toEqual(['step1', 'step2']);
    expect(log).toEqual(['step1', 'step2']);
  });
});
