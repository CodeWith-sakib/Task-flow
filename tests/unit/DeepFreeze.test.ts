import { DeepFreeze } from '../../src/utils/DeepFreeze';

describe('DeepFreeze', () => {
  it('should recursively freeze nested objects', () => {
    const data = { nested: { value: 123 } };
    DeepFreeze.freeze(data);

    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.nested)).toBe(true);
  });
});
