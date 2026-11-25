// NaiveSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { NaiveSearch } from '../../src/atomic/NaiveSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, NaiveSearch, [
  { name: 'tamamen tekrarlı metin', text: '0000', patterns: ['00'], expect: [['00', 0], ['00', 1], ['00', 2]] },
]);
