// Suffix array (Manber & Myers 1993) + ikili arama.
//
// İnşa: önek ikiye katlama (prefix doubling). Her turda (rank[i], rank[i+k]) çiftine göre iki
// aşamalı kararlı sayma sıralaması yapılır; O(n log n). Bir sonekin sonu "en küçük" kabul edilir
// (kısa sonek, aynı önekli uzun sonekten önce gelir), bu da T$ sıralamasıyla aynıdır.
// Sorgu: her desen için alt ve üst sınır ikili aramaları, O(m log n); eşleşmeler SA[lo..hi).

/** Metni 1..σ arası sıralı kodlara çevirir. Dönüş: { codes, sigma, rankOf } */
export function compressText(text) {
  const n = text.length;
  const seen = new Uint8Array(65536);
  for (let i = 0; i < n; i++) seen[text.charCodeAt(i)] = 1;
  const rankOf = new Int32Array(65536);
  let sigma = 0;
  for (let c = 0; c < 65536; c++) if (seen[c]) rankOf[c] = ++sigma;
  const codes = sigma < 255 ? new Uint8Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) codes[i] = rankOf[text.charCodeAt(i)];
  return { codes, sigma, rankOf };
}

/** Sonek dizisi (önek ikiye katlama + sayma sıralaması). codes: 1..sigma. */
export function buildSuffixArray(codes, sigma) {
  const n = codes.length;
  const sa = new Int32Array(n);
  if (n === 0) return sa;
  let rank = new Int32Array(n);
  let tmp = new Int32Array(n);
  // 1. tur: tek karaktere göre sayma sıralaması
  let cnt = new Int32Array(Math.max(sigma + 1, n) + 1);
  for (let i = 0; i < n; i++) cnt[codes[i]]++;
  for (let c = 1; c <= sigma; c++) cnt[c] += cnt[c - 1];
  for (let i = n - 1; i >= 0; i--) sa[--cnt[codes[i]]] = i;
  let classes = 1;
  rank[sa[0]] = 0;
  for (let j = 1; j < n; j++) {
    if (codes[sa[j]] !== codes[sa[j - 1]]) classes++;
    rank[sa[j]] = classes - 1;
  }
  for (let k = 1; classes < n; k <<= 1) {
    // ikinci anahtara göre sıra: i+k >= n olanlar önce (boş = en küçük), sonra sa sırasıyla
    let p = 0;
    for (let i = n - k; i < n; i++) tmp[p++] = i;
    for (let j = 0; j < n; j++) if (sa[j] >= k) tmp[p++] = sa[j] - k;
    // birinci anahtara (rank) göre kararlı sayma sıralaması
    cnt.fill(0, 0, classes + 1);
    for (let i = 0; i < n; i++) cnt[rank[i]]++;
    for (let c = 1; c < classes; c++) cnt[c] += cnt[c - 1];
    for (let j = n - 1; j >= 0; j--) {
      const i = tmp[j];
      sa[--cnt[rank[i]]] = i;
    }
    // yeni sınıflar
    tmp[sa[0]] = 0;
    classes = 1;
    for (let j = 1; j < n; j++) {
      const a = sa[j];
      const b = sa[j - 1];
      const ra = a + k < n ? rank[a + k] : -1;
      const rb = b + k < n ? rank[b + k] : -1;
      if (rank[a] !== rank[b] || ra !== rb) classes++;
      tmp[a] = classes - 1;
    }
    const sw = rank;
    rank = tmp;
    tmp = sw;
  }
  cnt = null;
  return sa;
}

/** codes[pos..] ile desen p (kodlanmış) karşılaştırması: <0, 0 (p önek), >0 */
function compareAt(codes, n, pos, p) {
  const m = p.length;
  for (let i = 0; i < m; i++) {
    if (pos + i >= n) return -1; // sonek bitti: sonek < desen
    const d = codes[pos + i] - p[i];
    if (d !== 0) return d;
  }
  return 0;
}

/** Kodlanmış desenin geçtiği SA aralığı [lo, hi). */
export function saRange(codes, sa, p) {
  const n = codes.length;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareAt(codes, n, sa[mid], p) < 0) lo = mid + 1;
    else hi = mid;
  }
  const start = lo;
  hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compareAt(codes, n, sa[mid], p) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return [start, lo];
}

/** Deseni metin kodlarına çevirir; metinde olmayan karakter varsa null. */
export function encodeForText(pattern, rankOf) {
  const p = new Int32Array(pattern.length);
  for (let i = 0; i < pattern.length; i++) {
    const r = rankOf[pattern.charCodeAt(i)];
    if (r === 0) return null;
    p[i] = r;
  }
  return p;
}
