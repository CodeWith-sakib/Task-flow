export interface SearchResult {
  docId: string;
  score: number;
}

/**
 * InvertedIndex provides full-text search and BM25 scoring over task log messages and text fields.
 */
export class InvertedIndex {
  private index: Map<string, Map<string, number>> = new Map(); // term -> docId -> termFrequency
  private docLengths: Map<string, number> = new Map(); // docId -> wordCount
  private k1: number; // BM25 term saturation parameter (default 1.2)
  private b: number;  // BM25 length normalization parameter (default 0.75)

  constructor(k1: number = 1.2, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  public addDocument(docId: string, text: string): void {
    const tokens = this.tokenize(text);
    this.docLengths.set(docId, tokens.length);

    for (const token of tokens) {
      if (!this.index.has(token)) {
        this.index.set(token, new Map());
      }
      const postings = this.index.get(token)!;
      const tf = postings.get(docId) || 0;
      postings.set(docId, tf + 1);
    }
  }

  public removeDocument(docId: string): void {
    this.docLengths.delete(docId);
    for (const postings of this.index.values()) {
      postings.delete(docId);
    }
  }

  public search(query: string, limit: number = 10): SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.docLengths.size === 0) return [];

    const scores = new Map<string, number>();
    const totalDocs = this.docLengths.size;
    const avgDocLength = Array.from(this.docLengths.values()).reduce((a, b) => a + b, 0) / totalDocs;

    for (const token of queryTokens) {
      const postings = this.index.get(token);
      if (!postings) continue;

      const docFreq = postings.size;
      // Robertson-Spärck Jones IDF
      const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);

      for (const [docId, tf] of postings.entries()) {
        const docLen = this.docLengths.get(docId) || 1;
        // BM25 term weight calculation
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLength));
        const termScore = idf * (numerator / denominator);

        scores.set(docId, (scores.get(docId) || 0) + termScore);
      }
    }

    const results: SearchResult[] = Array.from(scores.entries()).map(([docId, score]) => ({
      docId,
      score
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9_]+/i)
      .filter(t => t.length > 1);
  }
}
