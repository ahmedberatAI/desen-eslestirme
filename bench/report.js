// npm run report — report/rapor.html dosyasını ölçüm sonuçlarından üretir ve (varsa) Edge/Chrome
// ile report/rapor.pdf'e basar. Anlatı metni report/narrative.js içindedir.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeFigures } from './figures.js';
import { BUILTIN_ATOMS } from '../src/registry.js';
import { sections } from '../report/narrative.js';
import { ALPHABET_LABELS } from './data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const RES = path.join(here, 'results');
const OUT = path.join(ROOT, 'report');

const read = (f) => JSON.parse(readFileSync(path.join(RES, f), 'utf8'));
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const fx = (x) => `${x.toFixed(2)}×`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function policyTable(table, highlight = 'ExactMatch (auto)') {
  const rows = [...table].sort((a, b) => a.geomeanSlowdown - b.geomeanSlowdown);
  return `<table><thead><tr><th>Politika</th><th>En hızlı</th><th>%10 içinde</th><th>Yavaşlama<br>geo. ort.</th><th>En kötü<br>yavaşlama</th><th>Toplam süre<br>/ en iyi</th></tr></thead><tbody>` +
    rows.map((p) => `<tr${p.policy === highlight ? ' class="hl"' : ''}><td>${esc(p.policy.replace('Search', ''))}</td><td>${pct(p.fastestRate)}</td><td>${pct(p.within10Rate)}</td><td>${fx(p.geomeanSlowdown)}</td><td>${fx(p.worstSlowdown)}</td><td>${fx(p.totalRatio)}</td></tr>`).join('') +
    '</tbody></table>';
}

function wrongTable(wrong, n = 8) {
  return `<table><thead><tr><th>Vaka</th><th>Alfabe</th><th>n</th><th>σ / σ<sub>eff</sub></th><th>k</th><th>m</th><th>Seçilen (ms)</th><th>En hızlı (ms)</th><th>Yavaşlama</th></tr></thead><tbody>` +
    wrong.slice(0, n).map((w) => `<tr><td>${w.id}</td><td>${esc(ALPHABET_LABELS[w.alphabet] ?? w.alphabet)}</td><td>${w.n}</td><td>${w.sigma} / ${w.sigmaEff}</td><td>${w.k}</td><td>${w.mMin === w.mMax ? w.mMin : `${w.mMin}–${w.mMax}`}</td><td>${w.chosen.replace('Search', '')} (${w.chosenMs})</td><td>${w.best.replace('Search', '')} (${w.bestMs})</td><td>${fx(w.slowdown)}</td></tr>`).join('') +
    '</tbody></table>';
}

function fitTable(fits) {
  return `<table class="small"><thead><tr><th>Atom</th><th>Özellikler (katsayı, s)</th><th>Medyan göreli hata</th><th>p90</th><th>Sansürlü</th></tr></thead><tbody>` +
    Object.entries(fits).map(([name, f]) => `<tr><td>${name.replace('Search', '')}</td><td>${Object.entries(f.coefficients).map(([k, v]) => `${k}=${v.toExponential(2)}`).join(', ')}</td><td>${pct(f.relErrorMedian)}</td><td>${pct(f.relErrorP90)}</td><td>${f.censored}</td></tr>`).join('') +
    '</tbody></table>';
}

const svgInline = (file, width = '100%') => readFileSync(path.join(RES, 'figures', file), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/width="(\d+)" height="(\d+)"/, `width="${width}" preserveAspectRatio="xMidYMid meet"`);

export function buildReport() {
  makeFigures();
  const cal = read('calibration-raw.json');
  const fit = read('calibration-fit.json');
  const val = read('validation-table.json');
  const calTable = read('calibration-table.json');
  const valRaw = read('validation-raw.json');
  const ctx = {
    machine: cal.meta.machine,
    calMeta: cal.meta,
    calRows: cal.rows,
    valRows: valRaw.rows,
    val,
    calTable,
    fits: fit.fits,
    atoms: BUILTIN_ATOMS,
    policyTable,
    wrongTable,
    fitTable,
    svg: svgInline,
    pct,
    fx,
    esc,
  };
  const body = sections(ctx);
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Akıllı Tam Desen Eşleştirme — IoS bileşen yayını</title>
<style>
@page { size: A4; margin: 15mm 14mm 15mm 14mm; }
body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; font-size: 9.6pt; line-height: 1.38; color: #111; }
h1 { font-size: 16pt; margin: 0 0 2px; } h2 { font-size: 12pt; margin: 12px 0 4px; border-bottom: 1px solid #999; }
h3 { font-size: 10.2pt; margin: 8px 0 3px; }
p { margin: 3px 0 5px; text-align: justify; } ul, ol { margin: 2px 0 5px 18px; padding: 0; } li { margin: 1px 0; }
table { border-collapse: collapse; margin: 4px 0 6px; font-size: 8.4pt; width: 100%; }
th, td { border: 1px solid #bbb; padding: 2px 4px; text-align: left; vertical-align: top; } th { background: #eee; }
td:not(:first-child) { white-space: nowrap; } table.small { font-size: 7.6pt; } table.small td { white-space: normal; }
tr.hl td { background: #fff3c4; font-weight: bold; }
code { font-family: Consolas, monospace; font-size: 8.6pt; background: #f4f4f4; padding: 0 2px; }
pre { font-family: Consolas, monospace; font-size: 8pt; background: #f4f4f4; padding: 4px 6px; white-space: pre-wrap; margin: 3px 0 6px; }
figure { margin: 6px 0; page-break-inside: avoid; } figcaption { font-size: 8.4pt; color: #333; margin-top: 2px; }
.meta { color: #444; font-size: 9pt; margin-bottom: 6px; } .appendix { page-break-before: always; }
.two { display: flex; gap: 8px; } .two > figure { flex: 1; }
</style></head><body>${body}</body></html>`;
  mkdirSync(OUT, { recursive: true });
  const htmlPath = path.join(OUT, 'rapor.html');
  writeFileSync(htmlPath, html);
  return htmlPath;
}

function findBrowser() {
  const cands = [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return cands.find((c) => c && existsSync(c));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = buildReport();
  console.log(`HTML: ${htmlPath}`);
  const browser = findBrowser();
  if (!browser) {
    console.log('Edge/Chrome bulunamadı; PDF için rapor.html dosyasını tarayıcıda açıp yazdırın.');
  } else {
    const pdf = path.join(OUT, 'rapor.pdf');
    const r = spawnSync(browser, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(htmlPath).href], { encoding: 'utf8', timeout: 120000 });
    console.log(r.status === 0 || existsSync(pdf) ? `PDF: ${pdf}` : `PDF üretilemedi: ${r.stderr}`);
  }
}
