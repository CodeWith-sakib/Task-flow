import { TokenRevocationList } from '../../src/security/TokenRevocationList';

describe('TokenRevocationList', () => {
  it('should track revoked tokens accurately', () => {
    const list = new TokenRevocationList();
    expect(list.isRevoked('tok-1')).toBe(false);
    list.revoke('tok-1');
    expect(list.isRevoked('tok-1')).toBe(true);
  });
});
