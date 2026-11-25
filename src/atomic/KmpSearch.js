import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { prepareKmp, searchKmp } from '../functions/kmp.js';
import { sumOverLengths } from '../functions/cost.js';

/** Knuth-Morris-Pratt: en kötü durumda da doğrusal, metinde geri gitmez. */
export class KmpSearch extends ExactSearchAtom {
  static manifest = {
    name: 'KmpSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Knuth-Morris-Pratt)', references: ['Knuth, Morris & Pratt 1977'],
  };

  static selection = {
    features(shape) {
      return {
        // her karakter bir kez okunur; başarısızlık geçişleri ortalama ~1/s ek adım
        scan: sumOverLengths(shape, () => shape.n * (1 + 1 / Math.max(1, shape.sigmaEff))),
        prep: shape.totalLength,
        base: 1,
      };
    },
    defaults: { scan: 1.5e-9, prep: 1e-8, base: 5e-6 },
  };

  constructor(params) {
    super(params);
    this.preps = this.unique.map((p) => prepareKmp(p));
  }

  search(text, hits) {
    for (let uid = 0; uid < this.preps.length; uid++) searchKmp(text, this.preps[uid], uid, hits);
  }
}
