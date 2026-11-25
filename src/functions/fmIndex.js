// FM-index (Ferragina & Manzini 2000): BWT + geriye doğru arama (backward search).
//
// İnşa: önce sonek dizisi (suffixArray.js), sonra T$ için BWT, C tablosu ve her 64 satırda bir
// Occ kontrol noktaları. Sorgu: desen sağdan sola işlenir, her karakter için iki Occ sorgusu;
// O(m) adımda [sp, ep) satır aralığı bulunur. Konumlar sonek dizisinden okunur.
//
// Makaleden ayrılmalar:
//  - Sonek dizisinin tamamı saklanır (örneklenmiş SA + LF yürüyüşü yerine). Bu proje boyutlarında
//    (n ≤ ~10^7) bellek sorun değildir ve konum bulma O(1) olur. Sıkıştırma (wavelet tree, RLE)
//    yapılmamıştır; amaç sıkıştırma değil, çok sayıda desende hızlı sorgudur.
//  - Occ kontrol noktası aralığı 64'tür; ara sayımlar BWT üzerinde doğrusal taranır.

import { compressText, buildSuffixArray, encodeForText } from './suffixArray.js';

const STEP = 64;

export function buildFmIndex(text) {
  const { codes, sigma, rankOf } = compressText(text);
  const n = codes.length;
  const sa = buildSuffixArray(codes, sigma);
  const rows = n + 1; // T$ satırları: satır 0 = "$" soneki, satır r>0 = sa[r-1]
  const S = sigma + 1; // 0 = $
  const bwt = sigma < 255 ? new Uint8Array(rows) : new Uint16Array(rows);
  bwt[0] = n > 0 ? codes[n - 1] : 0;
  for (let r = 1; r < rows; r++) {
    const pos = sa[r - 1];
    bwt[r] = pos > 0 ? codes[pos - 1] : 0;
  }
  const C = new Int32Array(S + 1);
  for (let r = 0; r < rows; r++) C[bwt[r] + 1]++;
  for (let c = 1; c <= S; c++) C[c] += C[c - 1];
  const blocks = Math.floor(rows / STEP) + 1;
  const occ = new Int32Array(blocks * S);
  const run = new Int32Array(S);
  for (let r = 0; r < rows; r++) {
    if (r % STEP === 0) occ.set(run, (r / STEP) * S);
    run[bwt[r]]++;
  }
  if (rows % STEP === 0) occ.set(run, (rows / STEP) * S);
  return { n, S, sa, bwt, C, occ, rankOf };
}

/** bwt[0..r) içindeki c sayısı */
function rankC(fm, c, r) {
  const b = (r / STEP) | 0;
  let count = fm.occ[b * fm.S + c];
  const bwt = fm.bwt;
  for (let i = b * STEP; i < r; i++) if (bwt[i] === c) count++;
  return count;
}

/** Desenin geçtiği satır aralığı [sp, ep); yoksa sp >= ep. */
export function fmRange(fm, p) {
  let sp = 0;
  let ep = fm.n + 1;
  for (let i = p.length - 1; i >= 0 && sp < ep; i--) {
    const c = p[i];
    sp = fm.C[c] + rankC(fm, c, sp);
    ep = fm.C[c] + rankC(fm, c, ep);
  }
  return [sp, ep];
}

/** Deseni arar ve bütün konumları hits'e ekler. */
export function searchFm(fm, pattern, uid, hits) {
  if (pattern.length > fm.n) return;
  const p = encodeForText(pattern, fm.rankOf);
  if (p === null) return;
  const [sp, ep] = fmRange(fm, p);
  for (let r = sp; r < ep; r++) hits.add(fm.sa[r - 1], uid);
}
