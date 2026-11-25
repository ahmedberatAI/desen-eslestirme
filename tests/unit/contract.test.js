// Sözleşme testleri (bölüm 4): kayıt defterindeki HER atom ve ExactMatch molekülü bunları geçmelidir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { registry } from '../../src/registry.js';
import { ExactMatch } from '../../src/molecules/ExactMatch.js';
import { TASK } from '../../src/atomic/ExactSearchAtom.js';

// Molekülü atom gibi kullanılabilen bir sarmalayıcıyla aynı testlere sokuyoruz.
class MoleculeAuto {
  static manifest = { name: 'ExactMatch(auto)' };
  constructor(params) {
    this.em = new ExactMatch({ ...params, strategy: 'auto' });
  }
  *run(docs) {
    yield* this.em.run(docs);
  }
}

const components = [...registry.list(), MoleculeAuto];
const run = (C, docs, patterns, ignoreCase = false) => [...new C({ patterns, ignoreCase }).run(docs)];
const one = (text) => [{ id: 'src/main.py', text }];

for (const C of components) {
  const name = C.manifest.name;
  test(`${name}: Text.Match alanları ve 0 tabanlı konum`, () => {
    assert.deepEqual(run(C, one('x = foo(y)'), ['foo(']), [{ id: 'src/main.py', pattern: 'foo(', position: 4, length: 4 }]);
  });

  test(`${name}: örtüşen eşleşmeler (AAAAA / AA -> 0,1,2,3)`, () => {
    assert.deepEqual(run(C, one('AAAAA'), ['AA']).map((m) => m.position), [0, 1, 2, 3]);
  });

  test(`${name}: sıralama — belge, konum, desen listesi sırası`, () => {
    const docs = [{ id: 'a.py', text: 'eellslef' }, { id: 'b.py', text: 'slefeell' }];
    const got = run(C, docs, ['eell', 'slef', 'e', 'ee']).map((m) => `${m.id}:${m.position}:${m.pattern}`);
    assert.deepEqual(got, [
      'a.py:0:eell', 'a.py:0:e', 'a.py:0:ee', 'a.py:1:e', 'a.py:4:slef', 'a.py:6:e',
      'b.py:0:slef', 'b.py:2:e', 'b.py:4:eell', 'b.py:4:e', 'b.py:4:ee', 'b.py:5:e',
    ]);
  });

  test(`${name}: aynı desen iki kez ayrı ayrı raporlanır`, () => {
    assert.deepEqual(run(C, one('xifx'), ['if', 'f', 'if']).map((m) => `${m.position}${m.pattern}`), ['1if', '1if', '2f']);
  });

  test(`${name}: ignoreCase yalnızca ASCII harflerini eşitler, pattern verildiği gibi yazılır`, () => {
    const got = run(C, one('tOdO-TODO-todo-ıI-éÉ'), ['todo', 'TODO', 'i', 'é'], true);
    assert.deepEqual(got.map((m) => `${m.position}:${m.pattern}`), ['0:todo', '0:TODO', '5:todo', '5:TODO', '10:todo', '10:TODO', '16:i', '18:é']);
    // ignoreCase kapalıyken büyük/küçük harf farklıdır
    assert.deepEqual(run(C, one('todoTODO'), ['TODO']).map((m) => m.position), [4]);
  });

  test(`${name}: konumlar UTF-16 kod birimi cinsinden`, () => {
    assert.deepEqual(run(C, one('𝔸𝔹eval𝔸'), ['eval', '𝔸']).map((m) => `${m.position}:${m.pattern}`), ['0:𝔸', '4:eval', '8:𝔸']);
  });

  test(`${name}: desen metinden uzun veya metin boşsa sonuç boş, hata yok`, () => {
    assert.deepEqual(run(C, one('int'), ['int8']), []);
    assert.deepEqual(run(C, one(''), ['a']), []);
    assert.deepEqual(run(C, [{ id: 'e', text: '' }, { id: 'f', text: 'a' }], ['a']).map((m) => m.id), ['f']);
  });

  test(`${name}: boş desen listesi veya boş desen hata verir`, () => {
    assert.throws(() => new C({ patterns: [] }));
    assert.throws(() => new C({ patterns: ['a', ''] }));
    assert.throws(() => new C({ patterns: 'eval' }));
  });

  test(`${name}: deterministik`, () => {
    const text = 'def f(x):\n'.repeat(50) + 'return x\n'.repeat(20);
    const a = run(C, one(text), ['def', 'f(x', 'return x\nret', 'e']);
    const b = run(C, one(text), ['def', 'f(x', 'return x\nret', 'e']);
    assert.deepEqual(a, b);
  });
}

for (const A of registry.list()) {
  test(`${A.manifest.name}: manifest ve selection sözleşmesi`, () => {
    const mf = A.manifest;
    assert.equal(mf.kind, 'atom');
    assert.equal(mf.task, TASK);
    assert.match(mf.version, /^\d+\.\d+\.\d+$/);
    assert.equal(typeof mf.title, 'string');
    assert.ok(Array.isArray(mf.references) && mf.references.length > 0);
    assert.equal(typeof A.selection.features, 'function');
    const shape = { n: 1000, sigma: 4, sigmaEff: 4, k: 2, kUnique: 2, mMin: 4, mMax: 8, mAvg: 6, totalLength: 12, distinctLengths: 2, patternSigma: 4, lengths: [[4, 1], [8, 1]] };
    const f = A.selection.features(shape);
    for (const [key, v] of Object.entries(f)) {
      assert.ok(Number.isFinite(v) && v >= 0, `${key} sonlu ve negatif olmayan olmalı`);
      assert.equal(typeof A.selection.defaults[key], 'number', `${key} için varsayılan katsayı yok`);
    }
    if (A.selection.applicable) {
      const r = A.selection.applicable(shape);
      assert.ok(r === true || typeof r === 'string');
    }
  });
}

test('atom kaynaklarında hazır arama işlevi, console, dosya veya ağ kullanımı yok', () => {
  const dirs = ['../../src/atomic/', '../../src/functions/'];
  const forbidden = /\bindexOf\s*\(|\blastIndexOf\s*\(|\.includes\s*\(|\.startsWith\s*\(|\.endsWith\s*\(|\bRegExp\b|\.match(All)?\s*\(|\.replace(All)?\s*\(|\.split\s*\(|console\.|node:fs|node:net|node:http|require\s*\(/;
  for (const d of dirs) {
    const url = new URL(d, import.meta.url);
    for (const file of readdirSync(url)) {
      const src = readFileSync(new URL(file, url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      const m = src.match(forbidden);
      assert.equal(m, null, `${d}${file}: yasak kullanım "${m?.[0]}"`);
    }
  }
});
