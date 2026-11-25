// SuffixArraySearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { SuffixArraySearch } from '../../src/atomic/SuffixArraySearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, SuffixArraySearch, [
  { name: 'desende metinde olmayan karakter', text: 'abcdabcd', patterns: ['abx', 'cd'], expect: [['cd', 2], ['cd', 6]] },
  { name: 'tek karakterlik metin', text: 'x', patterns: ['x', 'xx'], expect: [['x', 0]] },
]);
