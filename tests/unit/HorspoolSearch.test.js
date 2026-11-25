// HorspoolSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { HorspoolSearch } from '../../src/atomic/HorspoolSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, HorspoolSearch, [
  { name: 'son karakter desende tekrar ediyor', text: 'XAAXAAXAA', patterns: ['XAA'], expect: [['XAA', 0], ['XAA', 3], ['XAA', 6]] },
  { name: 'son karakter eşleşir ama gerisi eşleşmez', text: 'foo;bar;', patterns: ['xr;'], expect: [] },
]);
