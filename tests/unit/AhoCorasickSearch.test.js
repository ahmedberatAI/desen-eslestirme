// AhoCorasickSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { AhoCorasickSearch } from '../../src/atomic/AhoCorasickSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, AhoCorasickSearch, [
  { name: 'klasik örnek: he/she/his/hers', text: 'USHERS', patterns: ['HE', 'SHE', 'HIS', 'HERS'], expect: [['SHE', 1], ['HE', 2], ['HERS', 2]] },
  { name: 'birbirinin soneki olan desenler (sözlük bağlantısı)', text: 'XABCD', patterns: ['ABCD', 'BCD', 'CD', 'D'], expect: [['ABCD', 1], ['BCD', 2], ['CD', 3], ['D', 4]] },
]);
