import { CircularBuffer } from '../../src/utils/CircularBuffer';

describe('CircularBuffer', () => {
  it('should overwrite oldest items once capacity is exceeded', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);

    buf.push(4);
    expect(buf.toArray()).toEqual([2, 3, 4]);
  });
});
