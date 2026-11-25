// Görev 2: Doğruluk kanıtı. Her atom, aşağıdaki bütün veri kümelerinde NaiveSearch (oracle) ile
// eleman eleman aynı sonucu vermelidir. Molekül (auto) de aynı kümelerde denetlenir.
import test from 'node:test';
import { registry } from '../../src/registry.js';
import { ExactMatch } from '../../src/molecules/ExactMatch.js';
import { assertSameAsOracle, gpt2Docs, humanevalDocs } from '../helpers.js';
import { mulberry32, randInt, randomText, periodicText, makePatterns, ALPHABETS } from '../../bench/data.js';

const ATOMS = registry.list().filter((A) => A.manifest.name !== 'NaiveSearch');

class MoleculeAuto {
  static manifest = { name: 'ExactMatch(auto)' };
  constructor(params) {
    this.em = new ExactMatch({ ...params, strategy: 'auto' });
  }
  *run(docs) {
    yield* this.em.run(docs);
  }
}
const COMPONENTS = [...ATOMS, MoleculeAuto];

function checkAll(label, params, docs) {
  for (const C of COMPONENTS) assertSameAsOracle(C, params, docs, label);
}

// ---------------------------------------------------------------- gerçek veri
const gpt2 = gpt2Docs();
const gtext = gpt2[0].text;
const humaneval = humanevalDocs();

test('gerçek veri: llm.c train_gpt2.c, kısa desenler (4–8) ve API adları', () => {
  const rng = mulberry32(11);
  checkAll('gpt2 kısa', { patterns: makePatterns(rng, gtext, 'code', 6, [4, 8], 0.8) }, gpt2);
  checkAll('gpt2 API', { patterns: ['malloc', 'free(', 'float*', '#pragma omp', 'attention_forward', 'layernorm_backward'] }, gpt2);
});

test('gerçek veri: llm.c train_gpt2.c, uzun desenler (50–200)', () => {
  const rng = mulberry32(12);
  checkAll('gpt2 uzun', { patterns: makePatterns(rng, gtext, 'code', 5, [50, 200], 0.8) }, gpt2);
});

test('gerçek veri: llm.c train_gpt2.c, çok sayıda desen (300) + ignoreCase', () => {
  const rng = mulberry32(13);
  const patterns = makePatterns(rng, gtext, 'code', 300, [6, 24], 0.7);
  checkAll('gpt2 çok desen', { patterns }, gpt2);
  const mixed = patterns.slice(0, 40).map((p, i) => (i % 2 ? p.toLowerCase() : p.toUpperCase()));
  checkAll('gpt2 ignoreCase', { patterns: mixed, ignoreCase: true }, gpt2);
  checkAll('gpt2 TODO/todo', { patterns: ['todo', 'NOTE', 'Gpt2', 'B, T, C'], ignoreCase: true }, gpt2);
});

test('gerçek veri: 164 HumanEval problemi (çok belgeli akış)', () => {
  const rng = mulberry32(14);
  const corpus = humaneval.map((d) => d.text).join('');
  checkAll('humaneval tek', { patterns: ['def '] }, humaneval);
  checkAll('humaneval tanımlayıcılar', { patterns: makePatterns(rng, corpus, 'code', 50, [3, 12], 0.8) }, humaneval);
  checkAll('humaneval uzun', { patterns: makePatterns(rng, corpus, 'code', 5, [30, 60], 0.9) }, humaneval);
  checkAll('humaneval doctest', { patterns: ['>>> ', '    return ', 'List[int]', '"""'] }, humaneval);
});

// ---------------------------------------------------------------- sentetik veri
test('sentetik: eylem izi, hex, kaynak kod, ikili (01) ve çok dilli unicode alfabeleri', () => {
  const rng = mulberry32(21);
  for (const a of Object.keys(ALPHABETS)) {
    const text = randomText(rng, a, 5000);
    for (const m of [1, 2, 3, 5, 8, 16, 31, 32, 33, 64]) {
      checkAll(`${a} m=${m}`, { patterns: makePatterns(rng, text, a, 3, m, 0.7) }, [{ id: a, text }]);
    }
  }
});

test('sentetik: çok tekrarlı metinler (0000..., 0101..., UDLUDL..., girinti)', () => {
  for (const unit of ['0', '01', 'UDL', '    x']) {
    const text = periodicText(unit, 3000);
    const patterns = [unit, unit.repeat(3), unit.repeat(12), unit + '0', '0'.repeat(40), text.slice(1, 50)];
    checkAll(`periyodik ${JSON.stringify(unit)}`, { patterns }, [{ id: 'p', text }]);
  }
});

test('sentetik: karışık uzunluklu desenler, aynı desen iki kez, çok belgeli akış, ignoreCase', () => {
  const rng = mulberry32(22);
  const docs = [];
  for (let i = 0; i < 8; i++) docs.push({ id: `doc-${i}`, text: randomText(rng, i % 2 ? 'actions' : 'hex', randInt(rng, 0, 2000)) });
  const corpus = docs.map((d) => d.text).join('');
  const base = makePatterns(rng, corpus, 'actions', 20, [1, 40], 0.8);
  const patterns = [...base, base[0], base[3], base[3]];
  checkAll('akış', { patterns }, docs);
  const mixedCase = docs.map((d, i) => ({ id: d.id, text: i % 3 ? d.text.toLowerCase() : d.text }));
  checkAll('akış ignoreCase', { patterns: patterns.map((p, i) => (i % 2 ? p.toLowerCase() : p)), ignoreCase: true }, mixedCase);
});

// ---------------------------------------------------------------- tohumlu rastgele
test('tohumlu rastgele testler: 400 vaka (her biri bütün atomlar + molekül)', () => {
  const rng = mulberry32(20261125);
  const alphabets = ['actions', 'hex', 'code', 'binary', 'unicode', 'ab', '{}[]();'];
  for (let t = 0; t < 400; t++) {
    const a = alphabets[t % alphabets.length];
    const count = randInt(rng, 1, 3);
    const docs = [];
    for (let r = 0; r < count; r++) {
      const n = rng() < 0.1 ? randInt(rng, 0, 3) : randInt(rng, 1, 600);
      const text = rng() < 0.15 ? periodicText(randomText(rng, a, randInt(rng, 1, 3)), n) : randomText(rng, a, n);
      docs.push({ id: `case${t}.${r}`, text });
    }
    const corpus = docs.map((d) => d.text).join('') || 'a';
    const k = rng() < 0.6 ? randInt(rng, 1, 4) : randInt(rng, 5, 60);
    const mMax = rng() < 0.7 ? randInt(rng, 1, 12) : randInt(rng, 13, 70);
    let patterns = makePatterns(rng, corpus, a, k, [1, mMax], 0.6);
    if (rng() < 0.2) patterns = [...patterns, patterns[0]];
    const ignoreCase = rng() < 0.25;
    if (ignoreCase) {
      patterns = patterns.map((p) => (rng() < 0.5 ? p.toLowerCase() : p));
      for (const d of docs) if (rng() < 0.5) d.text = d.text.toLowerCase();
    }
    checkAll(`rastgele #${t} (${a})`, { patterns, ignoreCase }, docs);
  }
});
