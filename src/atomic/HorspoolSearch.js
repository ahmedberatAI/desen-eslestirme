import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet } from '../functions/alphabet.js';
import { prepareHorspool, searchHorspool } from '../functions/horspool.js';
import { expectedShift, sumOverLengths } from '../functions/cost.js';

/** Horspool (BMH): yalnızca kötü karakter kayması, metin dizgisi üzerinde doğrudan. */
export class HorspoolSearch extends ExactSearchAtom {
  static manifest = {
    name: 'HorspoolSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Horspool)', references: ['Horspool 1980'],
  };

  static selection = {
    features(shape) {
      const s = shape.sigmaEff;
      return {
        scan: sumOverLengths(shape, (m) => shape.n / expectedShift(m, s)),
        prep: sumOverLengths(shape, (m) => m + shape.patternSigma + 1),
        base: 1,
      };
    },
    defaults: { scan: 2.5e-9, prep: 1e-8, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.preps = this.unique.map((p) => prepareHorspool(p, this.alphabet));
  }

  search(text, hits) {
    const map = this.alphabet.map;
    for (let uid = 0; uid < this.preps.length; uid++) {
      if (this.preps[uid].m <= text.length) searchHorspool(text, map, this.preps[uid], uid, hits);
    }
  }
}
