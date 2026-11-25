// HASHq (Lecroq 2007; Wu & Manber 1994): uzun desenler için q-gram özetli Horspool.
// Pencerenin son q karakteri (q-gram) özetlenir ve kayma, q-gramın desende sağdan en yakın
// geçişine göre yapılır. Küçük alfabelerde (ör. ikili bit dizileri, 4 eylemli ajan izleri) tek
// karakterlik kayma ortalama ~σ ile sınırlıyken q-gram kayması m - q + 1'e yaklaşır.
//
// Dikkat edilen noktalar ve tariften ayrılmalar:
//  1. Desende HİÇ geçmeyen bir q-gram için güvenli kayma m DEĞİL, m - q + 1'dir (Lecroq'un
//     tablosu da böyle başlar). Pencerenin son q-gramı desende yoksa bile, desenin bir sonraki
//     konumda başlangıcı bu q-gramın son q-1 karakteriyle örtüşebilir; m kadar kaydırmak bu
//     eşleşmeleri atlar. Örnek: desen "abc" (q = 2), metin "xyabc". İlk pencere "xya", son 2-gram
//     "ya" desende yok. m = 3 kaydırılırsa pencere metnin dışına çıkar ve 2. konumdaki "abc"
//     kaçırılır; m - q + 1 = 2 kaydırılırsa bulunur. (Bu hata, q-gram kaymasını "Horspool'daki
//     gibi m" diye uyarlayan sözde kodlarda sık görülür; birim testinde karşı örnek olarak var.)
//  2. Son q-gram (shift = 0) için doğrulama yapıldıktan sonra kaydırma 1 değil, aynı q-gramın
//     desende bir önceki geçişine göre (yoksa m - q + 1) yapılır.
//  3. q, desen alfabesine ve m'ye göre seçilir: (σp)^q ≥ 2m olacak en küçük q (q ≤ m, q ≤ 8,
//     tablo ≤ 2^20 hücre). Özet, Lecroq'taki çakışabilen karma yerine küçültülmüş alfabede
//     q-gramın tam kodlamasıdır (çakışmasız), bu yüzden kaymalar gereksiz yere küçülmez.

import { encodePattern } from './alphabet.js';

const MAX_TABLE = 1 << 20;

/** q seçimi (maliyet modeli de aynı fonksiyonu kullanır). A = küçültülmüş alfabe (σp + 1). */
export function chooseQ(m, A) {
  const sp = Math.max(2, A - 1);
  let q = 1;
  while (q < m && q < 8 && Math.pow(A, q + 1) <= MAX_TABLE && Math.pow(sp, q) < 2 * m) q++;
  return q;
}

export function prepareHashQ(pattern, alphabet) {
  const m = pattern.length;
  const A = alphabet.size;
  const x = encodePattern(pattern, alphabet);
  const q = chooseQ(m, A);
  const def = m - q + 1;
  const shift = new Int32Array(Math.pow(A, q)).fill(def);
  for (let j = q - 1; j < m - 1; j++) {
    let h = 0;
    for (let r = j - q + 1; r <= j; r++) h = h * A + x[r];
    shift[h] = m - 1 - j; // sağa doğru ilerlerken en yakın geçiş kalır
  }
  let hl = 0;
  for (let r = m - q; r < m; r++) hl = hl * A + x[r];
  const after = shift[hl]; // son q-gramın bir önceki geçişine uzaklık (yoksa m - q + 1)
  shift[hl] = 0;
  return { m, q, A, x, shift, after };
}

/**
 * Metin dizgisi üzerinde doğrudan çalışır; q-gram özeti küçültülmüş alfabe haritasıyla (map)
 * anında hesaplanır, böylece metnin tamamını kodlamak (O(n) kopya) gerekmez.
 */
export function searchHashQ(text, map, prep, uid, hits) {
  const { m, q, A, x, shift, after } = prep;
  const n = text.length;
  if (m > n) return;
  let i = m - 1;
  const q1 = q - 1;
  const lim = m - q;
  while (i < n) {
    let h = 0;
    for (let r = i - q1; r <= i; r++) h = h * A + map[text.charCodeAt(r)];
    const s = shift[h];
    if (s !== 0) {
      i += s;
      continue;
    }
    const start = i - m + 1;
    let r = 0;
    while (r < lim && map[text.charCodeAt(start + r)] === x[r]) r++;
    if (r === lim) hits.add(start, uid);
    i += after;
  }
}
