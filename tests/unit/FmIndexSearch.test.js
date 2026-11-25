// FmIndexSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { FmIndexSearch } from '../../src/atomic/FmIndexSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, FmIndexSearch, [
  { name: 'desende metinde olmayan karakter', text: 'abcdabcd', patterns: ['abx', 'cd'], expect: [['cd', 2], ['cd', 6]] },
  { name: 'Occ kontrol noktası sınırını aşan metin (n = 200)', text: '01'.repeat(100), patterns: ['10'], expect: Array.from({ length: 99 }, (_, i) => ['10', 2 * i + 1]) },
]);
