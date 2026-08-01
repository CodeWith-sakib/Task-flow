import * as zlib from 'zlib';

export class CompressionPlugin {
  public static compressString(input: string): string {
    return zlib.deflateSync(Buffer.from(input, 'utf8')).toString('base64');
  }

  public static decompressString(compressedBase64: string): string {
    const buf = Buffer.from(compressedBase64, 'base64');
    return zlib.inflateSync(buf).toString('utf8');
  }
}
