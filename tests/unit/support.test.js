import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonl, parseCorpus, formatJsonl, detectFormat } from '../../src/corpus.js';
import { computeShape } from '../../src/shape.js';
import { foldAscii, alphabetStats, buildAlphabet, encodeText } from '../../src/functions/alphabet.js';
import { expectedShift, expectedComparisons } from '../../src/functions/cost.js';
import { HitList } from '../../src/functions/hits.js';

test('JSONL: çok satır, CRLF, boş satır, sayısal/eksik id, fazladan alanlar, BOM', () => {
  const txt = '﻿{"id":"a.py","text":"x = 1\\n","lang":"py"}\r\n\r\n{"id":7,"text":""}\n{"text":"son"}\n';
  assert.deepEqual(parseJsonl(txt), [
    { id: 'a.py', text: 'x = 1\n' },
    { id: '7', text: '' },
    { id: 'doc-3', text: 'son' },
  ]);
  assert.deepEqual(parseJsonl(''), []);
});

test('JSONL: bozuk satır ve eksik text alanı satır numarasıyla hata verir', () => {
  assert.throws(() => parseJsonl('{"text":"a"}\n{oops}\n'), /2\. satır/);
  assert.throws(() => parseJsonl('{"id":"x"}\n'), /"text"/);
  assert.throws(() => parseJsonl('[1,2]\n'), /nesne/);
});

test('derlem biçimi: auto, düz metin, gidiş-dönüş', () => {
  assert.equal(detectFormat('  \n{"text":"a"}'), 'jsonl');
  assert.equal(detectFormat('#include <stdio.h>'), 'text');
  assert.deepEqual(parseCorpus('int x;\n', { id: 'a.c' }), [{ id: 'a.c', text: 'int x;\n' }]);
  assert.deepEqual(parseCorpus('{"a":1}', { format: 'text' }), [{ id: 'stdin', text: '{"a":1}' }]);
  assert.deepEqual(parseCorpus(''), []);
  assert.throws(() => parseCorpus('x', { format: 'xml' }), /Bilinmeyen biçim/);
  const docs = [{ id: 'a', text: 'line1\nline2 "q" \\ 🤖' }, { id: 'b', text: '' }];
  assert.deepEqual(parseJsonl(formatJsonl(docs)), docs);
});

test('foldAscii yalnızca a–z harflerini değiştirir', () => {
  assert.equal(foldAscii('todoXYZ-ıiçé{`'), 'TODOXYZ-ıIçé{`');
  const s = 'TODO';
  assert.equal(foldAscii(s), s);
  const long = 'ab'.repeat(10000);
  assert.equal(foldAscii(long), 'AB'.repeat(10000));
});

test('alfabe küçültme ve istatistikleri', () => {
  const a = buildAlphabet(['abc', 'cd']);
  assert.equal(a.size, 5);
  assert.deepEqual([...encodeText('axd', a, 2)], [1, 0, 4, 0, 0]);
  const st = alphabetStats('aabb');
  assert.equal(st.sigma, 2);
  assert.equal(st.sigmaEff, 2);
  assert.equal(alphabetStats('    ').sigmaEff, 1);
});

test('veri şekli (shape)', () => {
  const s = computeShape({ id: 'x', text: 'evalEVAL' }, { patterns: ['eva', 'EVA', 'EVALS'], ignoreCase: true });
  assert.equal(s.n, 8);
  assert.equal(s.sigma, 4);
  assert.equal(s.k, 3);
  assert.equal(s.kUnique, 2);
  assert.equal(s.mMin, 3);
  assert.equal(s.mMax, 5);
  assert.equal(s.mAvg, 4);
  assert.deepEqual(s.lengths, [[3, 1], [5, 1]]);
  assert.equal(s.totalLength, 8);
  assert.equal(s.distinctLengths, 2);
  assert.equal(computeShape(undefined, { patterns: ['a'] }).n, 0);
});

test('beklenen kayma ve karşılaştırma formülleri', () => {
  assert.equal(expectedShift(1, 4), 1);
  assert.equal(expectedShift(10, 1), 1);
  // σ çok büyükse kayma ≈ L
  assert.ok(Math.abs(expectedShift(16, 1e9) - 16) < 1e-6);
  // Horspool: σ(1-(1-1/σ)^m)
  assert.ok(Math.abs(expectedShift(8, 4) - 4 * (1 - 0.75 ** 8)) < 1e-12);
  // çok desen kaymayı küçültür
  assert.ok(expectedShift(16, 64, 100) < expectedShift(16, 64, 1));
  assert.ok(Math.abs(expectedComparisons(3, 2) - 1.75) < 1e-12);
});

test('HitList sıralama ve desen gruplarına açma', () => {
  const h = new HitList();
  for (let i = 0; i < 200; i++) h.add(199 - i, i % 2); // ters sırada, büyüme dahil
  const keys = h.sortedKeys([[0, 2], [1]], 3);
  assert.equal(keys.length, 300);
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i - 1] < keys[i]);
});
