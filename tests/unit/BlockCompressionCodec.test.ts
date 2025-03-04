import { BlockCompressionCodec } from '../../src/storage/BlockCompressionCodec';

describe('BlockCompressionCodec', () => {
  it('should compress and decompress repeated strings losslessly', () => {
    const original = 'AAAAABBBCCDDDDDD';
    const compressed = BlockCompressionCodec.compressRLE(original);
    expect(compressed).toBe('5xA;3xB;2xC;6xD;');

    const decompressed = BlockCompressionCodec.decompressRLE(compressed);
    expect(decompressed).toBe(original);
  });
});
