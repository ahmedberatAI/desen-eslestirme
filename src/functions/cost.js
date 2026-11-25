// Maliyet modeli için ortak beklenen-değer formülleri (saf fonksiyonlar).
//
// Varsayım: metin, etkin alfabe büyüklüğü s = σ_eff olan bağımsız ve eşit dağılımlı
// karakterlerden oluşur; desen karakterleri de aynı dağılımdan gelir. Gerçek veride bu
// varsayım bozulur (bkz. raporda "Sınırlar"), ama sıralama için çoğu zaman yeterlidir.

/**
 * Kötü karakter / blok kaymasının beklenen değeri.
 * L uzunluğunda kayma penceresi, sB büyüklüğünde blok alfabesi ve k desen için
 * P(kayma >= d) = (1 - 1/sB)^(k(d-1)) olduğundan E = Σ_{d=1}^{L} a^(d-1), a = (1-1/sB)^k.
 */
export function expectedShift(L, sB, k = 1) {
  if (L <= 1) return 1;
  if (sB <= 1) return 1;
  const a = Math.pow(1 - 1 / sB, k);
  if (a <= 0) return 1;
  if (a >= 1) return L;
  return (1 - Math.pow(a, L)) / (1 - a);
}

/** Bir hizalamada beklenen karakter karşılaştırma sayısı: Σ_{j=0}^{m-1} (1/s)^j. */
export function expectedComparisons(m, s) {
  if (s <= 1) return m;
  const r = 1 / s;
  return (1 - Math.pow(r, m)) / (1 - r);
}

export const log2 = (x) => Math.log2(Math.max(2, x));

/** Uzunluk histogramı üzerinde toplam: Σ count * f(m). */
export function sumOverLengths(shape, f) {
  let total = 0;
  for (const [m, count] of shape.lengths) total += count * f(m);
  return total;
}
