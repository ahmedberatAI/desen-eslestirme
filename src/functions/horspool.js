// Horspool (1980): yalnızca kötü karakter kayması. Pencerenin son karakteri tabloya bakılarak
// kaydırılır; son karakter eşleşirse pencerenin geri kalanı soldan sağa doğrulanır.
// Ortalama O(n/σ) civarı, en kötü durum O(n·m).

import { encodePattern } from './alphabet.js';

export function prepareHorspool(pattern, alphabet) {
  const m = pattern.length;
  const x = encodePattern(pattern, alphabet);
  const shift = new Int32Array(alphabet.size).fill(m);
  for (let i = 0; i < m - 1; i++) shift[x[i]] = m - 1 - i;
  return { m, x, shift, last: x[m - 1] };
}

export function searchHorspool(text, map, prep, uid, hits) {
  const { m, x, shift, last } = prep;
  const n = text.length;
  const end = n - m;
  let j = 0;
  while (j <= end) {
    const c = map[text.charCodeAt(j + m - 1)];
    if (c === last) {
      let i = 0;
      while (i < m - 1 && x[i] === map[text.charCodeAt(j + i)]) i++;
      if (i === m - 1) hits.add(j, uid);
    }
    j += shift[c];
  }
}
