// Shift-Or (Baeza-Yates & Gonnet 1992): bit paralel tam eşleştirme.
// Durum D'nin j. biti 0 ise desenin ilk j+1 karakteri metnin son j+1 karakterine eşittir.
// Her metin karakteri için tek kaydırma + VEYA işlemi: Θ(n), alfabe ve desenden bağımsız.
//
// Makaleden ayrılma: JavaScript'te bit işlemleri 32 bittir, bu yüzden m ≤ 32 doğrudan desteklenir.
// m > 32 için desenin ilk 32 karakteri filtre olarak aranır ve her aday kalan karakterlerle
// doğrulanır (hiçbir eşleşme kaçmaz; yalnızca doğrulama maliyeti eklenir).

import { encodePattern } from './alphabet.js';

export const WORD = 32;

export function prepareShiftOr(pattern, alphabet) {
  const m = pattern.length;
  const x = encodePattern(pattern, alphabet);
  const w = m < WORD ? m : WORD;
  const masks = new Int32Array(alphabet.size).fill(-1);
  for (let i = 0; i < w; i++) masks[x[i]] &= ~(1 << i);
  return { m, w, x, masks, hi: 1 << (w - 1) };
}

/** Metin dizgisi üzerinde doğrudan çalışır; maske alfabe haritasıyla (map) bulunur. */
export function searchShiftOr(text, map, prep, uid, hits) {
  const { m, w, x, masks, hi } = prep;
  const n = text.length;
  if (m > n) return;
  let D = -1;
  if (m === w) {
    for (let i = 0; i < n; i++) {
      D = (D << 1) | masks[map[text.charCodeAt(i)]];
      if ((D & hi) === 0) hits.add(i - m + 1, uid);
    }
    return;
  }
  // m > 32: ilk 32 karakter filtre, gerisi doğrulama
  const last = n - m + w - 1; // filtre eşleşmesinin bitebileceği en son indeks
  for (let i = 0; i <= last; i++) {
    D = (D << 1) | masks[map[text.charCodeAt(i)]];
    if ((D & hi) === 0) {
      const start = i - w + 1;
      let k = w;
      while (k < m && map[text.charCodeAt(start + k)] === x[k]) k++;
      if (k === m) hits.add(start, uid);
    }
  }
}
