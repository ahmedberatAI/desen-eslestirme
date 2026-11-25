// TunedBoyerMooreSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { TunedBoyerMooreSearch } from '../../src/atomic/TunedBoyerMooreSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, TunedBoyerMooreSearch, [
  { name: 'sentinel: eşleşme metnin son karakterinde biter', text: 'xxxxint', patterns: ['int'], expect: [['int', 4]] },
  { name: 'son karakter desende tekrar ediyor (md2 kayması)', text: 'abababa', patterns: ['aba'], expect: [['aba', 0], ['aba', 2], ['aba', 4]] },
  { name: 'farklı uzunlukta desenler aynı sentinel alanını kullanır', text: 'return re', patterns: ['return', 're'], expect: [['return', 0], ['re', 0], ['re', 7]] },
]);
