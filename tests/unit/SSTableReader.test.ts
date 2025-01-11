import { SSTableReader } from '../../src/storage/SSTableReader';

describe('SSTableReader', () => {
  const sampleEntries = [
    { key: 'gamma', value: 3, timestamp: 1000 },
    { key: 'alpha', value: 1, timestamp: 1000 },
    { key: 'beta', value: 2, timestamp: 1000 },
    { key: 'delta', value: 4, timestamp: 1000 }
  ];

  it('should binary search and find keys correctly', () => {
    const reader = new SSTableReader<number>(sampleEntries);
    expect(reader.get('alpha')).toBe(1);
    expect(reader.get('beta')).toBe(2);
    expect(reader.get('gamma')).toBe(3);
    expect(reader.get('delta')).toBe(4);
    expect(reader.get('omega')).toBeUndefined();
  });

  it('should scan range inclusive', () => {
    const reader = new SSTableReader<number>(sampleEntries);
    const range = reader.scanRange('beta', 'gamma');
    expect(range.map(e => e.key)).toEqual(['beta', 'delta', 'gamma']);
  });

  it('should return min and max keys', () => {
    const reader = new SSTableReader<number>(sampleEntries);
    expect(reader.getMinKey()).toBe('alpha');
    expect(reader.getMaxKey()).toBe('gamma');
    expect(reader.count()).toBe(4);
  });
});
