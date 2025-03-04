export class BlockCompressionCodec {
  public static compressRLE(text: string): string {
    if (!text) return '';
    let result = '';
    let count = 1;

    for (let i = 0; i < text.length; i++) {
      if (i + 1 < text.length && text[i] === text[i + 1]) {
        count++;
      } else {
        result += `${count}x${text[i]};`;
        count = 1;
      }
    }
    return result;
  }

  public static decompressRLE(compressed: string): string {
    if (!compressed) return '';
    const segments = compressed.split(';').filter(s => s.length > 0);
    let result = '';

    for (const seg of segments) {
      const parts = seg.split('x');
      const count = parseInt(parts[0], 10);
      const char = parts.slice(1).join('x');
      result += char.repeat(count);
    }
    return result;
  }
}
