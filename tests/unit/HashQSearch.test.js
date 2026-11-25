// HashQSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HashQSearch } from '../../src/atomic/HashQSearch.js';
import { prepareHashQ } from '../../src/functions/hashQ.js';
import { buildAlphabet } from '../../src/functions/alphabet.js';
import { runCaseSuite, UNITS } from '../helpers.js';

const LONG = UNITS.GRAD.repeat(8); // 64 karakter

runCaseSuite(test, HashQSearch, [
  { name: 'desende olmayan q-gram: kayma m-q+1 olmalı (m kaydırmak eşleşmeyi kaçırır)', text: 'xyabc', patterns: ['abc'], expect: [['abc', 2]] },
  { name: 'son q-gram desende tekrar ediyor', text: 'xyxyxyxy', patterns: ['xyxy'], expect: [['xyxy', 0], ['xyxy', 2], ['xyxy', 4]] },
  { name: 'uzun desen (m = 64)', text: '//' + UNITS.GRAD.repeat(9), patterns: [LONG], expect: [[LONG, 2], [LONG, 10]] },
]);

test('karşı örnekte q = 2 seçilir; desende olmayan q-gram için kayma m - q + 1 = 2 (m = 3 değil)', () => {
  const alphabet = buildAlphabet(['abc']);
  const prep = prepareHashQ('abc', alphabet);
  assert.equal(prep.q, 2);
  const code = (s) => [...s].reduce((h, ch) => h * prep.A + alphabet.map[ch.charCodeAt(0)], 0);
  assert.equal(prep.shift[code('ya')], 2); // desende yok -> m - q + 1
  assert.equal(prep.shift[code('ab')], 1); // desende 0..1 arasında -> m - 1 - 1
  assert.equal(prep.shift[code('bc')], 0); // son q-gram -> doğrulama
  assert.equal(prep.after, 2); // doğrulamadan sonra: "bc"nin önceki geçişi yok -> m - q + 1
});
