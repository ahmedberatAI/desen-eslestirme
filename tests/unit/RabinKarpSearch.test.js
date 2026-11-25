// RabinKarpSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { RabinKarpSearch } from '../../src/atomic/RabinKarpSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, RabinKarpSearch, [
  { name: 'aynı uzunlukta çok desen tek özet geçişi', text: 'abcdabcd', patterns: ['abc', 'bcd', 'cda', 'ddd'], expect: [['abc', 0], ['bcd', 1], ['cda', 2], ['abc', 4], ['bcd', 5]] },
  { name: 'farklı uzunluk grupları', text: 'testcase', patterns: ['testcase', 'e', 'se'], expect: [['testcase', 0], ['e', 1], ['se', 6], ['e', 7]] },
]);
