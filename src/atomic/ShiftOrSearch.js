import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet } from '../functions/alphabet.js';
import { prepareShiftOr, searchShiftOr, WORD } from '../functions/shiftOr.js';
import { sumOverLengths } from '../functions/cost.js';

/** Shift-Or (bit paralel). m ≤ 32 doğrudan; m > 32 için 32 karakterlik filtre + doğrulama. */
export class ShiftOrSearch extends ExactSearchAtom {
  static manifest = {
    name: 'ShiftOrSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Shift-Or, bit-parallel)', references: ['Baeza-Yates & Gonnet 1992'],
  };

  static selection = {
    features(shape) {
      return {
        scan: sumOverLengths(shape, () => shape.n),
        // m > 32: filtre adaylarında doğrulama (rastgele metinde ~ n / s^32, pratikte 0)
        verify: sumOverLengths(shape, (m) => (m > WORD ? shape.n * Math.pow(1 / Math.max(1, shape.sigmaEff), WORD) * (m - WORD) : 0)),
        base: 1,
      };
    },
    defaults: { scan: 1e-9, verify: 1e-9, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.preps = this.unique.map((p) => prepareShiftOr(p, this.alphabet));
  }

  search(text, hits) {
    const map = this.alphabet.map;
    for (let uid = 0; uid < this.preps.length; uid++) searchShiftOr(text, map, this.preps[uid], uid, hits);
  }
}
