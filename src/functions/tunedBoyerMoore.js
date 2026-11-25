// Tuned Boyer-Moore (Hume & Sunday 1991, "UFAST"): kısa desenler için ayarlanmış Boyer-Moore.
//  - skip[c] = m-1-(c'nin desendeki son konumu), son karakter dahil; yani skip[son karakter] = 0.
//  - Ana döngü karşılaştırma yapmadan yalnızca atlar; döngü 3 kez açılmıştır (unrolled).
//  - Metnin sonuna desenin kendisi sentinel olarak eklenir; böylece döngü içinde sınır kontrolü
//    gerekmez: atlama döngüsü en geç sentinelin son karakterinde (skip = 0) durur.
//  - skip = 0 olduğunda pencerenin geri kalanı doğrulanır, sonra md2 kadar kaydırılır.
//    md2 = son karakterin desende (son konum hariç) sağdan ilk geçişine uzaklık (yoksa m).
//
// Klasik tariften ayrılmalar / notlar:
//  - C'de sentinel, metin tamponunun sonuna yazılır. JavaScript dizgileri değiştirilemediği için
//    metin küçültülmüş alfabeyle bir tipli diziye kopyalanır. Bu kopya bir kez yapılır ve bütün
//    desenler için paylaşılır (atom sınıfında).
//  - Atlama döngüsü her açılımda i'yi en fazla m kadar ilerletir ve sentinel bölgesinde
//    i + skip[t[i]] ≤ n+m-1 olduğu kanıtlanabilir; bu yüzden dizi sınırı aşılmaz.
//  - Doğrulama, eşleşmeden sonra kaymanın md2 ile yapılması sayesinde örtüşen eşleşmeleri kaçırmaz
//    (md2, son karakterin bir önceki geçişine göre güvenli en küçük kaymadır).

import { encodePattern } from './alphabet.js';

export function prepareTunedBM(pattern, alphabet) {
  const m = pattern.length;
  const x = encodePattern(pattern, alphabet);
  const skip = new Int32Array(alphabet.size).fill(m);
  for (let i = 0; i < m; i++) skip[x[i]] = m - 1 - i;
  let md2 = m;
  for (let i = m - 2; i >= 0; i--) {
    if (x[i] === x[m - 1]) {
      md2 = m - 1 - i;
      break;
    }
  }
  return { m, x, skip, md2 };
}

/**
 * `t`: kodlanmış metin, uzunluğu en az n + m (son m hücre sentinel için boş).
 * Fonksiyon sentinel'i kendisi yazar.
 */
export function searchTunedBM(t, n, prep, uid, hits) {
  const { m, x, skip, md2 } = prep;
  if (m > n) return;
  for (let r = 0; r < m; r++) t[n + r] = x[r];
  const m1 = m - 1;
  let i = m1;
  for (;;) {
    let k = skip[t[i]];
    while (k !== 0) {
      i += k;
      i += skip[t[i]];
      i += skip[t[i]];
      k = skip[t[i]];
    }
    if (i >= n) break; // sentinele ulaşıldı
    const start = i - m1;
    let q = 0;
    while (q < m1 && t[start + q] === x[q]) q++;
    if (q === m1) hits.add(start, uid);
    i += md2;
  }
}
