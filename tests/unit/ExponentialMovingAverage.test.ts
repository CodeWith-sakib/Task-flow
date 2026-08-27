import { ExponentialMovingAverage } from '../../src/utils/ExponentialMovingAverage';

describe('ExponentialMovingAverage', () => {
  it('should smooth out consecutive readings', () => {
    const ema = new ExponentialMovingAverage(0.5);
    expect(ema.update(10)).toBe(10);
    expect(ema.update(20)).toBe(15);
    expect(ema.update(30)).toBe(22.5);
  });
});
