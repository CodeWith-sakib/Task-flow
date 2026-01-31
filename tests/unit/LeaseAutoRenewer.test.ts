import { LeaseAutoRenewer } from '../../src/concurrency/LeaseAutoRenewer';

describe('LeaseAutoRenewer', () => {
  it('should maintain healthy status when renewed', () => {
    const renewer = new LeaseAutoRenewer();
    renewer.trackLease('lease-1', 5000);
    expect(renewer.isHealthy('lease-1')).toBe(true);

    renewer.renewLease('lease-1', 10000);
    expect(renewer.isHealthy('lease-1')).toBe(true);

    renewer.stopTracking('lease-1');
    expect(renewer.isHealthy('lease-1')).toBe(false);
  });
});
