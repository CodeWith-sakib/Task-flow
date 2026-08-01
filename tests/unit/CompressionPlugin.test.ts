import { CompressionPlugin } from '../../src/plugins/CompressionPlugin';

describe('CompressionPlugin', () => {
  it('should compress and decompress strings losslessly with zlib deflate/inflate', () => {
    const text = 'TaskFlow Engine Distributed Workflow and Job Processing Platform';
    const compressed = CompressionPlugin.compressString(text);
    const restored = CompressionPlugin.decompressString(compressed);
    expect(restored).toBe(text);
  });
});
