// Demo yardımcısı: `ios.js explain` ile aynı kararı verir, okunaklı kısa bir özet yazar.
//   node presentation/demo/explain-summary.js --patterns attention_forward,layernorm_forward
//   node presentation/demo/explain-summary.js --patterns-file presentation/demo/desenler300.txt
//   node presentation/demo/explain-summary.js --patterns "def " --input tests/data/humaneval.jsonl
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExactMatch } from '../../src/molecules/ExactMatch.js';
import { parseCorpus } from '../../src/corpus.js';

const args = process.argv.slice(2);
const get = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const patterns = get('--patterns')?.split(',') ??
  readFileSync(get('--patterns-file'), 'utf8').split(/\r?\n/).filter(Boolean);
const input = get('--input') ?? fileURLToPath(new URL('../../tests/data/train_gpt2.c', import.meta.url));
const format = input.endsWith('.jsonl') ? 'jsonl' : 'auto';
const docs = parseCorpus(readFileSync(input, 'utf8'), { format, id: path.basename(input) });

const r = new ExactMatch({ patterns }).decide(docs[0]);
const s = r.shape;
console.log(`veri şekli : n=${s.n}, σ=${s.sigma} (σ_eff=${s.sigmaEff}), k=${s.k}, m=${s.mMin}..${s.mMax}${docs.length > 1 ? `  (${docs.length} belgelik akış, karar ilk belgeye göre)` : ''}`);
console.log(`seçilen    : ${r.selected}`);
r.estimates.slice(0, 4).forEach((e, i) => {
  console.log(`  ${i + 1}. ${e.atom.padEnd(22)} ${(e.cost * 1e6).toFixed(1).padStart(8)} µs${i ? `  ×${(e.cost / r.estimates[0].cost).toFixed(2)}` : ''}`);
});
