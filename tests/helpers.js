// Testler için ortak yardımcılar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NaiveSearch } from '../src/atomic/NaiveSearch.js';
import { parseJsonl } from '../src/corpus.js';

/** Bir atomun (veya molekülün) çıktısını dizi olarak döndürür. */
export function runAll(component, docs) {
  return [...component.run(docs)];
}

/** Oracle (NaiveSearch) ile eleman eleman karşılaştırma. */
export function assertSameAsOracle(AtomClass, params, docs, label = '') {
  const expected = runAll(new NaiveSearch(params), docs);
  const actual = runAll(new AtomClass(params), docs);
  if (actual.length !== expected.length) {
    assert.fail(`${AtomClass.manifest?.name ?? AtomClass.name} ${label}: ${actual.length} eşleşme, beklenen ${expected.length}`);
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    if (a.id !== e.id || a.pattern !== e.pattern || a.position !== e.position || a.length !== e.length) {
      assert.fail(`${AtomClass.manifest?.name ?? AtomClass.name} ${label}: ${i}. eleman farklı: ${JSON.stringify(a)} != ${JSON.stringify(e)}`);
    }
  }
  return expected.length;
}

/** Tek belge, tek desen listesi için konumlar: [[pattern, position], ...] */
export function hitsOf(AtomClass, text, patterns, ignoreCase = false) {
  return runAll(new AtomClass({ patterns, ignoreCase }), [{ id: 't', text }]).map((m) => [m.pattern, m.position]);
}

const DATA = new URL('./data/', import.meta.url);
/** GPT-2 eğitim kaynak dosyası (karpathy/llm.c), tek belge. */
export const gpt2Docs = () => [{ id: 'llm.c/train_gpt2.c', text: readFileSync(new URL('train_gpt2.c', DATA), 'utf8') }];
/** OpenAI HumanEval, 164 belge. */
export const humanevalDocs = () => parseJsonl(readFileSync(new URL('humaneval.jsonl', DATA), 'utf8'));

const LONG = 'return 0;\n'.repeat(4); // 40 karakter
const GRAD = 'grad += '; // 8 karakter

/**
 * Bütün atomlar için ortak özel durumlar (beklenen sonuçlar elle hesaplanmıştır).
 * Her atomun kendi test dosyası bunları + atoma özgü durumları çalıştırır.
 */
export const COMMON_CASES = [
  { name: 'periyodik desen ABAB (örtüşen)', text: 'ABABABAB', patterns: ['ABAB'], expect: [['ABAB', 0], ['ABAB', 2], ['ABAB', 4]] },
  { name: 'tek karakterlik desen', text: 'a;b;c', patterns: [';'], expect: [[';', 1], [';', 3]] },
  { name: 'desen alfabesinde olmayan metin karakterleri', text: 'xx(def)xx#def!', patterns: ['def'], expect: [['def', 3], ['def', 10]] },
  { name: 'desen = metin', text: 'return', patterns: ['return'], expect: [['return', 0]] },
  { name: 'yalnızca metnin sonunda', text: 'xxxxx;}', patterns: [';}'], expect: [[';}', 5]] },
  { name: 'yalnızca metnin başında', text: '#!xxxxx', patterns: ['#!'], expect: [['#!', 0]] },
  { name: 'eşleşme yok', text: 'aaaaaaaa', patterns: ['aab'], expect: [] },
  { name: 'kendisiyle örtüşen ===', text: '=====', patterns: ['==='], expect: [['===', 0], ['===', 1], ['===', 2]] },
  { name: 'desen metinden uzun', text: 'int', patterns: ['int8'], expect: [] },
  {
    name: 'iç içe ve karışık uzunlukta desenler (aynı konumda liste sırası)',
    text: 'x=x+1;x=x+1;',
    patterns: ['=x', 'x=x+', '+', 'x=x+1;x=x+1;'],
    expect: [['x=x+', 0], ['x=x+1;x=x+1;', 0], ['=x', 1], ['+', 3], ['x=x+', 6], ['=x', 7], ['+', 9]],
  },
  { name: 'uzun desen (40 karakter, > 32)', text: '{  ' + LONG + '}  ', patterns: [LONG], expect: [[LONG, 3]] },
  { name: 'Unicode (BMP dışı karakter UTF-16 indeksi)', text: '🤖çğüA🤖çğü', patterns: ['çğü'], expect: [['çğü', 2], ['çğü', 8]] },
  { name: 'aynı desen iki kez', text: 'ifif', patterns: ['if', 'if'], expect: [['if', 0], ['if', 0], ['if', 2], ['if', 2]] },
  { name: 'ignoreCase yalnızca ASCII', text: 'todoTODOçÇ', patterns: ['TODO', 'ç'], ignoreCase: true, expect: [['TODO', 0], ['TODO', 4], ['ç', 8]] },
];

/** Atoma özgü testlerde kullanılan uzun periyodik desen yardımcıları. */
export const UNITS = { LONG, GRAD };

/** Ortak + atoma özgü durumları node:test ile çalıştırır. */
export function runCaseSuite(test, AtomClass, extra = []) {
  for (const c of [...COMMON_CASES, ...extra]) {
    test(c.name, () => {
      assert.deepEqual(hitsOf(AtomClass, c.text, c.patterns, c.ignoreCase ?? false), c.expect);
      // her özel durum ayrıca oracle ile de karşılaştırılır
      assertSameAsOracle(AtomClass, { patterns: c.patterns, ignoreCase: c.ignoreCase ?? false }, [{ id: 't', text: c.text }]);
    });
  }
}
