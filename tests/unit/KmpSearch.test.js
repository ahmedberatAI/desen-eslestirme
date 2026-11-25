// KmpSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { KmpSearch } from '../../src/atomic/KmpSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, KmpSearch, [
  { name: 'başarısızlık zinciri (AABAACAABAA)', text: 'AABAACAABAACAABAA', patterns: ['AABAACAABAA'], expect: [['AABAACAABAA', 0], ['AABAACAABAA', 6]] },
  { name: 'eşleşmeden sonra kaldığı yerden devam', text: 'ABABABA', patterns: ['ABA'], expect: [['ABA', 0], ['ABA', 2], ['ABA', 4]] },
]);
