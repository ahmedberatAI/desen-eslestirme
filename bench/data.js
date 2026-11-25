// Tohumlu sentetik veri üretici. Aynı tohum her zaman aynı veriyi üretir.

/** mulberry32: küçük, hızlı, tohumlu 32 bit PRNG. [0,1) döndürür. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // [lo, hi]

// Kaynak kod karakter frekansları (%): tests/data/ altındaki gerçek kod derleminden (HumanEval
// Python çözümleri + llm.c train_gpt2.c, 154 240 karakter) sayıldı; yazdırılabilir ASCII + satır sonu,
// azalan sırada. Boşluk baskın (girinti), bu yüzden σ = 94 iken σ_eff ≈ 10,5.
const CODE = " etnraiso\nldfu,mhcp_)(\"=gb1.:*>-'[w]v20y;/x+T3kCz45BFLN<E{}qjOAI67SRGV%&89YUPH#!MD\\W|?^KXJ@Z`Q";
const CODE_FREQ = [
  27.513, 5.869, 5.085, 3.893, 3.884, 3.83, 3.804, 3.55, 3.163, 2.945, 2.663, 1.827,
  1.666, 1.653, 1.558, 1.511, 1.4, 1.371, 1.29, 1.227, 1.17, 1.168, 1.095, 1.021,
  0.976, 0.867, 0.715, 0.661, 0.621, 0.613, 0.6, 0.571, 0.556, 0.556, 0.554, 0.553,
  0.528, 0.521, 0.514, 0.482, 0.48, 0.467, 0.432, 0.405, 0.371, 0.3, 0.289, 0.264,
  0.205, 0.195, 0.172, 0.156, 0.143, 0.141, 0.13, 0.124, 0.11, 0.105, 0.105, 0.098,
  0.097, 0.09, 0.082, 0.074, 0.068, 0.062, 0.061, 0.053, 0.052, 0.052, 0.051, 0.048,
  0.048, 0.047, 0.044, 0.043, 0.038, 0.037, 0.032, 0.03, 0.029, 0.018, 0.017, 0.014,
  0.012, 0.008, 0.008, 0.007, 0.006, 0.005, 0.005, 0.002, 0.002, 0.001,
];
// Kalibrasyonda kullanılmayan, BMP içinden 62 karakterlik çok dilli alfabe (Türkçe + Yunanca harfler):
// çok dilli LLM istemleri/çıktıları için kaba bir vekil.
const UNI = 'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZαβγδ';

// Yazılım / yapay zekâ verisini temsil eden alfabeler. İlk üçü kalibrasyonda, son ikisi yalnızca
// doğrulamada (görülmemiş alfabe) kullanılır.
export const ALPHABETS = {
  actions: { symbols: 'UDLR', weights: null }, // RL ajan eylem izleri (yukarı/aşağı/sol/sağ), σ = 4
  hex: { symbols: '0123456789abcdef', weights: null }, // özet/ikili döküm (SHA, sihirli baytlar), σ = 16
  code: { symbols: CODE, weights: CODE_FREQ }, // kaynak kod, σ = 94, dengesiz dağılım
  binary: { symbols: '01', weights: null }, // bit dizileri, σ = 2
  unicode: { symbols: UNI, weights: null }, // çok dilli metin, σ = 62
};

/** Rapor ve şekillerde kullanılan okunaklı adlar. */
export const ALPHABET_LABELS = {
  actions: 'eylem izi (σ=4)',
  hex: 'hex döküm (σ=16)',
  code: 'kaynak kod (σ=94)',
  binary: 'ikili (σ=2)',
  unicode: 'çok dilli (σ=62)',
  gpt2: 'train_gpt2.c',
  gpt2x4: '4×train_gpt2.c',
  humaneval: 'HumanEval',
};

function sampler(rng, alphabet) {
  const { symbols, weights } = typeof alphabet === 'string' ? { symbols: alphabet, weights: null } : alphabet;
  const codes = [...symbols].map((c) => c.charCodeAt(0));
  if (!weights) return () => codes[Math.floor(rng() * codes.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  const cum = [];
  let acc = 0;
  for (const w of weights) cum.push((acc += w / total));
  return () => {
    const r = rng();
    let i = 0;
    while (i < cum.length - 1 && r >= cum[i]) i++;
    return codes[i];
  };
}

/** n uzunluğunda rastgele metin. alphabet: ALPHABETS anahtarı, nesnesi veya karakter dizgisi. */
export function randomText(rng, alphabet, n) {
  const a = typeof alphabet === 'string' && ALPHABETS[alphabet] ? ALPHABETS[alphabet] : alphabet;
  const next = sampler(rng, a);
  const CH = 8192;
  const buf = new Uint16Array(CH);
  const parts = [];
  for (let s = 0; s < n; s += CH) {
    const e = Math.min(n, s + CH);
    for (let i = s; i < e; i++) buf[i - s] = next();
    parts.push(String.fromCharCode.apply(null, e - s === CH ? buf : buf.subarray(0, e - s)));
  }
  return parts.join('');
}

/** Tekrarlı metin: `unit` tekrar edilir (0000..., 010101..., girinti boşlukları). */
export function periodicText(unit, n) {
  return unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
}

/**
 * k desen üretir. m sayı ise sabit uzunluk, [lo, hi] ise aralıktan rastgele.
 * fromText oranındaki desenler metinden kesilir (kesin eşleşme), diğerleri rastgeledir.
 */
export function makePatterns(rng, text, alphabet, k, m, fromText = 0.5) {
  const out = [];
  for (let i = 0; i < k; i++) {
    const len = Array.isArray(m) ? randInt(rng, m[0], m[1]) : m;
    if (rng() < fromText && text.length >= len) {
      const s = randInt(rng, 0, text.length - len);
      out.push(text.slice(s, s + len));
    } else {
      out.push(randomText(rng, alphabet, len));
    }
  }
  return out;
}
