import { ParallelBranchExecutor } from '../../src/workflows/ParallelBranchExecutor';

describe('ParallelBranchExecutor', () => {
  it('should run parallel branches and capture individual outcomes', async () => {
    const branches = [
      { id: 'b1', run: async () => 10 },
      { id: 'b2', run: async () => { throw new Error('fail'); } }
    ];

    const results = await ParallelBranchExecutor.executeAll(branches);
    expect(results[0].result).toBe(10);
    expect(results[1].error?.message).toBe('fail');
  });
});
