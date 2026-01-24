import { ParallelTaskExecutor } from '../../src/concurrency/ParallelTaskExecutor';

describe('ParallelTaskExecutor', () => {
  it('should map items with bounded concurrency', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await ParallelTaskExecutor.mapConcurrent(items, 2, async x => x * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });
});
