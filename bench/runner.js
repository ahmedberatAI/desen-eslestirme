// Ortak ölçüm döngüsü: bir vakada bütün atomları ölçer, sonuç sayılarını çapraz kontrol eder.

import os from 'node:os';
import { measure, runAtom } from './timing.js';
import { buildCase } from './cases.js';
import { computeShape } from '../src/shape.js';

export function machineInfo() {
  const cpus = os.cpus();
  return {
    cpu: cpus[0]?.model?.trim(),
    cores: cpus.length,
    memoryGB: Math.round(os.totalmem() / 2 ** 30),
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    node: process.version,
    v8: process.versions.v8,
    exposeGc: typeof globalThis.gc === 'function',
    date: new Date().toISOString(),
  };
}

/**
 * @param {object} c       vaka tanımı (cases.js)
 * @param {Function[]} atoms atom sınıfları
 * @param {object} opts    measure() seçenekleri (budget vb.)
 */
export function measureCase(c, atoms, opts = {}) {
  const { docs, params } = buildCase(c);
  const shape = computeShape(docs[0], params);
  const times = {};
  const features = {};
  let expected = null;
  for (const A of atoms) {
    const name = A.manifest.name;
    let result;
    const r = measure(() => (result = runAtom(A, params, docs)), opts);
    if (expected === null) expected = result;
    if (result !== expected) throw new Error(`${c.id}: ${name} ${result} eşleşme buldu, beklenen ${expected}`);
    times[name] = { ms: round(r.ms), reps: r.reps, censored: r.censored, warmup: round(r.warmup) };
    const app = typeof A.selection.applicable === 'function' ? A.selection.applicable(shape) : true;
    features[name] = app === true ? A.selection.features(shape) : null;
  }
  const { lengths, ...shapeSummary } = shape;
  return { ...c, shape: { ...shapeSummary, lengths }, matches: expected, times, features };
}

export function round(x, d = 5) {
  return Number(x.toPrecision(d));
}

export function progress(i, total, label) {
  process.stderr.write(`\r[${String(i).padStart(4)}/${total}] ${label.padEnd(60).slice(0, 60)}`);
  if (i === total) process.stderr.write('\n');
}
