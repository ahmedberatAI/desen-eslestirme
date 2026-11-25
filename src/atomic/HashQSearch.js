import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet } from '../functions/alphabet.js';
import { prepareHashQ, searchHashQ, chooseQ } from '../functions/hashQ.js';
import { expectedShift, sumOverLengths } from '../functions/cost.js';

/** HASHq (Lecroq 2007): q-gram özetleri üzerinden kayma; uzun desenler ve küçük alfabeler için. */
export class HashQSearch extends ExactSearchAtom {
  static manifest = {
    name: 'HashQSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (HASHq, q-gram Horspool)', references: ['Lecroq 2007', 'Wu & Manber 1994'],
  };

  static selection = {
    features(shape) {
      const s = Math.max(1, shape.sigmaEff);
      const A = shape.patternSigma + 1;
      return {
        scan: sumOverLengths(shape, (m) => {
          const q = chooseQ(m, A);
          return (shape.n / expectedShift(m - q + 1, Math.pow(s, q))) * q;
        }),
        prep: sumOverLengths(shape, (m) => Math.pow(A, chooseQ(m, A)) + m),
        base: 1,
      };
    },
    defaults: { scan: 1e-9, prep: 2e-9, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.preps = this.unique.map((p) => prepareHashQ(p, this.alphabet));
  }

  search(text, hits) {
    const map = this.alphabet.map;
    for (let uid = 0; uid < this.preps.length; uid++) searchHashQ(text, map, this.preps[uid], uid, hits);
  }
}
