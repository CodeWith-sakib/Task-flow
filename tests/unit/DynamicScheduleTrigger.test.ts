import { DynamicScheduleTrigger } from '../../src/scheduler/DynamicScheduleTrigger';

describe('DynamicScheduleTrigger', () => {
  it('should dynamically update schedule interval and due time', () => {
    const trigger = new DynamicScheduleTrigger(5000);
    expect(trigger.isDue(Date.now() + 1000)).toBe(false);
    expect(trigger.isDue(Date.now() + 6000)).toBe(true);

    trigger.updateInterval(10000);
    expect(trigger.isDue(Date.now() + 6000)).toBe(false);
  });
});
