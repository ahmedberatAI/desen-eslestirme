// npm run figures — ölçüm sonuçlarından SVG şekiller üretir (bağımlılık yok).
//   fig-winners.svg     : kalibrasyon ızgarasında (m × k) en hızlı atom, alfabe × n panelleri
//   fig-molecule.svg    : aynı ızgarada molekülün seçimi ve yavaşlaması
//   fig-ecdf.svg        : doğrulama kümesinde yavaşlama dağılımı (ECDF), politikalar
//   fig-model.svg       : doğrulama kümesinde tahmin edilen maliyet vs ölçülen süre (log-log)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_ATOMS } from '../src/registry.js';
import { ExactMatch } from '../src/molecules/ExactMatch.js';
import { moleculeChoice, thresholdChoice, classicChoice } from './validate.js';
import { ALPHABET_LABELS } from './data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(here, 'results');
const FIG = path.join(RES, 'figures');

export const COLORS = {
  NaiveSearch: '#9e9e9e', BoyerMooreSearch: '#8d6e63', HorspoolSearch: '#ffb300', ShiftOrSearch: '#7cb342',
  TunedBoyerMooreSearch: '#f4511e', HashQSearch: '#e53935', KmpSearch: '#00897b', RabinKarpSearch: '#5e35b1',
  AhoCorasickSearch: '#1e88e5', WuManberSearch: '#00acc1', SuffixArraySearch: '#6d4c41', FmIndexSearch: '#3949ab',
};
export const SHORT = {
  NaiveSearch: 'Naive', BoyerMooreSearch: 'BM', HorspoolSearch: 'Hor', ShiftOrSearch: 'SO', TunedBoyerMooreSearch: 'TBM',
  HashQSearch: 'HQ', KmpSearch: 'KMP', RabinKarpSearch: 'RK', AhoCorasickSearch: 'AC', WuManberSearch: 'WM',
  SuffixArraySearch: 'SA', FmIndexSearch: 'FM',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif">\n<rect width="100%" height="100%" fill="white"/>\n${body}\n</svg>\n`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 11}" text-anchor="${o.anchor ?? 'middle'}" fill="${o.fill ?? '#222'}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.rotate ? ` transform="rotate(${o.rotate} ${x} ${y})"` : ''}>${esc(s)}</text>`;

function bestAtom(row) {
  let b = null;
  for (const [a, t] of Object.entries(row.times)) if (!b || t.ms < b.ms) b = { atom: a, ms: t.ms };
  return b;
}

function legend(x, y, atoms) {
  let out = '';
  atoms.forEach((a, i) => {
    const xx = x + (i % 6) * 128;
    const yy = y + Math.floor(i / 6) * 18;
    out += `<rect x="${xx}" y="${yy - 10}" width="12" height="12" fill="${COLORS[a]}"/>` + text(xx + 16, yy, `${SHORT[a]} = ${a.replace('Search', '').replace('TunedBoyerMoore', 'Tuned BM')}`, { anchor: 'start', size: 10 });
  });
  return out;
}

/** m × k ızgarası panelleri. cell(row) -> { atom, label } */
function gridFigure(rows, title, cell) {
  const alphabets = [...new Set(rows.map((r) => r.alphabet))];
  const ns = [...new Set(rows.map((r) => r.n))].sort((a, b) => a - b);
  const ms = [...new Set(rows.map((r) => r.m))].sort((a, b) => a - b);
  const ks = [...new Set(rows.map((r) => r.k))].sort((a, b) => a - b);
  const cw = 44;
  const ch = 26;
  const pw = ms.length * cw + 50;
  const ph = ks.length * ch + 50;
  const W = 40 + ns.length * pw + 20;
  const H = 60 + alphabets.length * ph + 60;
  let body = text(W / 2, 22, title, { size: 14, weight: 'bold' });
  alphabets.forEach((a, ai) => {
    ns.forEach((n, ni) => {
      const ox = 60 + ni * pw;
      const oy = 50 + ai * ph;
      body += text(ox + (ms.length * cw) / 2, oy + 2, `${ALPHABET_LABELS[a] ?? a}, n = ${n.toExponential(0).replace('e+', 'e')}`, { size: 11, weight: 'bold' });
      ms.forEach((m, mi) => (body += text(ox + mi * cw + cw / 2, oy + 16, `m=${m}`, { size: 9, fill: '#555' })));
      ks.forEach((k, ki) => {
        body += text(ox - 4, oy + 22 + ki * ch + ch / 2 + 4, `k=${k}`, { size: 9, anchor: 'end', fill: '#555' });
        ms.forEach((m, mi) => {
          const r = rows.find((x) => x.alphabet === a && x.n === n && x.m === m && x.k === k);
          if (!r) return;
          const c = cell(r);
          const x = ox + mi * cw;
          const y = oy + 22 + ki * ch;
          body += `<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" fill="${COLORS[c.atom]}" ${c.stroke ? 'stroke="#000" stroke-width="2"' : ''}/>`;
          body += text(x + cw / 2, y + ch / 2 + 4, c.label, { size: 9, fill: '#fff', weight: 'bold' });
        });
      });
    });
  });
  const used = BUILTIN_ATOMS.map((A) => A.manifest.name);
  body += legend(30, H - 38, used);
  return svg(W, H, body);
}

function ecdfFigure(rows, policies) {
  const W = 640;
  const H = 380;
  const L = 60;
  const R = 200;
  const T = 40;
  const B = 50;
  const xmax = 10;
  const lx = (s) => L + (Math.log10(Math.min(s, xmax)) / Math.log10(xmax)) * (W - L - R);
  const ly = (p) => H - B - p * (H - T - B);
  let body = text(W / 2, 22, 'Doğrulama kümesi: yavaşlama dağılımı (seçilen süre / en hızlı süre)', { size: 13, weight: 'bold' });
  body += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#333"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#333"/>`;
  for (const s of [1, 1.1, 1.5, 2, 3, 5, 10]) body += `<line x1="${lx(s)}" y1="${T}" x2="${lx(s)}" y2="${H - B}" stroke="#eee"/>` + text(lx(s), H - B + 14, s === 10 ? '≥10' : `${s}`, { size: 10 });
  for (const p of [0, 0.25, 0.5, 0.75, 1]) body += `<line x1="${L}" y1="${ly(p)}" x2="${W - R}" y2="${ly(p)}" stroke="#eee"/>` + text(L - 6, ly(p) + 4, `${p * 100}%`, { size: 10, anchor: 'end' });
  body += text((L + W - R) / 2, H - 12, 'yavaşlama (log ölçek)', { size: 11 });
  body += text(16, (T + H - B) / 2, 'vakaların oranı', { size: 11, rotate: -90 });
  const palette = ['#d81b60', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#6d4c41', '#00897b'];
  policies.forEach((p, i) => {
    const s = rows.map((r) => p.choose(r)).sort((a, b) => a - b);
    let d = `M ${lx(1)} ${ly(0)}`;
    s.forEach((v, j) => {
      d += ` L ${lx(Math.max(1, v))} ${ly(j / s.length)} L ${lx(Math.max(1, v))} ${ly((j + 1) / s.length)}`;
    });
    d += ` L ${lx(xmax)} ${ly(1)}`;
    body += `<path d="${d}" fill="none" stroke="${palette[i]}" stroke-width="${i === 0 ? 3 : 1.8}"/>`;
    body += `<line x1="${W - R + 12}" y1="${T + 10 + i * 20}" x2="${W - R + 32}" y2="${T + 10 + i * 20}" stroke="${palette[i]}" stroke-width="3"/>` + text(W - R + 36, T + 14 + i * 20, p.name, { size: 10, anchor: 'start' });
  });
  return svg(W, H, body);
}

function modelFigure(rows) {
  const em = new ExactMatch({ patterns: ['A'] });
  const pts = [];
  for (const r of rows) {
    const est = em.estimate(r.shape);
    for (const e of est) if (e.cost != null && !r.times[e.atom].censored) pts.push({ atom: e.atom, pred: e.cost * 1000, meas: r.times[e.atom].ms });
  }
  const W = 560;
  const H = 460;
  const L = 60;
  const T = 40;
  const B = 50;
  const R = 20;
  const lo = -3;
  const hi = 4; // 1 µs .. 10 s (ms cinsinden 10^-3..10^4)
  const sx = (v) => L + ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * (W - L - R);
  const sy = (v) => H - B - ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * (H - T - B);
  let body = text(W / 2, 22, 'Maliyet modeli: tahmin vs ölçüm (doğrulama kümesi, bütün atomlar)', { size: 13, weight: 'bold' });
  for (let e = lo; e <= hi; e++) {
    body += `<line x1="${sx(10 ** e)}" y1="${T}" x2="${sx(10 ** e)}" y2="${H - B}" stroke="#eee"/><line x1="${L}" y1="${sy(10 ** e)}" x2="${W - R}" y2="${sy(10 ** e)}" stroke="#eee"/>`;
    body += text(sx(10 ** e), H - B + 14, `1e${e}`, { size: 9 }) + text(L - 4, sy(10 ** e) + 3, `1e${e}`, { size: 9, anchor: 'end' });
  }
  body += `<line x1="${sx(10 ** lo)}" y1="${sy(10 ** lo)}" x2="${sx(10 ** hi)}" y2="${sy(10 ** hi)}" stroke="#333" stroke-dasharray="4 3"/>`;
  for (const p of pts) body += `<circle cx="${sx(p.pred).toFixed(1)}" cy="${sy(p.meas).toFixed(1)}" r="2" fill="${COLORS[p.atom]}" fill-opacity="0.6"/>`;
  body += text((L + W - R) / 2, H - 14, 'tahmin edilen süre (ms)', { size: 11 }) + text(16, (T + H - B) / 2, 'ölçülen süre (ms)', { size: 11, rotate: -90 });
  return svg(W, H, body);
}

export function makeFigures() {
  mkdirSync(FIG, { recursive: true });
  const cal = JSON.parse(readFileSync(path.join(RES, 'calibration-raw.json'), 'utf8')).rows;
  writeFileSync(path.join(FIG, 'fig-winners.svg'), gridFigure(cal, 'Kalibrasyon ızgarası: en hızlı atom (satır: desen sayısı k, sütun: desen uzunluğu m)', (r) => {
    const b = bestAtom(r);
    return { atom: b.atom, label: SHORT[b.atom] };
  }));
  writeFileSync(path.join(FIG, 'fig-molecule.svg'), gridFigure(cal, 'Molekülün seçimi (hücre etiketi: yavaşlama; ✓ = en hızlı seçildi)', (r) => {
    const atom = moleculeChoice(r.shape);
    const b = bestAtom(r);
    const s = r.times[atom].ms / b.ms;
    return { atom, label: atom === b.atom ? `${SHORT[atom]} ✓` : `${SHORT[atom]} ${s.toFixed(1)}×`, stroke: s > 1.5 };
  }));
  let val = null;
  try {
    val = JSON.parse(readFileSync(path.join(RES, 'validation-raw.json'), 'utf8')).rows;
  } catch {
    /* doğrulama henüz çalıştırılmadı */
  }
  if (val) {
    const slow = (atomOf) => (r) => r.times[atomOf(r)].ms / bestAtom(r).ms;
    const singles = BUILTIN_ATOMS.map((A) => A.manifest.name)
      .map((a) => ({ a, g: val.reduce((s, r) => s + Math.log(r.times[a].ms / bestAtom(r).ms), 0) }))
      .sort((x, y) => x.g - y.g)
      .slice(0, 3);
    const policies = [
      { name: 'ExactMatch (auto)', choose: slow((r) => moleculeChoice(r.shape)) },
      { name: 'eşik kuralı (m<50)', choose: slow((r) => thresholdChoice(r.shape)) },
      { name: 'klasik kural (BM/AC)', choose: slow((r) => classicChoice(r.shape)) },
      ...singles.map(({ a }) => ({ name: `her zaman ${SHORT[a]}`, choose: slow(() => a) })),
    ];
    writeFileSync(path.join(FIG, 'fig-ecdf.svg'), ecdfFigure(val, policies));
    writeFileSync(path.join(FIG, 'fig-model.svg'), modelFigure(val));
  }
  return FIG;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`şekiller: ${makeFigures()}`);
}
