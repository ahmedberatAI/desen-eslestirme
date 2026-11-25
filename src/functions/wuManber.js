// Wu-Manber (1994): çok desenli blok kayması.
//
// Bütün desenlerin ilk L = mMin karakteri bir "pencere" gibi düşünülür. Metinde L uzunluklu
// pencerenin son B karakteri (blok) özetlenir:
//   SHIFT[h] = bloğun herhangi bir desen önekinde (ilk L karakter) sağdan en yakın geçişine uzaklık;
//              hiçbir önekte yoksa L - B + 1.
//   SHIFT[h] = 0 ise HASH[h] kovasındaki (önekinin son bloğu h olan) desenler tam olarak doğrulanır.
//
// Makaleden ayrılmalar:
//  - Özet, küçültülmüş alfabede bloğun tam kodlamasıdır (Σ kod·A^i), dolayısıyla SHIFT tablosunda
//    çakışma yoktur. Tablo 2^20 hücreyi aşacaksa B küçültülür. Makaledeki PREFIX tablosu yoktur;
//    bunun yerine kovadaki adaylar doğrudan karşılaştırılır.
//  - B, makaledeki öneriye uygun olarak A^B ≥ 2·k·L olacak şekilde seçilir (en az 1, en çok L ve 8).

import { encodePattern } from './alphabet.js';

const MAX_TABLE = 1 << 20;

/** Blok uzunluğu seçimi (maliyet modeli de aynı fonksiyonu kullanır). */
export function chooseBlock(L, A, k) {
  let B = 1;
  while (B < L && B < 8 && Math.pow(A, B + 1) <= MAX_TABLE && Math.pow(A, B) < 2 * k * L) B++;
  return B;
}

export function prepareWuManber(patterns, alphabet) {
  const A = alphabet.size;
  let L = Infinity;
  for (const p of patterns) if (p.length < L) L = p.length;
  const k = patterns.length;
  const B = chooseBlock(L, A, k);
  const size = Math.pow(A, B);
  const def = L - B + 1;
  const shift = new Int32Array(size).fill(def);
  const codes = patterns.map((p) => encodePattern(p, alphabet));
  // kova: önekinin son bloğu h olan desenler (bağlı liste)
  const head = new Int32Array(size).fill(-1);
  const next = new Int32Array(k).fill(-1);
  for (let uid = k - 1; uid >= 0; uid--) {
    const x = codes[uid];
    for (let j = B - 1; j < L; j++) {
      let h = 0;
      for (let r = j - B + 1; r <= j; r++) h = h * A + x[r];
      const s = L - 1 - j;
      if (s < shift[h]) shift[h] = s;
      if (j === L - 1) {
        next[uid] = head[h];
        head[h] = uid;
      }
    }
  }
  return { A, B, L, shift, head, next, codes, lengths: patterns.map((p) => p.length) };
}

/** Metin dizgisi üzerinde doğrudan çalışır; blok özeti alfabe haritasıyla anında hesaplanır. */
export function searchWuManber(text, map, prep, hits) {
  const { A, B, L, shift, head, next, codes, lengths } = prep;
  const n = text.length;
  if (L > n) return;
  let i = L - 1; // pencerenin son karakteri
  while (i < n) {
    let h = 0;
    for (let r = i - B + 1; r <= i; r++) h = h * A + map[text.charCodeAt(r)];
    const s = shift[h];
    if (s !== 0) {
      i += s;
      continue;
    }
    const start = i - L + 1;
    for (let uid = head[h]; uid !== -1; uid = next[uid]) {
      const m = lengths[uid];
      if (start + m > n) continue;
      const x = codes[uid];
      let q = 0;
      while (q < m && map[text.charCodeAt(start + q)] === x[q]) q++;
      if (q === m) hits.add(start, uid);
    }
    i += 1;
  }
}
