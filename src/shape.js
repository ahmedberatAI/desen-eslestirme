// Veri şekli (data shape): molekülün karar verirken baktığı girdi özellikleri.
//
// n        : metin uzunluğu (akıştaki ilk belge)
// sigma    : metindeki ayrık karakter sayısı (ilk 2^14 karakter örneklenir; karar maliyetini düşük tutmak için)
// sigmaEff : etkin alfabe büyüklüğü 1/Σp² (dağılım dengesizse sigma'dan küçüktür)
// k        : desen sayısı (verildiği gibi), kUnique: katlama + tekilleştirme sonrası
// mMin, mMax, mAvg : desen uzunlukları (benzersiz desenler üzerinden)
// totalLength      : benzersiz desenlerin toplam uzunluğu (M)
// distinctLengths  : farklı desen uzunluğu sayısı
// lengths          : [[m, adet], ...] uzunluk histogramı (artan m)
// patternSigma     : desenlerdeki ayrık karakter sayısı (σp)

import { alphabetStats, foldAscii } from './functions/alphabet.js';
import { validateParams } from './atomic/ExactSearchAtom.js';

export function computeShape(doc, params) {
  const { patterns, ignoreCase } = validateParams(params);
  const raw = doc?.text ?? '';
  const SAMPLE = 1 << 14;
  const sample = raw.length > SAMPLE ? raw.slice(0, SAMPLE) : raw;
  const text = ignoreCase ? foldAscii(sample) : sample;
  const { sigma, sigmaEff } = alphabetStats(text);

  const unique = [...new Set(patterns.map((p) => (ignoreCase ? foldAscii(p) : p)))];
  const hist = new Map();
  const chars = new Set();
  let total = 0;
  let mMin = Infinity;
  let mMax = 0;
  for (const p of unique) {
    hist.set(p.length, (hist.get(p.length) ?? 0) + 1);
    total += p.length;
    if (p.length < mMin) mMin = p.length;
    if (p.length > mMax) mMax = p.length;
    for (let i = 0; i < p.length; i++) chars.add(p.charCodeAt(i));
  }
  const lengths = [...hist.entries()].sort((a, b) => a[0] - b[0]);
  return {
    n: raw.length,
    sigma,
    sigmaEff: round(sigmaEff, 3),
    k: patterns.length,
    kUnique: unique.length,
    mMin,
    mMax,
    mAvg: round(total / unique.length, 3),
    totalLength: total,
    distinctLengths: lengths.length,
    patternSigma: chars.size,
    ignoreCase,
    lengths,
  };
}

function round(x, d) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
