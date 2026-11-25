// WuManberSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { WuManberSearch } from '../../src/atomic/WuManberSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, WuManberSearch, [
  { name: 'mMin = 1 (blok B = 1)', text: 'a=b;a=', patterns: ['a', '=b;a'], expect: [['a', 0], ['=b;a', 1], ['a', 4]] },
  { name: 'aynı öneki paylaşan farklı uzunlukta desenler', text: 'evalevalxx', patterns: ['evalxx', 'eval', 'eva'], expect: [['eval', 0], ['eva', 0], ['evalxx', 4], ['eval', 4], ['eva', 4]] },
]);
