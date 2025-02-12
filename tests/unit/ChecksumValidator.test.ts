import { ChecksumValidator } from '../../src/storage/ChecksumValidator';

describe('ChecksumValidator', () => {
  it('should compute consistent adler32 checksums', () => {
    const checksum1 = ChecksumValidator.computeAdler32('Wikipedia');
    const checksum2 = ChecksumValidator.computeAdler32('Wikipedia');
    expect(checksum1).toBe(checksum2);
    expect(ChecksumValidator.verifyAdler32('Wikipedia', checksum1)).toBe(true);
    expect(ChecksumValidator.verifyAdler32('Corrupted', checksum1)).toBe(false);
  });
});
