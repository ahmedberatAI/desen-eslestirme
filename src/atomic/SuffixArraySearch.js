import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { compressText, buildSuffixArray, saRange, encodeForText } from '../functions/suffixArray.js';
import { log2, sumOverLengths } from '../functions/cost.js';

export const INDEX_LIMIT = 1 << 24;

/** Suffix array + ikili arama: metin dizinlenir, her desen O(m log n) ile sorgulanır. */
export class SuffixArraySearch extends ExactSearchAtom {
  static manifest = {
    name: 'SuffixArraySearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (suffix array + binary search)', references: ['Manber & Myers 1993'],
  };

  static selection = {
    features(shape) {
      const lg = log2(shape.n + 1);
      return {
        prep: shape.n * lg,
        query: sumOverLengths(shape, (m) => 2 * lg * Math.min(m, 1 + Math.log(shape.n + 1) / Math.log(Math.max(2, shape.sigmaEff)))),
        base: 1,
      };
    },
    defaults: { prep: 3e-8, query: 5e-8, base: 5e-5 },
    applicable(shape) {
      return shape.n <= INDEX_LIMIT ? true : `metin çok uzun (n=${shape.n} > ${INDEX_LIMIT}); dizin belleği aşırı`;
    },
  };

  search(text, hits) {
    const { codes, sigma, rankOf } = compressText(text);
    const sa = buildSuffixArray(codes, sigma);
    for (let uid = 0; uid < this.unique.length; uid++) {
      const pat = this.unique[uid];
      if (pat.length > text.length) continue;
      const p = encodeForText(pat, rankOf);
      if (p === null) continue;
      const [lo, hi] = saRange(codes, sa, p);
      for (let r = lo; r < hi; r++) hits.add(sa[r], uid);
    }
  }
}
