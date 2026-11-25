// npm run calibrate
// 1) Kalibrasyon ızgarasındaki her vakada bütün atomları ölçer (ısınma + ≥5 tekrar medyanı).
// 2) Her atom için maliyet modeli katsayılarını (negatif olmayan, göreli hata EKK) kestirir.
// 3) Çıktılar: bench/results/calibration-raw.json, bench/results/calibration-fit.json,
//    src/calibration.json (molekülün kullandığı katsayılar).
//
// Seçenekler: --quick (küçük ızgara, duman testi), --out <dizin>, --no-write (src'ye yazma)

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrationCases, GRID, QUICK_GRID } from './cases.js';
import { measureCase, machineInfo, progress } from './runner.js';
import { fitCoefficients } from './fit.js';
import { BUILTIN_ATOMS } from '../src/registry.js';
import { CALIBRATION_FILE } from '../src/calibration.js';

export function fitAll(rows, atoms) {
  const out = {};
  for (const A of atoms) {
    const name = A.manifest.name;
    const names = Object.keys(A.selection.defaults);
    const data = rows
      .filter((r) => r.features[name] && !r.times[name].censored)
      .map((r) => ({ features: r.features[name], ms: r.times[name].ms }));
    const fit = fitCoefficients(data, names);
    out[name] = { ...fit, features: names, censored: rows.filter((r) => r.times[name].censored).length };
  }
  return out;
}

export function runCalibration({ quick = false, budget = 600, log = true } = {}) {
  const cases = calibrationCases(quick ? QUICK_GRID : GRID);
  const rows = [];
  cases.forEach((c, i) => {
    if (log) progress(i, cases.length, `${c.id} ${c.alphabet} n=${c.n} m=${c.m} k=${c.k}`);
    rows.push(measureCase(c, BUILTIN_ATOMS, { budget }));
  });
  if (log) progress(cases.length, cases.length, 'tamam');
  return { rows, fits: fitAll(rows, BUILTIN_ATOMS) };
}

async function main() {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const outIdx = args.indexOf('--out');
  const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), 'results'));
  mkdirSync(outDir, { recursive: true });
  const machine = machineInfo();
  const t0 = Date.now();
  const { rows, fits } = runCalibration({ quick });
  const meta = {
    machine,
    grid: quick ? QUICK_GRID : GRID,
    protocol: 'her atom × vaka: 1 ısınma turu, ardından ≥5 tekrar (toplam ≥100 ms olana dek, en çok 21) medyanı; ısınma > 600 ms ise sansürlü (tekrar yok)',
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  writeFileSync(path.join(outDir, 'calibration-raw.json'), JSON.stringify({ meta, rows }, null, 1));
  writeFileSync(path.join(outDir, 'calibration-fit.json'), JSON.stringify({ meta, fits }, null, 2));
  if (!quick && !args.includes('--no-write')) {
    const atoms = Object.fromEntries(Object.entries(fits).map(([k, v]) => [k, { coefficients: v.coefficients, relErrorMedian: v.relErrorMedian, n: v.n }]));
    writeFileSync(CALIBRATION_FILE, JSON.stringify({ generated: machine.date, machine: `${machine.cpu}, Node ${machine.node}`, unit: 'seconds', atoms }, null, 2) + '\n');
  }
  for (const [name, f] of Object.entries(fits)) {
    console.log(`${name.padEnd(20)} n=${String(f.n).padStart(3)} medyan göreli hata=${(f.relErrorMedian * 100).toFixed(1)}%  p90=${(f.relErrorP90 * 100).toFixed(1)}%  sansürlü=${f.censored}`);
  }
  console.log(`süre: ${meta.seconds} s`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
