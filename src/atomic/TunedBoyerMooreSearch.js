import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet, encodeText } from '../functions/alphabet.js';
import { prepareTunedBM, searchTunedBM } from '../functions/tunedBoyerMoore.js';
import { expectedShift, sumOverLengths } from '../functions/cost.js';

/** Tuned Boyer-Moore (Hume & Sunday 1991): sentinel + 3 kez açılmış atlama döngüsü; kısa desenler için. */
export class TunedBoyerMooreSearch extends ExactSearchAtom {
  static manifest = {
    name: 'TunedBoyerMooreSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Tuned Boyer-Moore, sentinel + unrolled skip loop)', references: ['Hume & Sunday 1991'],
  };

  static selection = {
    features(shape) {
      const s = shape.sigmaEff;
      return {
        enc: shape.n,
        scan: sumOverLengths(shape, (m) => shape.n / expectedShift(m, s)),
        prep: sumOverLengths(shape, (m) => m + shape.patternSigma + 1),
        base: 1,
      };
    },
    defaults: { enc: 1e-9, scan: 1.5e-9, prep: 1e-8, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.preps = this.unique.map((p) => prepareTunedBM(p, this.alphabet));
  }

  search(text, hits) {
    const n = text.length;
    const t = encodeText(text, this.alphabet, this.maxLength);
    for (let uid = 0; uid < this.preps.length; uid++) searchTunedBM(t, n, this.preps[uid], uid, hits);
  }
}
