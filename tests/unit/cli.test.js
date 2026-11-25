// Komut satırı (bölüm 4.5) testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { registry } from '../../src/registry.js';

const BIN = fileURLToPath(new URL('../../bin/ios.js', import.meta.url));
const GPT2 = fileURLToPath(new URL('../data/train_gpt2.c', import.meta.url));
const HUMANEVAL = fileURLToPath(new URL('../data/humaneval.jsonl', import.meta.url));
// İki belgelik bir JSONL kod derlemi: "# TODO: cache\n# FIXME: race\n# TODO\n" ve "fixme later\n"
const CORPUS =
  JSON.stringify({ id: 'src/app.py', text: '# TODO: cache\n# FIXME: race\n# TODO\n', lang: 'python' }) + '\n' +
  JSON.stringify({ id: 'src/util.py', text: 'fixme later\n' }) + '\n';

const ios = (args, input) => spawnSync(process.execPath, [BIN, ...args], { input, encoding: 'utf8' });
const parse = (stdout) => stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('run: JSONL girdi, JSONL çıktı, sözleşme sırası, karar stderr\'de', () => {
  const r = ios(['run', 'ExactMatch', '--patterns', 'TODO,FIXME'], CORPUS);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(parse(r.stdout), [
    { id: 'src/app.py', pattern: 'TODO', position: 2, length: 4 },
    { id: 'src/app.py', pattern: 'FIXME', position: 16, length: 5 },
    { id: 'src/app.py', pattern: 'TODO', position: 30, length: 4 },
  ]);
  assert.match(r.stderr, /seçilen/);
});

test('run: --ignoreCase ve --strategy (her strateji aynı sonuç)', () => {
  for (const strategy of ['auto', ...registry.names()]) {
    const r = ios(['run', 'ExactMatch', '--patterns', 'TODO,FIXME', '--ignoreCase', '--strategy', strategy, '--quiet'], CORPUS);
    assert.equal(r.status, 0, r.stderr);
    const got = parse(r.stdout).map((m) => `${m.id}:${m.position}:${m.pattern}`);
    assert.deepEqual(got, ['src/app.py:2:TODO', 'src/app.py:16:FIXME', 'src/app.py:30:TODO', 'src/util.py:0:FIXME'], strategy);
    assert.equal(r.stderr, '');
  }
});

test('run: düz metin girdi tek belgedir (stdin ve --input)', () => {
  let r = ios(['run', 'ExactMatch', '--patterns', 'return', '--quiet'], 'int main() { return 0; }\n');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(parse(r.stdout), [{ id: 'stdin', pattern: 'return', position: 13, length: 6 }]);
  // --format text: JSON'a benzeyen girdi de düz metin olarak aranabilir
  r = ios(['run', 'ExactMatch', '--patterns', '"a"', '--format', 'text', '--quiet'], '{"a":1}');
  assert.deepEqual(parse(r.stdout).map((m) => m.position), [1]);
  r = spawnSync(process.execPath, [BIN, 'run', 'ExactMatch', '--patterns', 'attention_forward', '--input', GPT2, '--quiet'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const got = parse(r.stdout);
  assert.ok(got.length >= 2);
  assert.ok(got.every((m) => m.id === 'train_gpt2.c' && m.pattern === 'attention_forward'));
});

test('explain: yalnızca kararı JSON olarak yazar', () => {
  const r = spawnSync(process.execPath, [BIN, 'explain', '--patterns', 'attention_forward,layernorm_forward', '--input', GPT2], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const rec = JSON.parse(r.stdout);
  assert.equal(rec.requested, 'auto');
  assert.ok(registry.has(rec.selected));
  assert.equal(rec.shape.n, 50680);
  assert.equal(rec.shape.k, 2);
  assert.ok(Array.isArray(rec.estimates) && rec.estimates.length === registry.names().length);
  assert.equal(typeof rec.why, 'string');
  // .jsonl uzantılı --input: karar akıştaki ilk belgeye (HumanEval/0, 600 karakter) göre verilir
  const h = JSON.parse(spawnSync(process.execPath, [BIN, 'explain', '--patterns', 'def ', '--input', HUMANEVAL], { encoding: 'utf8' }).stdout);
  assert.equal(h.shape.n, 600);
});

test('hatalar: bilinmeyen strateji, eksik desen, boş desen, bozuk JSONL', () => {
  let r = ios(['run', 'ExactMatch', '--patterns', 'TODO', '--strategy', 'Nope'], CORPUS);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Geçerli seçenekler: auto, /);
  r = ios(['run', 'ExactMatch'], CORPUS);
  assert.notEqual(r.status, 0);
  r = ios(['run', 'ExactMatch', '--patterns', 'a,,c'], CORPUS);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /boş/);
  r = ios(['run', 'ExactMatch', '--patterns', 'a'], '{"id":"x","text":"a"}\n{bozuk\n');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /2\. satır/);
});
