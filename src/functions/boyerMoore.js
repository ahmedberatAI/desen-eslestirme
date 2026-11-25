// Boyer-Moore (1977): kötü karakter + iyi sonek kuralları.
// Ön işleme Charras & Lecroq'taki preBmBc / suffixes / preBmGs düzenini izler; kötü karakter
// tablosu küçültülmüş alfabe (desen alfabesi + "diğer") üzerinde tutulur.

import { encodePattern } from './alphabet.js';

export function prepareBoyerMoore(pattern, alphabet) {
  const m = pattern.length;
  const x = encodePattern(pattern, alphabet);
  const bc = new Int32Array(alphabet.size).fill(m);
  for (let i = 0; i < m - 1; i++) bc[x[i]] = m - 1 - i;

  // suffixes: suff[i] = x[0..i] ile x'in ortak en uzun soneki
  const suff = new Int32Array(m);
  suff[m - 1] = m;
  let g = m - 1;
  let f = 0;
  for (let i = m - 2; i >= 0; i--) {
    if (i > g && suff[i + m - 1 - f] < i - g) suff[i] = suff[i + m - 1 - f];
    else {
      if (i < g) g = i;
      f = i;
      while (g >= 0 && x[g] === x[g + m - 1 - f]) g--;
      suff[i] = f - g;
    }
  }
  const gs = new Int32Array(m).fill(m);
  let j = 0;
  for (let i = m - 1; i >= 0; i--) {
    if (suff[i] === i + 1) {
      for (; j < m - 1 - i; j++) if (gs[j] === m) gs[j] = m - 1 - i;
    }
  }
  for (let i = 0; i <= m - 2; i++) gs[m - 1 - suff[i]] = m - 1 - i;
  return { m, x, bc, gs };
}

export function searchBoyerMoore(text, map, prep, uid, hits) {
  const { m, x, bc, gs } = prep;
  const n = text.length;
  let j = 0;
  while (j <= n - m) {
    let i = m - 1;
    while (i >= 0 && x[i] === map[text.charCodeAt(i + j)]) i--;
    if (i < 0) {
      hits.add(j, uid);
      j += gs[0];
    } else {
      const s = bc[map[text.charCodeAt(i + j)]] - m + 1 + i;
      j += gs[i] > s ? gs[i] : s;
    }
  }
}
