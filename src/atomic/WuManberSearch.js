import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet } from '../functions/alphabet.js';
import { prepareWuManber, searchWuManber, chooseBlock } from '../functions/wuManber.js';
import { expectedShift } from '../functions/cost.js';

/** Wu-Manber: çok desenli blok kayması (bonus: ileri atom). */
export class WuManberSearch extends ExactSearchAtom {
  static manifest = {
    name: 'WuManberSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Wu-Manber)', references: ['Wu & Manber 1994'],
  };

  static selection = {
    features(shape) {
      const A = shape.patternSigma + 1;
      const L = shape.mMin;
      const k = shape.kUnique;
      const B = chooseBlock(L, A, k);
      const sB = Math.pow(Math.max(1, shape.sigmaEff), B);
      const steps = shape.n / expectedShift(L - B + 1, sB, k);
      // kayma 0 olasılığı ve kovadaki beklenen aday sayısı
      const pZero = 1 - Math.pow(1 - 1 / sB, k);
      return {
        scan: steps * B,
        verify: steps * pZero * (1 + k / sB),
        prep: Math.pow(A, B) + k * L * B,
        base: 1,
      };
    },
    defaults: { scan: 2e-9, verify: 2e-8, prep: 1e-9, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.prep = prepareWuManber(this.unique, this.alphabet);
  }

  search(text, hits) {
    searchWuManber(text, this.alphabet.map, this.prep, hits);
  }
}
