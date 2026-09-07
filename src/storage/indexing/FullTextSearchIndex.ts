/**
 * Full-Text Search Engine with BM25 & TF-IDF Scoring.
 * Implements tokenization, stop-word elimination, term-frequency inversion,
 * document-length normalization, and phrase matching for logs and metadata.
 */

export interface DocumentPosting {
  docId: string;
  termFrequency: number;
  positions: number[];
}

export interface SearchResult {
  docId: string;
  score: number;
}

export class FullTextSearchIndex {
  private invertedIndex = new Map<string, DocumentPosting[]>();
  private docLengths = new Map<string, number>();
  private totalDocs = 0;
  private avgDocLength = 0;

  // BM25 tuning parameters
  private k1: number;
  private b: number;

  private stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'with'
  ]);

  constructor(k1: number = 1.2, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  public indexDocument(docId: string, text: string): void {
    const tokens = this.tokenize(text);
    this.docLengths.set(docId, tokens.length);
    this.totalDocs++;

    // Update average document length
    let sumLen = 0;
    for (const len of this.docLengths.values()) {
      sumLen += len;
    }
    this.avgDocLength = sumLen / this.totalDocs;

    // Track term positions in document
    const termPositions = new Map<string, number[]>();

    for (let pos = 0; pos < tokens.length; pos++) {
      const token = tokens[pos];
      let positions = termPositions.get(token);
      if (!positions) {
        positions = [];
        termPositions.set(token, positions);
      }
      positions.push(pos);
    }

    // Update inverted index
    for (const [term, positions] of termPositions.entries()) {
      let postings = this.invertedIndex.get(term);
      if (!postings) {
        postings = [];
        this.invertedIndex.set(term, postings);
      }

      postings.push({
        docId,
        termFrequency: positions.length,
        positions,
      });
    }
  }

  public search(query: string, limit: number = 10): SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.totalDocs === 0) {
      return [];
    }

    const scores = new Map<string, number>();

    for (const term of queryTokens) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      // IDF calculation (Robertson-Spärck Jones formula)
      const docFreq = postings.length;
      const idf = Math.log(1 + (this.totalDocs - docFreq + 0.5) / (docFreq + 0.5));

      for (const posting of postings) {
        const docLen = this.docLengths.get(posting.docId) || this.avgDocLength;
        const tf = posting.termFrequency;

        // BM25 term score
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (this.avgDocLength || 1)));
        const termScore = idf * (numerator / denominator);

        const currentScore = scores.get(posting.docId) || 0;
        scores.set(posting.docId, currentScore + termScore);
      }
    }

    return Array.from(scores.entries())
      .map(([docId, score]) => ({ docId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  public phraseSearch(phrase: string): string[] {
    const tokens = this.tokenize(phrase);
    if (tokens.length === 0) return [];
    if (tokens.length === 1) {
      return (this.invertedIndex.get(tokens[0]) || []).map((p) => p.docId);
    }

    const firstPostings = this.invertedIndex.get(tokens[0]);
    if (!firstPostings) return [];

    const matchedDocs: string[] = [];

    for (const p of firstPostings) {
      const docId = p.docId;
      let hasPhrase = false;

      for (const startPos of p.positions) {
        let matchesRemaining = true;

        for (let i = 1; i < tokens.length; i++) {
          const nextTerm = tokens[i];
          const nextPostings = this.invertedIndex.get(nextTerm);
          const nextPostingForDoc = nextPostings?.find((np) => np.docId === docId);

          if (!nextPostingForDoc || !nextPostingForDoc.positions.includes(startPos + i)) {
            matchesRemaining = false;
            break;
          }
        }

        if (matchesRemaining) {
          hasPhrase = true;
          break;
        }
      }

      if (hasPhrase) {
        matchedDocs.push(docId);
      }
    }

    return matchedDocs;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !this.stopWords.has(w));
  }
}
