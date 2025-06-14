import { DLQReprocessor } from '../../src/queue/DLQReprocessor';

describe('DLQReprocessor', () => {
  it('should quarantine items exceeding retry limits', () => {
    const reprocessor = new DLQReprocessor<string>(2);
    const item = { id: 'x', payload: 'bad task', retryCount: 1, lastError: 'fail' };

    expect(reprocessor.processItem(item).action).toBe('RETRY');
    expect(item.retryCount).toBe(2);

    expect(reprocessor.processItem(item).action).toBe('QUARANTINE');
    expect(reprocessor.getQuarantined().length).toBe(1);
  });
});
