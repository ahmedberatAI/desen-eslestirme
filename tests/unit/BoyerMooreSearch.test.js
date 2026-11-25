// BoyerMooreSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { BoyerMooreSearch } from '../../src/atomic/BoyerMooreSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, BoyerMooreSearch, [
  { name: 'iyi sonek kuralı: tekrar eden sonek', text: 'ABCABDABCAB', patterns: ['ABCAB'], expect: [['ABCAB', 0], ['ABCAB', 6]] },
  { name: 'iyi sonek: periyodik uzun desen', text: 'ABAABAABAABA', patterns: ['ABAABA'], expect: [['ABAABA', 0], ['ABAABA', 3], ['ABAABA', 6]] },
]);
