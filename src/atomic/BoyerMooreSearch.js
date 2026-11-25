import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet } from '../functions/alphabet.js';
import { prepareBoyerMoore, searchBoyerMoore } from '../functions/boyerMoore.js';
import { expectedShift, sumOverLengths } from '../functions/cost.js';

/** Tam bir örnek atom: Boyer-Moore (kötü karakter + iyi sonek). */
export class BoyerMooreSearch extends ExactSearchAtom {
  static manifest = {
    name: 'BoyerMooreSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Boyer-Moore)', references: ['Boyer & Moore 1977'],
  };

  static selection = {
    features(shape) {
      const s = shape.sigmaEff;
      return {
        scan: sumOverLengths(shape, (m) => shape.n / expectedShift(m, s)),
        prep: sumOverLengths(shape, (m) => 2 * m + shape.patternSigma + 1),
        base: 1,
      };
    },
    defaults: { scan: 3e-9, prep: 2e-8, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.preps = this.unique.map((p) => prepareBoyerMoore(p, this.alphabet));
  }

  search(text, hits) {
    const map = this.alphabet.map;
    for (let uid = 0; uid < this.preps.length; uid++) {
      if (this.preps[uid].m <= text.length) searchBoyerMoore(text, map, this.preps[uid], uid, hits);
    }
  }
}
