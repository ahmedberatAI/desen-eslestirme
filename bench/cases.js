// Deney vakaları: kalibrasyon ızgarası ve doğrulama kümesi.

import { readFileSync } from 'node:fs';
import { mulberry32, randInt, randomText, makePatterns } from './data.js';
import { parseJsonl } from '../src/corpus.js';

export const GRID = {
  alphabets: ['actions', 'hex', 'code'],
  n: [1e4, 1e5, 1e6],
  m: [4, 8, 16, 32, 64],
  k: [1, 8, 64, 512],
};

export const QUICK_GRID = { alphabets: ['actions', 'hex'], n: [2e3, 2e4], m: [4, 16], k: [1, 16] };

/** Kalibrasyon ızgarası: 3 alfabe × 3 n × 5 m × 4 k = 180 vaka (tohum 1000 + sıra). */
export function calibrationCases(grid = GRID) {
  const cases = [];
  let i = 0;
  for (const alphabet of grid.alphabets)
    for (const n of grid.n)
      for (const m of grid.m)
        for (const k of grid.k) cases.push({ id: `cal-${i}`, alphabet, n, m, k, seed: 1000 + i++ });
  return cases;
}

/**
 * Doğrulama kümesi: kalibrasyonda kullanılmayan tohumlar (900000+), ızgara noktalarının
 * ARASINDAN seçilen n, k, m değerleri, karışık uzunluklu desenler ve kalibrasyonda olmayan iki
 * alfabe (binary, unicode). Ek olarak gerçek veri vakaları (llm.c train_gpt2.c, HumanEval).
 */
export function validationCases({ perAlphabet = 22, real = true, seed = 424242 } = {}) {
  const rng = mulberry32(seed);
  const cases = [];
  const alphabets = ['actions', 'hex', 'code', 'binary', 'unicode'];
  let i = 0;
  for (const alphabet of alphabets) {
    for (let j = 0; j < perAlphabet; j++) {
      const n = Math.round(10 ** (4.15 + rng() * 1.75)); // ~14 000 .. ~800 000
      const k = Math.max(1, Math.round(10 ** (rng() * 2.6))); // 1 .. ~400
      let m;
      if (rng() < 0.5) m = randInt(rng, 3, 80);
      else {
        const lo = randInt(rng, 3, 30);
        m = [lo, lo + randInt(rng, 1, 40)];
      }
      cases.push({ id: `val-${i}`, alphabet, n, m, k, seed: 900000 + i++ });
    }
  }
  if (real) {
    const reals = [
      ['gpt2', 1, 6], ['gpt2', 1, 60], ['gpt2', 20, [8, 20]], ['gpt2', 200, [10, 30]], ['gpt2', 1000, [12, 16]],
      ['humaneval', 1, 5], ['humaneval', 30, [4, 10]], ['humaneval', 300, [5, 12]],
      ['gpt2x4', 5, [40, 70]], ['gpt2x4', 100, [6, 9]],
    ];
    for (const [source, k, m] of reals) cases.push({ id: `val-${i}`, source, alphabet: source, n: null, m, k, seed: 900000 + i++ });
  }
  return cases;
}

let gpt2Text;
let humanevalDocs;
const DATA = new URL('../tests/data/', import.meta.url);
/** GPT-2 eğitim kaynak dosyası (karpathy/llm.c train_gpt2.c), tek belge. */
export function gpt2() {
  gpt2Text ??= readFileSync(new URL('train_gpt2.c', DATA), 'utf8');
  return gpt2Text;
}
/** OpenAI HumanEval: 164 problem, her biri bir belge (prompt + canonical_solution). */
export function humaneval() {
  humanevalDocs ??= parseJsonl(readFileSync(new URL('humaneval.jsonl', DATA), 'utf8'));
  return humanevalDocs;
}

/** Vakanın girdisini (belgeler + desenler) tohumdan yeniden üretir. */
export function buildCase(c) {
  const rng = mulberry32(c.seed);
  let docs;
  let alphabet = c.alphabet;
  if (c.source === 'gpt2' || c.source === 'gpt2x4') {
    const text = c.source === 'gpt2' ? gpt2() : gpt2().repeat(4);
    docs = [{ id: c.source === 'gpt2' ? 'llm.c/train_gpt2.c' : 'llm.c/train_gpt2.c ×4', text }];
    alphabet = 'code';
  } else if (c.source === 'humaneval') {
    docs = humaneval();
    alphabet = 'code';
  } else {
    docs = [{ id: `${c.id} ${c.alphabet} n=${c.n}`, text: randomText(rng, c.alphabet, c.n) }];
  }
  const corpus = docs.length === 1 ? docs[0].text : docs.map((d) => d.text).join('');
  const patterns = makePatterns(rng, corpus, alphabet, c.k, c.m, 0.5);
  return { docs, params: { patterns, ignoreCase: false } };
}
