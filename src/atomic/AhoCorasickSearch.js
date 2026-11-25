import { ExactSearchAtom, TASK } from './ExactSearchAtom.js';
import { buildAlphabet } from '../functions/alphabet.js';
import { prepareAhoCorasick, searchAhoCorasick } from '../functions/ahoCorasick.js';
import { log2 } from '../functions/cost.js';

/** Aho-Corasick: bütün desenler için tek otomat, metin üzerinde tek geçiş. */
export class AhoCorasickSearch extends ExactSearchAtom {
  static manifest = {
    name: 'AhoCorasickSearch', version: '0.1.0', kind: 'atom', task: TASK,
    title: 'Exact match (Aho-Corasick)', references: ['Aho & Corasick 1975'],
  };

  static selection = {
    features(shape) {
      const A = shape.patternSigma + 1;
      const cells = (shape.totalLength + 1) * A; // DFA tablosu üst sınırı
      return {
        scan: shape.n,
        // tablo büyüdükçe önbellek kaçırmaları artar: n · log2(tablo boyutu)
        scanMem: shape.n * Math.max(0, log2(cells * 4) - 15),
        prep: cells,
        base: 1,
      };
    },
    defaults: { scan: 2e-9, scanMem: 3e-10, prep: 3e-9, base: 5e-5 },
  };

  constructor(params) {
    super(params);
    this.alphabet = buildAlphabet(this.unique);
    this.prep = prepareAhoCorasick(this.unique, this.alphabet);
  }

  search(text, hits) {
    searchAhoCorasick(text, this.alphabet.map, this.prep, hits);
  }
}
