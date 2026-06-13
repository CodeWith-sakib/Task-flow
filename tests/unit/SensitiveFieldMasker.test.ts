import { SensitiveFieldMasker } from '../../src/security/SensitiveFieldMasker';

describe('SensitiveFieldMasker', () => {
  it('should mask sensitive keys in nested payloads', () => {
    const masker = new SensitiveFieldMasker();
    const input = {
      username: 'sakib',
      password: 'supersecretpassword',
      config: { apiKey: 'secret-key-123' }
    };

    const output = masker.mask(input);
    expect(output.username).toBe('sakib');
    expect(output.password).toBe('***REDACTED***');
    expect((output.config as any).apiKey).toBe('***REDACTED***');
  });
});
