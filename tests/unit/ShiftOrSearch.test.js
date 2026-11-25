// ShiftOrSearch birim testleri: ortak özel durumlar + atoma özgü durumlar.
import test from 'node:test';
import { ShiftOrSearch } from '../../src/atomic/ShiftOrSearch.js';
import { runCaseSuite } from '../helpers.js';

runCaseSuite(test, ShiftOrSearch, [
  { name: 'm = 32 (kelime sınırı)', text: '#' + 'abcd'.repeat(8) + '#', patterns: ['abcd'.repeat(8)], expect: [['abcd'.repeat(8), 1]] },
  { name: 'm = 33 (filtre + doğrulama, örtüşen)', text: '0'.repeat(35), patterns: ['0'.repeat(33)], expect: [['0'.repeat(33), 0], ['0'.repeat(33), 1], ['0'.repeat(33), 2]] },
  { name: 'm > 32: filtre eşleşir, kuyruk eşleşmez', text: '0'.repeat(32) + '1', patterns: ['0'.repeat(32) + 'x'], expect: [] },
]);
