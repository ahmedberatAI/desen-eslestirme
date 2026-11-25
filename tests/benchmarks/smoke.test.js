// Ölçüm altyapısı duman testleri: küçük bir ızgarada kalibrasyon + uydurma uçtan uca çalışıyor mu?
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCoefficients } from '../../bench/fit.js';
import { runCalibration } from '../../bench/calibrate.js';
import { evaluatePolicies, THRESHOLD, CLASSIC } from '../../bench/validate.js';
import { measure, median } from '../../bench/timing.js';
import { calibrationCases, validationCases, buildCase, GRID } from '../../bench/cases.js';

test('fitCoefficients: bilinen negatif olmayan katsayıları geri bulur', () => {
  const rows = [];
  for (let i = 1; i <= 30; i++) {
    const f = { a: i * 1000, b: (i % 7) * 50000, base: 1 };
    rows.push({ features: f, ms: (2e-9 * f.a + 5e-10 * f.b + 1e-5) * 1000 });
  }
  const fit = fitCoefficients(rows, ['a', 'b', 'base']);
  assert.ok(Math.abs(fit.coefficients.a / 2e-9 - 1) < 1e-3);
  assert.ok(Math.abs(fit.coefficients.b / 5e-10 - 1) < 1e-3);
  assert.ok(fit.relErrorMedian < 1e-3);
});

test('fitCoefficients: negatif çıkacak katsayı 0\'a sabitlenir', () => {
  const rows = [1, 2, 3, 4, 5].map((i) => ({ features: { a: i, junk: 6 - i }, ms: i }));
  const fit = fitCoefficients(rows, ['a', 'junk']);
  assert.ok(fit.coefficients.junk >= 0 && fit.coefficients.a > 0);
});

test('measure: ısınma + en az 5 tekrar, medyan', () => {
  const r = measure(() => 1, { minTotal: 0 });
  assert.ok(r.reps >= 5 && !r.censored);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('vaka üreticileri: ızgara boyutu, tohum ayrımı, deterministik veri', () => {
  assert.equal(calibrationCases(GRID).length, 180);
  const val = validationCases();
  assert.ok(val.length >= 100);
  const calSeeds = new Set(calibrationCases(GRID).map((c) => c.seed));
  assert.ok(val.every((c) => !calSeeds.has(c.seed)));
  assert.ok(val.some((c) => c.alphabet === 'binary') && val.some((c) => c.alphabet === 'unicode'));
  assert.ok(val.filter((c) => c.n).every((c) => !GRID.n.includes(c.n)));
  const a = buildCase(val[3]);
  const b = buildCase(val[3]);
  assert.deepEqual(a, b);
});

test('küçük ızgarada kalibrasyon ve politika karşılaştırması uçtan uca çalışır', () => {
  const { rows, fits } = runCalibration({ quick: true, log: false });
  assert.equal(rows.length, 16);
  for (const f of Object.values(fits)) assert.ok(Object.values(f.coefficients).every((c) => c >= 0));
  const table = evaluatePolicies(rows);
  assert.ok(table.some((p) => p.policy === 'ExactMatch (auto)'));
  assert.ok(table.some((p) => p.policy === THRESHOLD));
  assert.ok(table.some((p) => p.policy === CLASSIC));
  for (const p of table) assert.ok(p.geomeanSlowdown >= 1 - 1e-9 && p.worstSlowdown >= p.geomeanSlowdown - 1e-9);
});
