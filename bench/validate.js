// npm run bench
// Doğrulama: kalibrasyonda kullanılmamış vakalarda bütün atomları ölçer ve molekülün seçimini
// "her zaman aynı atom" politikaları ve iki sabit kuralla (uzunluk eşiği kuralı, klasik araç kuralı)
// karşılaştırır.
// Çıktılar: bench/results/validation-raw.json, validation-table.json, validation-table.md
// Seçenekler: --quick (küçük küme), --out <dizin>

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validationCases, buildCase } from './cases.js';
import { measureCase, machineInfo, progress, round } from './runner.js';
import { measure } from './timing.js';
import { BUILTIN_ATOMS } from '../src/registry.js';
import { ExactMatch } from '../src/molecules/ExactMatch.js';
import { computeShape } from '../src/shape.js';

const AUTO = 'ExactMatch (auto)';
export const THRESHOLD = 'Eşik kuralı (m<50 → TunedBM, değilse HASHq)';
export const CLASSIC = 'Klasik kural (k=1 → Boyer-Moore, k>1 → Aho-Corasick)';

/** Molekülün bir vaka için seçimi (kayıtlı veri şekli üzerinden; decide() ile aynı mantık). */
export function moleculeChoice(shape, calibration) {
  const em = new ExactMatch({ patterns: ['A'], ...(calibration !== undefined ? { calibration } : {}) });
  const est = em.estimate(shape);
  return est.find((e) => e.applicable === true).atom;
}

/** Yalnızca desen uzunluğuna bakan sabit eşik: kısa desende ayarlı BM, uzun desende q-gram kayması. */
export function thresholdChoice(shape) {
  return shape.mAvg < 50 ? 'TunedBoyerMooreSearch' : 'HashQSearch';
}

/** Yalnızca desen sayısına bakan klasik kural: tek desende Boyer-Moore, çok desende Aho-Corasick otomatı. */
export function classicChoice(shape) {
  return shape.kUnique === 1 ? 'BoyerMooreSearch' : 'AhoCorasickSearch';
}

function bestOf(row) {
  let best = null;
  for (const [atom, t] of Object.entries(row.times)) if (!best || t.ms < best.ms) best = { atom, ms: t.ms };
  return best;
}

/** Bütün politikalar için ölçütler. */
export function evaluatePolicies(rows, { calibration } = {}) {
  const policies = new Map();
  const add = (name, fn) => policies.set(name, fn);
  add(AUTO, (r) => moleculeChoice(r.shape, calibration));
  add(THRESHOLD, (r) => thresholdChoice(r.shape));
  add(CLASSIC, (r) => classicChoice(r.shape));
  for (const A of BUILTIN_ATOMS) add(`Her zaman ${A.manifest.name}`, () => A.manifest.name);

  const table = [];
  for (const [policy, choose] of policies) {
    let fastest = 0;
    let within10 = 0;
    let logSum = 0;
    let worst = 0;
    let worstCase = null;
    let total = 0;
    let totalBest = 0;
    const picks = {};
    for (const r of rows) {
      const best = bestOf(r);
      const atom = choose(r);
      const t = r.times[atom].ms;
      const s = t / best.ms;
      picks[atom] = (picks[atom] ?? 0) + 1;
      if (atom === best.atom || s <= 1) fastest++;
      if (s <= 1.1) within10++;
      logSum += Math.log(s);
      if (s > worst) {
        worst = s;
        worstCase = r.id;
      }
      total += t;
      totalBest += best.ms;
    }
    const N = rows.length;
    table.push({
      policy,
      cases: N,
      fastestRate: fastest / N,
      within10Rate: within10 / N,
      geomeanSlowdown: Math.exp(logSum / N),
      worstSlowdown: worst,
      worstCase,
      totalRatio: total / totalBest,
      picks,
    });
  }
  return table;
}

/** Molekülün yanlış seçimleri (yavaşlamaya göre azalan). */
export function mispredictions(rows, { calibration } = {}) {
  return rows
    .map((r) => {
      const best = bestOf(r);
      const chosen = moleculeChoice(r.shape, calibration);
      return {
        id: r.id,
        alphabet: r.alphabet,
        n: r.shape.n,
        sigma: r.shape.sigma,
        sigmaEff: r.shape.sigmaEff,
        k: r.shape.k,
        mMin: r.shape.mMin,
        mMax: r.shape.mMax,
        chosen,
        chosenMs: r.times[chosen].ms,
        best: best.atom,
        bestMs: best.ms,
        slowdown: r.times[chosen].ms / best.ms,
      };
    })
    .filter((x) => x.chosen !== x.best)
    .sort((a, b) => b.slowdown - a.slowdown);
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const fx = (x) => `${x.toFixed(2)}×`;

export function tableMarkdown(table) {
  const lines = [
    '| Politika | En hızlıyı seçme | %10 içinde | Yavaşlama (geo. ort.) | En kötü yavaşlama | Toplam süre / en iyi |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  const sorted = [...table].sort((a, b) => a.geomeanSlowdown - b.geomeanSlowdown);
  for (const p of sorted) {
    const name = p.policy === AUTO ? `**${p.policy}**` : p.policy;
    lines.push(`| ${name} | ${pct(p.fastestRate)} | ${pct(p.within10Rate)} | ${fx(p.geomeanSlowdown)} | ${fx(p.worstSlowdown)} (${p.worstCase}) | ${fx(p.totalRatio)} |`);
  }
  return lines.join('\n');
}

export function runValidation({ quick = false, budget = 600, log = true } = {}) {
  const cases = quick ? validationCases({ perAlphabet: 2, real: false }) : validationCases();
  const rows = [];
  cases.forEach((c, i) => {
    if (log) progress(i, cases.length, `${c.id} ${c.alphabet} n=${c.n ?? '-'} m=${c.m} k=${c.k}`);
    const row = measureCase(c, BUILTIN_ATOMS, { budget });
    // molekülün karar maliyeti: veri şekli + bütün atomların tahminleri (atomun kurulumu hariç;
    // o zaten atomun ölçülen süresine dahildir)
    const { docs, params } = buildCase(c);
    const d = measure(() => new ExactMatch({ ...params, strategy: 'auto' }).estimate(computeShape(docs[0], params))[0].atom, { minTotal: 20 });
    row.decisionMs = round(d.ms);
    rows.push(row);
  });
  if (log) progress(cases.length, cases.length, 'tamam');
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const outIdx = args.indexOf('--out');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : path.join(here, 'results'));
  mkdirSync(outDir, { recursive: true });
  const machine = machineInfo();
  const t0 = Date.now();
  const rows = args.includes('--reuse') && existsSync(path.join(outDir, 'validation-raw.json'))
    ? JSON.parse(readFileSync(path.join(outDir, 'validation-raw.json'), 'utf8')).rows
    : runValidation({ quick });
  const meta = { machine, cases: rows.length, seconds: Math.round((Date.now() - t0) / 1000) };
  if (!args.includes('--reuse')) writeFileSync(path.join(outDir, 'validation-raw.json'), JSON.stringify({ meta, rows }, null, 1));
  const table = evaluatePolicies(rows);
  const wrong = mispredictions(rows);
  const decision = rows.map((r) => r.decisionMs).filter(Number.isFinite).sort((a, b) => a - b);
  const summary = {
    meta,
    table,
    mispredictions: wrong,
    decisionMs: decision.length ? { median: decision[decision.length >> 1], max: decision[decision.length - 1] } : null,
  };
  writeFileSync(path.join(outDir, 'validation-table.json'), JSON.stringify(summary, null, 2));

  // kalibrasyon kümesinde (örneklem içi) aynı tablo — karşılaştırma için
  let calMd = '';
  const calPath = path.join(outDir, 'calibration-raw.json');
  if (existsSync(calPath)) {
    const calRows = JSON.parse(readFileSync(calPath, 'utf8')).rows;
    const calTable = evaluatePolicies(calRows);
    writeFileSync(path.join(outDir, 'calibration-table.json'), JSON.stringify({ table: calTable, mispredictions: mispredictions(calRows) }, null, 2));
    calMd = `\n\n## Kalibrasyon kümesi (örneklem içi, ${calRows.length} vaka)\n\n${tableMarkdown(calTable)}\n`;
  }
  const md = `# Doğrulama tablosu\n\nMakine: ${machine.cpu}, ${machine.cores} çekirdek, ${machine.platform}, Node ${machine.node}\n\n` +
    `Vaka sayısı: ${rows.length} (kalibrasyonda kullanılmayan tohumlar, ızgara arası değerler, yeni alfabeler: binary, unicode; gerçek veri: llm.c train_gpt2.c, HumanEval).\n` +
    `Ölçüm: her atom × vaka için 1 ısınma + ≥5 tekrarın medyanı. Molekül karar süresi: medyan ${summary.decisionMs?.median} ms, en çok ${summary.decisionMs?.max} ms (tabloya dahil değil).\n\n` +
    `${tableMarkdown(table)}\n\n## Molekülün en kötü 10 yanlış seçimi\n\n| Vaka | Alfabe | n | σ (σ_eff) | k | m | Seçilen | En hızlı | Yavaşlama |\n|---|---|---:|---|---:|---|---|---|---:|\n` +
    wrong.slice(0, 10).map((w) => `| ${w.id} | ${w.alphabet} | ${w.n} | ${w.sigma} (${w.sigmaEff}) | ${w.k} | ${w.mMin}–${w.mMax} | ${w.chosen} (${w.chosenMs} ms) | ${w.best} (${w.bestMs} ms) | ${fx(w.slowdown)} |`).join('\n') +
    calMd;
  writeFileSync(path.join(outDir, 'validation-table.md'), md);
  console.log(tableMarkdown(table));
  console.log(`süre: ${meta.seconds} s`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
