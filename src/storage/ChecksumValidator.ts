export class ChecksumValidator {
  public static computeAdler32(data: Buffer | string): number {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const MOD_ADLER = 65521;
    let a = 1;
    let b = 0;

    for (let i = 0; i < buf.length; i++) {
      a = (a + buf[i]) % MOD_ADLER;
      b = (b + a) % MOD_ADLER;
    }

    return ((b << 16) | a) >>> 0;
  }

  public static verifyAdler32(data: Buffer | string, expected: number): boolean {
    return this.computeAdler32(data) === expected;
  }
}
