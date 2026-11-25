import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { prepareRabinKarp, searchRabinKarp } from '../functions/rabinKarp.js';

/** Rabin-Karp (çok desenli): her farklı desen uzunluğu için tek kayan özet geçişi. */
export class RabinKarpSearch extends ExactSearchAtom {
  static manifest = {
    name: 'RabinKarpSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Rabin-Karp, multi-pattern rolling hash)', references: ['Karp & Rabin 1987'],
  };

  static selection = {
    features(shape) {
      // filtre doluluğu: aynı uzunluktaki desen sayısı / filtre bit sayısı (yanlış pozitif oranı)
      let probe = 0;
      for (const [, count] of shape.lengths) {
        let size = 4;
        while (size < count * 2) size <<= 1;
        const bits = Math.min(1 << 22, Math.max(1 << 10, size * 16));
        probe += shape.n * Math.min(1, count / bits);
      }
      return {
        scan: shape.n * shape.distinctLengths,
        probe,
        prep: shape.totalLength,
        base: 1,
      };
    },
    defaults: { scan: 3e-9, probe: 2e-8, prep: 1e-8, base: 2e-5 },
  };

  constructor(params) {
    super(params);
    this.prep = prepareRabinKarp(this.unique);
  }

  search(text, hits) {
    searchRabinKarp(text, this.prep, hits);
  }
}
