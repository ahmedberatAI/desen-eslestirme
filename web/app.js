// Desen Eşleştirme Lab — tarayıcı arayüzü.
// Bütün arama işi depodaki gerçek kaynak koddan (src/) gelir; bu dosya yalnızca arayüzdür.

import { ExactMatch, registry, parseCorpus, detectFormat, computeShape } from '../src/index.js';

const $ = (id) => document.getElementById(id);
const el = {
  patterns: $('patterns'), corpus: $('corpus'), file: $('file'), format: $('format'),
  strategy: $('strategy'), ignoreCase: $('ignoreCase'), runBtn: $('runBtn'), raceBtn: $('raceBtn'),
  error: $('error'), empty: $('empty'), out: $('out'), stats: $('stats'), patternCount: $('patternCount'),
  corpusInfo: $('corpusInfo'), samples: $('samples'), decisionSub: $('decisionSub'), selectedPill: $('selectedPill'),
  shape: $('shape'), why: $('why'), estimates: $('estimates'), raceCard: $('raceCard'), raceSub: $('raceSub'),
  raceTable: $('raceTable'), matchSub: $('matchSub'), perPattern: $('perPattern'), docSelect: $('docSelect'),
  viewer: $('viewer'), prevHit: $('prevHit'), nextHit: $('nextHit'), hitPos: $('hitPos'), raw: $('raw'),
  rawInfo: $('rawInfo'), download: $('download'), atomTable: $('atomTable'),
};

// ---------------------------------------------------------------- atom bilgileri
const ATOM_INFO = {
  NaiveSearch: { group: '–', algo: 'Kaba kuvvet', ref: '—', note: 'Test oracle’ı: diğer bütün atomlar bununla karşılaştırılır.' },
  BoyerMooreSearch: { group: '–', algo: 'Boyer-Moore (kötü karakter + iyi sonek)', ref: 'Boyer & Moore 1977', note: 'Uzun desen, geniş alfabe: sağdan sola karşılaştırıp büyük kaymalar yapar.' },
  HorspoolSearch: { group: 'A', algo: 'Horspool (BMH)', ref: 'Horspool 1980', note: 'Yalnızca kötü karakter kayması; basit ve hızlı.' },
  ShiftOrSearch: { group: 'A', algo: 'Shift-Or (bit paralel)', ref: 'Baeza-Yates & Gonnet 1992', note: 'Kısa desen, küçük alfabe. m ≤ 32 doğrudan, m > 32 filtre + doğrulama.' },
  TunedBoyerMooreSearch: { group: 'A', algo: 'Tuned Boyer-Moore (UFAST)', ref: 'Hume & Sunday 1991', note: 'Sentinel + 3 kez açılmış atlama döngüsü.' },
  HashQSearch: { group: 'A', algo: 'HASHq (q-gram Horspool)', ref: 'Lecroq 2007', note: 'Küçük alfabede uzun desenler: q-gram özetiyle daha büyük kaymalar.' },
  KmpSearch: { group: 'B', algo: 'Knuth-Morris-Pratt', ref: 'Knuth, Morris & Pratt 1977', note: 'En kötü durumda bile doğrusal; periyodik metinlerde güvenli.' },
  RabinKarpSearch: { group: 'B', algo: 'Rabin-Karp (çok desenli)', ref: 'Karp & Rabin 1987', note: 'Her farklı uzunluk için tek kayan özet.' },
  AhoCorasickSearch: { group: 'C', algo: 'Aho-Corasick', ref: 'Aho & Corasick 1975', note: 'Çok sayıda desen: tam DFA ile metinde tek geçiş.' },
  WuManberSearch: { group: 'C', algo: 'Wu-Manber', ref: 'Wu & Manber 1994', note: 'Çok desen + blok kayması; yüzlerce desende çok güçlü.' },
  SuffixArraySearch: { group: 'D', algo: 'Suffix array + ikili arama', ref: 'Manber & Myers 1993', note: 'Metni dizinler; çok sayıda sorguda dizin maliyeti amorti olur.' },
  FmIndexSearch: { group: 'D', algo: 'FM-index (BWT)', ref: 'Ferragina & Manzini 2000', note: 'Sıkıştırılmış dizin + geriye doğru arama.' },
};

// ---------------------------------------------------------------- yardımcılar
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = new Intl.NumberFormat('tr-TR');
const num = (x) => nf.format(x);
const nf3 = new Intl.NumberFormat('tr-TR', { maximumSignificantDigits: 3 });
function fmtTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  if (sec < 1e-3) return `${nf3.format(sec * 1e6)} µs`;
  if (sec < 1) return `${nf3.format(sec * 1e3)} ms`;
  return `${nf3.format(sec)} s`;
}
const ratioFmt = (x) => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x)}×`;
const showPattern = (p) => esc(p).replace(/ /g, '<span style="opacity:.45">·</span>').replace(/\t/g, '<span style="opacity:.45">→</span>').replace(/\n/g, '↵');
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

function readPatterns() {
  return el.patterns.value.split(/\r?\n/).filter((p) => p.length > 0);
}

function rng(seed) { // mulberry32: örnek veriler her açılışta aynı olsun
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- örnek veriler
const SAMPLES = {
  gpt2: {
    patterns: ['attention_forward', 'layernorm_forward', 'matmul_forward', 'malloc', 'for (int'],
    load: async () => (await fetchText('tests/data/train_gpt2.c')),
    format: 'text',
  },
  humaneval: {
    patterns: ['return ', 'for ', 'len(', 'sorted('],
    load: async () => (await fetchText('tests/data/humaneval.jsonl')),
    format: 'auto',
  },
  trace: {
    patterns: ['UUDDLRLR', 'LLLLLL', 'UDUDUD', 'RRDD'],
    load: async () => {
      const r = rng(7);
      const A = 'UDLR';
      const lines = [];
      let total = 0;
      while (total < 300000) {
        const len = 200 + Math.floor(r() * 1800);
        let s = '';
        for (let i = 0; i < len; i++) s += A[Math.floor(r() * 4)];
        lines.push(s);
        total += len + 1;
      }
      return lines.join('\n');
    },
    format: 'text',
  },
  hex: {
    patterns: ['deadbeef', 'cafebabe', '89504e47', '7f454c46', '0000'],
    load: async () => {
      const r = rng(42);
      const H = '0123456789abcdef';
      const sigs = ['deadbeef', 'cafebabe', '89504e47', '7f454c46'];
      const lines = [];
      for (let l = 0; l < 3125; l++) {
        let s = '';
        for (let i = 0; i < 64; i++) s += H[Math.floor(r() * 16)];
        if (r() < 0.04) { // ara sıra sihirli bayt imzası göm
          const sig = sigs[Math.floor(r() * sigs.length)];
          const at = Math.floor(r() * 56);
          s = s.slice(0, at) + sig + s.slice(at + 8);
        }
        lines.push(s);
      }
      return lines.join('\n');
    },
    format: 'text',
  },
};

const textCache = new Map();
async function fetchText(path) {
  if (textCache.has(path)) return textCache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} yüklenemedi (${res.status})`);
  const t = await res.text();
  textCache.set(path, t);
  return t;
}

let calibration = null;
async function loadCalibration() {
  try {
    const res = await fetch('src/calibration.json');
    if (res.ok) calibration = await res.json();
  } catch { /* kalibrasyon yoksa atomların varsayılan katsayıları kullanılır */ }
}

// ---------------------------------------------------------------- durum
let state = null; // son arama
let currentSample = null;

function setError(msg) {
  el.error.hidden = !msg;
  el.error.textContent = msg || '';
}

function updatePatternCount() {
  const ps = readPatterns();
  el.patternCount.textContent = `${num(ps.length)} desen`;
}

function updateCorpusInfo() {
  const t = el.corpus.value;
  if (!t) { el.corpusInfo.textContent = '—'; return; }
  const f = el.format.value === 'auto' ? detectFormat(t) : el.format.value;
  el.corpusInfo.textContent = `${num(t.length)} karakter · ${f === 'jsonl' ? 'JSONL' : 'düz metin'}`;
}

function buildCorpus() {
  const t = el.corpus.value;
  const id = currentSample === 'gpt2' ? 'train_gpt2.c' : currentSample ? currentSample : 'metin';
  return parseCorpus(t, { format: el.format.value, id });
}

// ---------------------------------------------------------------- arama
async function run() {
  setError('');
  const patterns = readPatterns();
  if (!patterns.length) { setError('En az bir desen yaz (her satıra bir tane).'); return; }
  let docs;
  try { docs = buildCorpus(); } catch (e) { setError(e.message); return; }
  if (!docs.length) { setError('Metin boş. Bir örnek seç ya da metin yapıştır.'); return; }

  busy(el.runBtn, true, 'Aranıyor…');
  await nextFrame();
  try {
    const ignoreCase = el.ignoreCase.checked;
    const strategy = el.strategy.value;
    const em = new ExactMatch({ patterns, ignoreCase, strategy, calibration });

    const t0 = performance.now();
    em.decide(docs[0]);
    const t1 = performance.now();
    const matches = [];
    for (const d of docs) for (const m of em.atom.process(d)) matches.push(m);
    const t2 = performance.now();

    state = {
      patterns, ignoreCase, strategy, docs, matches, record: em.record,
      decideMs: t1 - t0, searchMs: t2 - t1, em,
    };
    el.raceCard.hidden = true;
    render();
  } catch (e) {
    console.error(e);
    setError(e.message);
  } finally {
    busy(el.runBtn, false);
  }
}

function busy(btn, on, label) {
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>${label}`;
    btn.disabled = true;
  } else if (btn.dataset.label) {
    btn.innerHTML = btn.dataset.label;
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------- çizim
function render() {
  el.empty.hidden = true;
  el.out.hidden = false;
  renderStats();
  renderDecision();
  renderMatches();
}

function renderStats() {
  const { docs, matches, record, decideMs, searchMs } = state;
  const n = docs.reduce((s, d) => s + d.text.length, 0);
  const docsWithHits = new Set(matches.map((m) => m.id)).size;
  el.stats.innerHTML = [
    stat('Eşleşme', num(matches.length), docs.length > 1 ? `${num(docsWithHits)} / ${num(docs.length)} belgede` : `${num(state.patterns.length)} desen`),
    stat('Seçilen atom', record.selected.replace(/Search$/, ''), record.requested === 'auto' ? 'auto (molekül)' : 'elle zorlandı', true),
    stat('Arama süresi', fmtTime(searchMs / 1000), `karar: ${fmtTime(decideMs / 1000)}`),
    stat('Derlem', `${num(n)}`, `karakter · ${num(docs.length)} belge`),
  ].join('');
}
const stat = (k, v, s, mono) => `<div class="stat"><div class="k">${k}</div><div class="v${mono ? ' mono' : ''}" title="${esc(String(v))}">${esc(String(v))}</div><div class="s">${esc(s)}</div></div>`;

function renderDecision() {
  const { record } = state;
  const sh = record.shape;
  el.selectedPill.textContent = record.selected;
  el.decisionSub.textContent = record.requested === 'auto'
    ? 'İlk belgenin şekline bakıp en düşük tahmini maliyetli atomu seçti.'
    : 'Strateji elle seçildi; model ne seçerdi aşağıda.';
  const chips = [
    ['n', num(sh.n)], ['σ', sh.sigma], ['σ_eff', sh.sigmaEff], ['k', num(sh.k)],
    ['m', sh.mMin === sh.mMax ? sh.mMin : `${sh.mMin}…${sh.mMax}`], ['m_ort', sh.mAvg], ['ignoreCase', sh.ignoreCase ? 'evet' : 'hayır'],
  ];
  el.shape.innerHTML = chips.map(([k, v]) => `<span class="chip">${k} = <b>${esc(String(v))}</b></span>`).join('');
  el.why.textContent = record.why;
  drawBars(el.estimates, record.estimates.map((e) => ({
    name: e.atom, value: e.cost, na: e.applicable !== true ? e.applicable : null, sel: e.atom === record.selected,
  })));
}

function drawBars(container, rows) {
  const vals = rows.filter((r) => r.value > 0).map((r) => r.value);
  const lo = Math.log10(Math.min(...vals));
  const hi = Math.log10(Math.max(...vals));
  const span = Math.max(hi - lo, 1e-9);
  container.innerHTML = rows.map((r) => {
    if (r.na) {
      return `<div class="bar-row na" title="${esc(r.na)}"><span class="name">${r.name}</span><span class="track2"></span><span class="val">uygulanamaz</span></div>`;
    }
    const w = 6 + 94 * ((Math.log10(r.value) - lo) / span);
    return `<div class="bar-row${r.sel ? ' sel' : ''}"><span class="name" title="${r.name}">${r.name}</span>` +
      `<span class="track2"><span class="fill" style="width:${w.toFixed(1)}%"></span></span><span class="val">${fmtTime(r.value)}</span></div>`;
  }).join('');
}

// ---------------------------------------------------------------- eşleşmeler
const MAX_VIEW_CHARS = 250000;
const MAX_MARKS = 25000;
let hidden = new Set();
let patIndex = new Map();
let marks = [];
let cur = -1;

function renderMatches() {
  const { matches, patterns, docs } = state;
  hidden = new Set();
  patIndex = new Map();
  patterns.forEach((p, i) => { if (!patIndex.has(p)) patIndex.set(p, i); });

  const perPat = new Map();
  const perDoc = new Map();
  for (const m of matches) {
    perPat.set(m.pattern, (perPat.get(m.pattern) ?? 0) + 1);
    perDoc.set(m.id, (perDoc.get(m.id) ?? 0) + 1);
  }
  el.matchSub.textContent = matches.length
    ? `${num(matches.length)} eşleşme · desene tıklayarak vurgusunu aç/kapat`
    : 'Hiç eşleşme bulunamadı.';

  const uniq = [...patIndex.entries()];
  const sorted = uniq.sort((a, b) => (perPat.get(b[0]) ?? 0) - (perPat.get(a[0]) ?? 0));
  const SHOW = 30;
  el.perPattern.innerHTML = sorted.slice(0, SHOW).map(([p, i]) =>
    `<button type="button" class="pp" data-p="${i}" title="${esc(p)}"><code class="m${i % 8}">${showPattern(p)}</code><span class="c">${num(perPat.get(p) ?? 0)}</span></button>`,
  ).join('') + (sorted.length > SHOW ? `<span class="hint" style="align-self:center">+${num(sorted.length - SHOW)} desen daha</span>` : '');

  // belge seçici
  const opts = [];
  let firstWithHit = null;
  docs.slice(0, 3000).forEach((d, i) => {
    const c = perDoc.get(d.id) ?? 0;
    if (c && firstWithHit === null) firstWithHit = i;
    opts.push(`<option value="${i}">${esc(d.id)} · ${num(c)} eşleşme</option>`);
  });
  el.docSelect.innerHTML = opts.join('');
  el.docSelect.value = String(firstWithHit ?? 0);
  el.docSelect.hidden = docs.length <= 1;
  renderViewer();
  renderRaw();
}

function renderViewer() {
  const { docs, matches } = state;
  const doc = docs[Number(el.docSelect.value) || 0];
  const text = doc.text.length > MAX_VIEW_CHARS ? doc.text.slice(0, MAX_VIEW_CHARS) : doc.text;
  const ms = matches.filter((m) => m.id === doc.id && m.position < text.length && !hidden.has(patIndex.get(m.pattern)));

  // parçalar: [metin, sınıf|null]
  const segs = [];
  let pos = 0;
  let n = 0;
  for (const m of ms) {
    if (n >= MAX_MARKS) break;
    const s = m.position;
    const e = Math.min(text.length, s + m.length);
    if (e <= pos) continue; // tamamen önceki vurgunun içinde
    const i = patIndex.get(m.pattern);
    if (s > pos) segs.push([text.slice(pos, s), null]);
    segs.push([text.slice(Math.max(s, pos), e), `m${i % 8}`, s]);
    pos = e;
    n++;
  }
  if (pos < text.length) segs.push([text.slice(pos), null]);

  const lines = [];
  let line = '';
  let markId = 0;
  for (const [t, cls, start] of segs) {
    const parts = t.split('\n');
    parts.forEach((part, k) => {
      if (k > 0) { lines.push(line); line = ''; }
      if (!part) return;
      line += cls ? `<mark class="${cls}"${k === 0 ? ` data-k="${markId}" data-pos="${start}"` : ''}>${esc(part)}</mark>` : esc(part);
    });
    if (cls) markId++;
  }
  lines.push(line);
  const avg = text.length / lines.length;
  el.viewer.classList.toggle('wrap-txt', avg > 300);
  let html = lines.map((l) => `<span class="ln">${l}</span>`).join('');
  if (doc.text.length > MAX_VIEW_CHARS) html += `<span class="trunc">Görüntü ilk ${num(MAX_VIEW_CHARS)} karakterle sınırlandı (belge ${num(doc.text.length)} karakter).</span>`;
  else if (n >= MAX_MARKS) html += `<span class="trunc">İlk ${num(MAX_MARKS)} eşleşme vurgulandı.</span>`;
  el.viewer.innerHTML = html;
  el.viewer.scrollTop = 0;
  el.viewer.scrollLeft = 0;
  marks = [...el.viewer.querySelectorAll('mark[data-k]')];
  cur = -1;
  if (marks.length) go(0, false);
  else el.hitPos.textContent = '0 / 0';
}

function go(i, scroll = true) {
  if (!marks.length) return;
  if (cur >= 0) marks[cur]?.classList.remove('cur');
  cur = (i + marks.length) % marks.length;
  const m = marks[cur];
  m.classList.add('cur');
  el.hitPos.textContent = `${num(cur + 1)} / ${num(marks.length)} · konum ${num(Number(m.dataset.pos))}`;
  if (scroll) {
    const v = el.viewer;
    const r = m.getBoundingClientRect();
    const vr = v.getBoundingClientRect();
    v.scrollTop += r.top - vr.top - vr.height / 2 + r.height / 2;
    v.scrollLeft += r.left - vr.left - vr.width / 2;
  }
}

function renderRaw() {
  const { matches } = state;
  const LIMIT = 500;
  el.raw.textContent = matches.slice(0, LIMIT).map((m) => JSON.stringify(m)).join('\n') || '(boş)';
  el.rawInfo.textContent = matches.length > LIMIT ? `ilk ${LIMIT} / ${num(matches.length)} satır` : `${num(matches.length)} satır`;
}

// ---------------------------------------------------------------- yarış
async function race() {
  setError('');
  if (!state) await run();
  if (!state) return;
  const { patterns, ignoreCase, docs, record } = state;
  busy(el.raceBtn, true, 'Ölçülüyor…');
  el.raceCard.hidden = false;
  el.raceSub.textContent = 'Her atom aynı girdide çalıştırılıyor…';
  const est = new Map(record.estimates.map((e) => [e.atom, e]));
  const autoPick = record.estimates.find((e) => e.applicable === true)?.atom;
  const rows = registry.list().map((A) => ({ name: A.manifest.name, A, time: null, count: null, hash: null, na: est.get(A.manifest.name)?.applicable !== true ? est.get(A.manifest.name)?.applicable : null }));
  drawRace(rows, autoPick, null);
  el.raceCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    for (const r of rows) {
      await nextFrame();
      if (r.na) continue;
      const once = () => {
        const atom = new r.A({ patterns, ignoreCase });
        let c = 0;
        let h = 2166136261;
        docs.forEach((d, di) => {
          for (const m of atom.process(d)) {
            c++;
            h = Math.imul(h ^ (di * 31 + m.position), 16777619);
            h = Math.imul(h ^ m.pattern.length, 16777619);
          }
        });
        return [c, h >>> 0];
      };
      [r.count, r.hash] = once(); // ısınma
      let reps = 0;
      const start = performance.now();
      let el2 = 0;
      while (reps < 30 && (reps < 3 || el2 < 120)) {
        once();
        reps++;
        el2 = performance.now() - start;
      }
      r.time = el2 / reps / 1000;
      drawRace(rows, autoPick, null);
    }
    const oracle = rows.find((r) => r.name === 'NaiveSearch');
    drawRace(rows, autoPick, oracle);
    const done = rows.filter((r) => r.time != null).sort((a, b) => a.time - b.time);
    const best = done[0];
    const picked = rows.find((r) => r.name === autoPick);
    const ratio = picked?.time && best ? picked.time / best.time : null;
    el.raceSub.innerHTML = best
      ? `Ölçülen en hızlı: <b>${best.name}</b>. Molekülün seçimi <b>${autoPick}</b>` +
        (picked === best ? ' — doğru tahmin ✓' : ` — en hızlıdan ${ratioFmt(ratio)} yavaş`) +
        '. Süreler tarayıcında ölçüldü (ısınma + tekrarların ortalaması).'
      : '';
  } catch (e) {
    console.error(e);
    setError(e.message);
  } finally {
    busy(el.raceBtn, false);
  }
}

function drawRace(rows, autoPick, oracle) {
  const times = rows.filter((r) => r.time != null).map((r) => r.time);
  const best = times.length ? Math.min(...times) : null;
  const worst = times.length ? Math.max(...times) : null;
  const estSorted = state.record.estimates.filter((e) => e.applicable === true).map((e) => e.atom);
  const timeSorted = rows.filter((r) => r.time != null).sort((a, b) => a.time - b.time).map((r) => r.name);
  const ordered = [...rows].sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  el.raceTable.innerHTML = `<thead><tr><th>Atom</th><th>Grup</th><th class="num">Tahmin</th><th class="num">Ölçülen</th><th>Göreli</th><th class="num">Eşleşme</th><th>Doğru</th></tr></thead><tbody>` +
    ordered.map((r) => {
      const e = state.record.estimates.find((x) => x.atom === r.name);
      const isBest = r.time != null && r.time === best;
      const w = r.time != null && worst > best ? 8 + 92 * (Math.log(r.time / best) / Math.log(worst / best)) : 8;
      const rel = r.time != null ? `<span class="mini" style="width:${w.toFixed(0)}px"></span>${ratioFmt(r.time / best)}` : r.na ? '—' : '<span class="spinner" style="width:10px;height:10px"></span>';
      const okCell = oracle && r.time != null ? (r.count === oracle.count && r.hash === oracle.hash ? '<span class="ok">✓ aynı</span>' : '<span class="no">✗ farklı</span>') : '';
      return `<tr class="${isBest ? 'best' : ''} ${r.name === autoPick ? 'pick' : ''}">` +
        `<td class="mono">${r.name}${r.name === autoPick ? '<span class="tag acc">molekül</span>' : ''}${isBest ? '<span class="tag">en hızlı</span>' : ''}</td>` +
        `<td>${ATOM_INFO[r.name]?.group ?? ''}</td>` +
        `<td class="num">${r.na ? 'uygulanamaz' : `${fmtTime(e?.cost)} <span class="hint">#${estSorted.indexOf(r.name) + 1}</span>`}</td>` +
        `<td class="num">${r.time != null ? `${fmtTime(r.time)} <span class="hint">#${timeSorted.indexOf(r.name) + 1}</span>` : '—'}</td>` +
        `<td class="mono">${rel}</td><td class="num">${r.count != null ? num(r.count) : '—'}</td><td>${okCell}</td></tr>`;
    }).join('') + '</tbody>';
}

// ---------------------------------------------------------------- olaylar
async function loadSample(key) {
  const s = SAMPLES[key];
  setError('');
  [...el.samples.children].forEach((b) => b.classList.toggle('active', b.dataset.sample === key));
  try {
    el.corpus.value = 'Yükleniyor…';
    const text = await s.load();
    el.corpus.value = text;
    el.patterns.value = s.patterns.join('\n');
    el.format.value = s.format;
    currentSample = key;
    updatePatternCount();
    updateCorpusInfo();
    await run();
  } catch (e) {
    el.corpus.value = '';
    setError(e.message);
  }
}

el.samples.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-sample]');
  if (b) loadSample(b.dataset.sample);
});
el.patterns.addEventListener('input', updatePatternCount);
el.corpus.addEventListener('input', () => {
  currentSample = null;
  [...el.samples.children].forEach((b) => b.classList.remove('active'));
  updateCorpusInfo();
});
el.format.addEventListener('change', updateCorpusInfo);
el.file.addEventListener('change', async () => {
  const f = el.file.files[0];
  if (!f) return;
  if (f.size > 20 * 1024 * 1024) { setError('Dosya 20 MB’tan büyük; tarayıcıda yavaş olur.'); return; }
  el.corpus.value = await f.text();
  currentSample = null;
  [...el.samples.children].forEach((b) => b.classList.remove('active'));
  el.format.value = f.name.endsWith('.jsonl') ? 'jsonl' : 'auto';
  updateCorpusInfo();
  el.file.value = '';
});
el.runBtn.addEventListener('click', run);
el.raceBtn.addEventListener('click', race);
el.docSelect.addEventListener('change', renderViewer);
el.prevHit.addEventListener('click', () => go(cur - 1));
el.nextHit.addEventListener('click', () => go(cur + 1));
el.perPattern.addEventListener('click', (ev) => {
  const b = ev.target.closest('.pp');
  if (!b) return;
  const i = Number(b.dataset.p);
  if (hidden.has(i)) hidden.delete(i); else hidden.add(i);
  b.classList.toggle('off', hidden.has(i));
  renderViewer();
});
el.download.addEventListener('click', () => {
  if (!state) return;
  const blob = new Blob([state.matches.map((m) => JSON.stringify(m)).join('\n') + '\n'], { type: 'application/x-ndjson' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'eslesmeler.jsonl';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
document.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); run(); }
});

// ---------------------------------------------------------------- başlangıç
function initStatic() {
  el.strategy.innerHTML = '<option value="auto">auto · molekül seçsin</option>' +
    registry.names().map((n) => `<option value="${n}">${n}</option>`).join('');
  el.atomTable.innerHTML = '<thead><tr><th>Atom</th><th>Grup</th><th>Algoritma</th><th>Kaynak</th><th>Ne zaman iyi?</th></tr></thead><tbody>' +
    registry.names().map((n) => {
      const a = ATOM_INFO[n] ?? {};
      return `<tr><td>${n}</td><td>${a.group ?? ''}</td><td>${esc(a.algo ?? '')}</td><td>${esc(a.ref ?? '')}</td><td>${esc(a.note ?? '')}</td></tr>`;
    }).join('') + '</tbody>';
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) el.runBtn.querySelector('kbd').textContent = 'Ctrl↵';
}

initStatic();
await loadCalibration();
loadSample('gpt2');

// computeShape dışa açık: tarayıcı konsolundan denemek isteyenler için
window.desen = { ExactMatch, registry, parseCorpus, computeShape };
