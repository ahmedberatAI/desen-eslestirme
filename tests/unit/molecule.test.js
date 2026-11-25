// Görev 3: ExactMatch molekülü testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ExactMatch } from '../../src/molecules/ExactMatch.js';
import { registry, Registry } from '../../src/registry.js';
import { ExactSearchAtom, TASK } from '../../src/atomic/ExactSearchAtom.js';
import { NaiveSearch } from '../../src/atomic/NaiveSearch.js';
import { searchNaive } from '../../src/functions/naive.js';
import { mulberry32, randomText, makePatterns } from '../../bench/data.js';

// 4 eylemli bir RL ajanının iki eylem izi (U/D/L/R) ve bu izlerde aranan eylem motifleri
const rng = mulberry32(5);
const trace = randomText(rng, 'actions', 20000);
const docs = [{ id: 'episode-1', text: trace }, { id: 'episode-2', text: trace.slice(0, 5000) }];
const patterns = makePatterns(rng, trace, 'actions', 12, [4, 40], 0.7);

test('record doğru alanları içerir', () => {
  const em = new ExactMatch({ patterns });
  [...em.run(docs)];
  const r = em.record;
  assert.deepEqual(Object.keys(r).sort(), ['estimates', 'requested', 'selected', 'shape', 'why']);
  assert.equal(r.requested, 'auto');
  assert.ok(registry.has(r.selected));
  for (const key of ['n', 'sigma', 'sigmaEff', 'k', 'mMin', 'mMax', 'mAvg', 'lengths']) assert.ok(key in r.shape, `shape.${key}`);
  assert.equal(r.shape.n, 20000); // akıştaki ilk belgeye göre
  assert.equal(r.shape.sigma, 4);
  assert.equal(r.shape.k, 12);
  assert.equal(r.estimates.length, registry.names().length);
  for (const e of r.estimates) {
    assert.ok('atom' in e && 'cost' in e && 'applicable' in e && 'features' in e && 'coefficients' in e);
  }
  assert.equal(typeof r.why, 'string');
  assert.ok(r.why.includes(r.selected));
});

test('auto, tahmini maliyeti en düşük uygulanabilir atomu seçer', () => {
  const em = new ExactMatch({ patterns });
  em.decide(docs[0]);
  const ok = em.record.estimates.filter((e) => e.applicable === true);
  const min = ok.reduce((a, b) => (b.cost < a.cost ? b : a));
  assert.equal(em.record.selected, min.atom);
  // estimates artan maliyet sırasında
  for (let i = 1; i < ok.length; i++) assert.ok(ok[i - 1].cost <= ok[i].cost);
  // maliyet = Σ katsayı × özellik (record'daki özellikler 6 anlamlı basamağa yuvarlanır)
  for (const e of ok) {
    const sum = Object.entries(e.features).reduce((s, [f, v]) => s + e.coefficients[f] * v, 0);
    assert.ok(Math.abs(sum - e.cost) <= 1e-4 * e.cost + 1e-15, `${e.atom}: ${sum} != ${e.cost}`);
  }
});

test('auto, bütün akış için ilk belgeye göre tek atom kullanır', () => {
  const em = new ExactMatch({ patterns });
  const seen = new Set();
  for (const _ of em.run(docs)) seen.add(em.atom.constructor.manifest.name);
  assert.equal(seen.size, 1);
  assert.equal([...seen][0], em.record.selected);
});

test('zorla seçilen her strateji aynı sonucu verir', () => {
  const ref = [...new ExactMatch({ patterns, strategy: 'NaiveSearch' }).run(docs)];
  assert.ok(ref.length > 0);
  for (const name of registry.names()) {
    const em = new ExactMatch({ patterns, strategy: name });
    assert.deepEqual([...em.run(docs)], ref, name);
    assert.equal(em.record.selected, name);
    assert.equal(em.record.requested, name);
  }
  assert.deepEqual([...new ExactMatch({ patterns, strategy: 'auto' }).run(docs)], ref);
});

test('bilinmeyen strateji hata verir ve geçerli seçenekleri listeler', () => {
  assert.throws(
    () => new ExactMatch({ patterns, strategy: 'Quantum' }),
    (err) => err.message.includes('Quantum') && err.message.includes('auto') && registry.names().every((n) => err.message.includes(n)),
  );
});

// Testin içinde tanımlanan sahte atom: her şeyi NaiveSearch ile yapar, maliyeti ise "sıfır".
class FakeZeroCostSearch extends ExactSearchAtom {
  static manifest = { name: 'FakeZeroCostSearch', version: '0.0.1', kind: 'atom', task: TASK, title: 'fake', references: ['test'] };
  static selection = { features: () => ({ magic: 1 }), defaults: { magic: 0 } };
  search(text, hits) {
    this.unique.forEach((p, uid) => searchNaive(text, p, uid, hits));
  }
}

test('kayıt defterine eklenen sahte atom, molekül kodu değişmeden seçilebilir', () => {
  const reg = registry.clone();
  reg.register(FakeZeroCostSearch);
  const em = new ExactMatch({ patterns, registry: reg, calibration: null });
  const out = [...em.run(docs)];
  assert.equal(em.record.selected, 'FakeZeroCostSearch');
  assert.deepEqual(out, [...new NaiveSearch({ patterns }).run(docs)]);
  // adıyla zorlanabilir de
  assert.equal(new ExactMatch({ patterns, registry: reg, strategy: 'FakeZeroCostSearch' }).decide(docs[0]).selected, 'FakeZeroCostSearch');
  // global kayıt defteri etkilenmedi
  assert.equal(registry.has('FakeZeroCostSearch'), false);
});

test('global kayıt defterine register/unregister ile eklenen atom da seçilir', () => {
  registry.register(FakeZeroCostSearch);
  try {
    const em = new ExactMatch({ patterns });
    em.decide(docs[0]);
    assert.equal(em.record.selected, 'FakeZeroCostSearch');
  } finally {
    registry.unregister('FakeZeroCostSearch');
  }
  assert.notEqual(new ExactMatch({ patterns }).decide(docs[0]).selected, 'FakeZeroCostSearch');
});

class InapplicableSearch extends FakeZeroCostSearch {
  static manifest = { ...FakeZeroCostSearch.manifest, name: 'InapplicableSearch' };
  static selection = { features: () => ({ magic: 1 }), defaults: { magic: 0 }, applicable: () => 'bu atom hiçbir girdiye uygulanamaz (test)' };
}

test('kendini uygulanamaz ilan eden atom hiç seçilmez', () => {
  const reg = registry.clone();
  reg.register(InapplicableSearch);
  const r = new ExactMatch({ patterns, registry: reg }).decide(docs[0]);
  assert.notEqual(r.selected, 'InapplicableSearch');
  const row = r.estimates.find((e) => e.atom === 'InapplicableSearch');
  assert.equal(row.applicable, 'bu atom hiçbir girdiye uygulanamaz (test)');
  assert.equal(row.cost, null);
  assert.ok(r.why.includes('InapplicableSearch'));
  // tek atom uygulanamazsa hata
  const lonely = new Registry();
  lonely.register(InapplicableSearch);
  assert.throws(() => new ExactMatch({ patterns, registry: lonely }).decide(docs[0]), /uygulanabilir atom yok/);
});

test('dizin atomları çok uzun metinde uygulanamaz ilan edilir', () => {
  const r = new ExactMatch({ patterns: ['UDLR'] }).estimate({
    n: 2 ** 25, sigma: 4, sigmaEff: 4, k: 1, kUnique: 1, mMin: 4, mMax: 4, mAvg: 4, totalLength: 4, distinctLengths: 1, patternSigma: 4, lengths: [[4, 1]],
  });
  for (const name of ['SuffixArraySearch', 'FmIndexSearch']) {
    assert.equal(typeof r.find((e) => e.atom === name).applicable, 'string');
  }
});

test('kalibrasyon yoksa varsayılan katsayılar kullanılır', () => {
  const r = new ExactMatch({ patterns, calibration: null }).decide(docs[0]);
  assert.ok(r.estimates.every((e) => e.source === 'defaults'));
});

test('karar verisinin kendisi anlamlı: tek kısa desen ile 300 desen farklı atom seçer', () => {
  const single = new ExactMatch({ patterns: ['UDLRUD'] }).decide({ id: 'x', text: trace });
  const many = new ExactMatch({ patterns: makePatterns(mulberry32(9), trace, 'actions', 300, 12) }).decide({ id: 'x', text: trace });
  assert.notEqual(single.selected, many.selected);
});

test('boş akış: karar verilmez, hata yok', () => {
  const em = new ExactMatch({ patterns: ['A'] });
  assert.deepEqual([...em.run([])], []);
  assert.equal(em.record.selected, null);
});
