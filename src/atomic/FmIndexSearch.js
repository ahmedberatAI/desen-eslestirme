import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildFmIndex, searchFm } from '../functions/fmIndex.js';
import { log2, sumOverLengths } from '../functions/cost.js';
import { INDEX_LIMIT } from './SuffixArraySearch.js';

/** FM-index (backward search) — bonus: ileri atom. */
export class FmIndexSearch extends ExactSearchAtom {
  static manifest = {
    name: 'FmIndexSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (FM-index backward search)', references: ['Ferragina & Manzini 2000'],
  };

  static selection = {
    features(shape) {
      return {
        prep: shape.n * log2(shape.n + 1),
        occ: shape.n * (shape.sigma + 2) / 64,
        query: sumOverLengths(shape, (m) => m),
        base: 1,
      };
    },
    defaults: { prep: 3.5e-8, occ: 1e-9, query: 1e-7, base: 5e-5 },
    applicable(shape) {
      return shape.n <= INDEX_LIMIT ? true : `metin çok uzun (n=${shape.n} > ${INDEX_LIMIT}); dizin belleği aşırı`;
    },
  };

  search(text, hits) {
    const fm = buildFmIndex(text);
    for (let uid = 0; uid < this.unique.length; uid++) searchFm(fm, this.unique[uid], uid, hits);
  }
}
