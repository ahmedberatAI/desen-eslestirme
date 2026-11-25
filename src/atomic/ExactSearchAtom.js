// Ortak atom sınıfı (görev: text.pattern-match.exact).
//
// Sorumlulukları:
//  - parametre kontrolü (boş liste / boş desen -> hata),
//  - ignoreCase: desen ve metinde yalnızca ASCII a–z -> A–Z katlaması,
//  - yinelenen desenlerin (katlamadan sonra) tek kez aranması,
//  - çıktının sözleşmedeki sıraya konması ve Text.Match nesnelerinin üretilmesi.
//
// Alt sınıflar yalnızca şunları yazar:
//  - constructor(params): super(params) çağrısından sonra this.unique üzerinde ön işleme,
//  - search(text, hits): metinde bütün eşleşmeleri bulup hits.add(pos, uid) çağırmak.
//    `text` zaten katlanmıştır ve boş değildir. `uid`, this.unique dizisindeki indekstir.

import { foldAscii } from '../functions/alphabet.js';
import { HitList, keysToMatches } from '../functions/hits.js';

export const TASK = 'text.pattern-match.exact';

export function validateParams(params) {
  if (params === null || typeof params !== 'object') throw new TypeError('params bir nesne olmalı');
  const { patterns, ignoreCase = false } = params;
  if (!Array.isArray(patterns)) throw new TypeError('params.patterns bir dizi olmalı');
  if (patterns.length === 0) throw new RangeError('params.patterns boş olamaz');
  patterns.forEach((p, i) => {
    if (typeof p !== 'string') throw new TypeError(`patterns[${i}] bir dizgi olmalı`);
    if (p.length === 0) throw new RangeError(`patterns[${i}] boş dizgi olamaz`);
  });
  if (typeof ignoreCase !== 'boolean') throw new TypeError('params.ignoreCase boolean olmalı');
  return { patterns: patterns.slice(), ignoreCase };
}

export function validateDocument(doc) {
  if (doc === null || typeof doc !== 'object') throw new TypeError('Corpus.Document bir nesne olmalı');
  if (typeof doc.id !== 'string') throw new TypeError('doc.id bir dizgi olmalı');
  if (typeof doc.text !== 'string') throw new TypeError('doc.text bir dizgi olmalı');
}

export class ExactSearchAtom {
  static manifest = {
    name: 'ExactSearchAtom', version: '0.1.0', kind: 'abstract',
    task: TASK, title: 'Exact match (abstract base)', references: [],
  };

  constructor(params) {
    const { patterns, ignoreCase } = validateParams(params);
    /** Özgün desenler (çıktıda bunlar yazılır). */
    this.patterns = patterns;
    this.ignoreCase = ignoreCase;
    /** Benzersiz (katlanmış) arama desenleri ve her birine karşılık gelen özgün indeksler. */
    this.unique = [];
    this.groups = [];
    const seen = new Map();
    patterns.forEach((p, i) => {
      const s = ignoreCase ? foldAscii(p) : p;
      let uid = seen.get(s);
      if (uid === undefined) {
        uid = this.unique.length;
        seen.set(s, uid);
        this.unique.push(s);
        this.groups.push([]);
      }
      this.groups[uid].push(i);
    });
    let lo = Infinity;
    let hi = 0;
    for (const p of this.unique) {
      if (p.length < lo) lo = p.length;
      if (p.length > hi) hi = p.length;
    }
    this.minLength = lo;
    this.maxLength = hi;
  }

  /** Bir Corpus.Document için Text.Match nesneleri üretir (sıralı). */
  *process(doc) {
    validateDocument(doc);
    const raw = doc.text;
    if (raw.length === 0 || raw.length < this.minLength) return;
    const text = this.ignoreCase ? foldAscii(raw) : raw;
    const hits = new HitList();
    this.search(text, hits);
    if (hits.length === 0) return;
    yield* keysToMatches(hits.sortedKeys(this.groups, this.patterns.length), doc.id, this.patterns);
  }

  /** Kolaylık: birden çok belgeyi sırayla işler. */
  *run(docs) {
    for (const d of docs) yield* this.process(d);
  }

  // eslint-disable-next-line no-unused-vars
  search(text, hits) {
    throw new Error(`${this.constructor.name}.search() yazılmamış`);
  }
}
