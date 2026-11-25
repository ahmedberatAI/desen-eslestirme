// Alfabe yardımcıları: ASCII büyük/küçük harf katlama ve alfabe küçültme.
//
// Alfabe küçültme: desenlerde geçen her UTF-16 kod birimine 1..σp arasında küçük bir
// kod verilir; desenlerde hiç geçmeyen bütün karakterler 0 ("diğer") sınıfına düşer.
// Böylece kayma tabloları 65 536 yerine σp+1 elemanlı olur ve önbellekte kalır.

/** Yalnızca ASCII a–z harflerini A–Z'ye çevirir (sözleşme 4.2: ignoreCase). */
export function foldAscii(str) {
  const n = str.length;
  let i = 0;
  for (; i < n; i++) {
    const c = str.charCodeAt(i);
    if (c >= 97 && c <= 122) break;
  }
  if (i === n) return str; // küçük ASCII harf yok: kopyalamadan dön
  const CHUNK = 8192;
  const buf = new Uint16Array(Math.min(CHUNK, n));
  let out = str.slice(0, i);
  for (let s = i; s < n; s += CHUNK) {
    const e = Math.min(n, s + CHUNK);
    for (let j = s; j < e; j++) {
      const c = str.charCodeAt(j);
      buf[j - s] = c >= 97 && c <= 122 ? c - 32 : c;
    }
    out += String.fromCharCode.apply(null, e - s === buf.length ? buf : buf.subarray(0, e - s));
  }
  return out;
}

/**
 * Desen kümesinden küçültülmüş alfabe kurar.
 * @returns {{ map: Uint16Array, size: number, symbols: number[] }}
 *   map[c] = c karakterinin kodu (0 = desenlerde yok), size = σp + 1.
 */
export function buildAlphabet(strings) {
  const map = new Uint16Array(65536);
  const symbols = [];
  for (const s of strings) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (map[c] === 0) {
        symbols.push(c);
        map[c] = symbols.length;
      }
    }
  }
  return { map, size: symbols.length + 1, symbols };
}

/**
 * Metni küçültülmüş kodlara çevirir. `extra` kadar boş yer sonda bırakılır (sentinel için).
 * Kod sayısı 255'ten azsa Uint8Array, değilse Uint16Array kullanılır.
 */
export function encodeText(text, alphabet, extra = 0) {
  const n = text.length;
  const out = alphabet.size <= 256 ? new Uint8Array(n + extra) : new Uint16Array(n + extra);
  const map = alphabet.map;
  for (let i = 0; i < n; i++) out[i] = map[text.charCodeAt(i)];
  return out;
}

/** Bir dizgiyi verilen alfabeyle kod dizisine çevirir (desenler için). */
export function encodePattern(p, alphabet) {
  const out = new Int32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = alphabet.map[p.charCodeAt(i)];
  return out;
}

/**
 * Metin alfabesi istatistikleri: ayrık karakter sayısı (σ) ve etkin alfabe büyüklüğü
 * σ_eff = 1 / Σ p_c² (rastgele iki karakterin eşit olma olasılığının tersi).
 * Uzun metinlerde yalnızca ilk `limit` karakter örneklenir.
 */
export function alphabetStats(text, limit = 1 << 17) {
  const n = Math.min(text.length, limit);
  if (n === 0) return { sigma: 0, sigmaEff: 1 };
  const counts = new Map();
  const small = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c < 256) small[c]++;
    else counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let sigma = counts.size;
  let sumSq = 0;
  for (let c = 0; c < 256; c++) {
    if (small[c]) {
      sigma++;
      const p = small[c] / n;
      sumSq += p * p;
    }
  }
  for (const v of counts.values()) {
    const p = v / n;
    sumSq += p * p;
  }
  return { sigma, sigmaEff: 1 / sumSq };
}
