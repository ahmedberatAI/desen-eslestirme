#!/usr/bin/env node
// IoS komut satırı.
//   node bin/ios.js run ExactMatch --patterns P1,P2 [--ignoreCase] [--strategy auto] < derlem.jsonl > cikti.jsonl
//   node bin/ios.js run ExactMatch --patterns malloc,free < kaynak.c          (düz metin: tek belge)
//   node bin/ios.js explain --patterns P1,P2 [--ignoreCase] [--strategy auto] < derlem.jsonl
//   node bin/ios.js list
// Girdi: JSONL ({"id": ..., "text": ...} satırları) veya düz metin (girdinin tamamı tek belge);
//        --format auto|jsonl|text (varsayılan auto: ilk karakter "{" ise JSONL).
// run: her satıra bir Text.Match (JSONL); karar özeti stderr'e yazılır (--quiet ile kapatılır).
// explain: yalnızca kararı (record) JSON olarak stdout'a yazar.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCorpus, readCorpusStream } from '../src/corpus.js';
import { ExactMatch } from '../src/molecules/ExactMatch.js';
import { registry } from '../src/registry.js';

const USAGE = `Kullanım:
  node bin/ios.js run ExactMatch --patterns P1,P2 [--patterns-file f.txt] [--ignoreCase] [--strategy auto|<atom>]
                                 [--input dosya] [--format auto|jsonl|text] [--quiet] < derlem.jsonl > cikti.jsonl
  node bin/ios.js explain --patterns P1,P2 [--ignoreCase] [--strategy auto|<atom>] [--input dosya] < derlem.jsonl
  node bin/ios.js list`;

function parseArgs(argv) {
  const opts = { patterns: null, ignoreCase: false, strategy: 'auto', quiet: false, input: null, format: 'auto', positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} bir değer bekliyor`);
      return argv[++i];
    };
    if (a === '--patterns') opts.patterns = (opts.patterns ?? []).concat(val().split(','));
    else if (a.startsWith('--patterns=')) opts.patterns = (opts.patterns ?? []).concat(a.slice(11).split(','));
    else if (a === '--patterns-file') {
      const lines = readFileSync(val(), 'utf8').split(/\r?\n/).filter((s) => s.length > 0);
      opts.patterns = (opts.patterns ?? []).concat(lines);
    } else if (a === '--ignoreCase' || a === '--ignore-case') opts.ignoreCase = true;
    else if (a === '--strategy') opts.strategy = val();
    else if (a.startsWith('--strategy=')) opts.strategy = a.slice(11);
    else if (a === '--input' || a === '-i') opts.input = val();
    else if (a === '--format') opts.format = val();
    else if (a.startsWith('--format=')) opts.format = a.slice(9);
    else if (a === '--quiet' || a === '-q') opts.quiet = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('-')) throw new Error(`Bilinmeyen seçenek: ${a}`);
    else opts.positional.push(a);
  }
  return opts;
}

async function readDocs(opts) {
  if (opts.input) {
    const format = opts.format === 'auto' && opts.input.endsWith('.jsonl') ? 'jsonl' : opts.format;
    return parseCorpus(readFileSync(opts.input, 'utf8'), { format, id: path.basename(opts.input) });
  }
  return readCorpusStream(process.stdin, { format: opts.format, id: 'stdin' });
}

function writeOut(s) {
  return new Promise((resolve) => {
    if (process.stdout.write(s)) resolve();
    else process.stdout.once('drain', resolve);
  });
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const opts = parseArgs(rest);
  if (!command || opts.help) {
    console.log(USAGE);
    return;
  }
  if (command === 'list') {
    for (const A of registry.list()) console.log(`${A.manifest.name}\t${A.manifest.title}\t${A.manifest.references.join('; ')}`);
    return;
  }
  if (command !== 'run' && command !== 'explain') throw new Error(`Bilinmeyen komut: ${command}\n${USAGE}`);
  if (command === 'run') {
    const target = opts.positional[0] ?? 'ExactMatch';
    if (target !== 'ExactMatch') throw new Error(`Bilinmeyen bileşen: ${target} (yalnızca ExactMatch)`);
  }
  if (!opts.patterns) throw new Error('--patterns gerekli');
  const em = new ExactMatch({ patterns: opts.patterns, ignoreCase: opts.ignoreCase, strategy: opts.strategy });
  const docs = await readDocs(opts);

  if (command === 'explain') {
    em.decide(docs[0]);
    process.stdout.write(JSON.stringify(em.record, null, 2) + '\n');
    return;
  }

  let buf = '';
  let count = 0;
  for (const match of em.run(docs)) {
    buf += JSON.stringify(match) + '\n';
    count++;
    if (buf.length > 1 << 16) {
      await writeOut(buf);
      buf = '';
    }
  }
  if (buf) await writeOut(buf);
  if (!opts.quiet) {
    process.stderr.write(`[ExactMatch] seçilen: ${em.record.selected ?? '-'}; eşleşme: ${count}; ${em.record.why}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`hata: ${err.message}\n`);
  process.exitCode = 1;
});
