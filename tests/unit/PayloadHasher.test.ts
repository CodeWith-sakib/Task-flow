import { PayloadHasher } from '../../src/security/PayloadHasher';

describe('PayloadHasher', () => {
  it('should generate identical hashes for equivalent objects regardless of property insertion order', () => {
    const h1 = PayloadHasher.computeHash({ a: 1, b: 2 });
    const h2 = PayloadHasher.computeHash({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });
});
