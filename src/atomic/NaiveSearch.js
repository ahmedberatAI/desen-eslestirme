import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { searchNaive } from '../functions/naive.js';
import { expectedComparisons, sumOverLengths } from '../functions/cost.js';

/** Kaba kuvvet referans uygulama (test oracle'ı). */
export class NaiveSearch extends ExactSearchAtom {
  static manifest = {
    name: 'NaiveSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (naive reference)', references: ['Charras & Lecroq, Brute Force'],
  };

  static selection = {
    features(shape) {
      return {
        scan: sumOverLengths(shape, (m) => Math.max(0, shape.n - m + 1) * expectedComparisons(m, shape.sigmaEff)),
        base: 1,
      };
    },
    defaults: { scan: 1.5e-9, base: 5e-6 },
  };

  search(text, hits) {
    const u = this.unique;
    for (let uid = 0; uid < u.length; uid++) searchNaive(text, u[uid], uid, hits);
  }
}
