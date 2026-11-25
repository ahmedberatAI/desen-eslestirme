// Zaman ölçümü: ısınma turu + en az `minReps` tekrarın medyanı.
// Çok kısa süren işlerde (toplam < minTotal ms) tekrar sayısı maxReps'e kadar artırılır.
// Çöp toplayıcı (node --expose-gc ile) yalnızca ısınmadan ÖNCE bir kez tetiklenir: her tekrardan
// önce zorla GC yapmak, sonraki büyük tipli dizi tahsislerinde sayfa hatalarına yol açıp süreleri
// 2–6 kat şişiriyordu (ön denemelerde gözlendi). Ara sıra araya giren GC'yi medyan bastırır.

import { performance } from 'node:perf_hooks';

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

const gc = typeof globalThis.gc === 'function' ? globalThis.gc : () => {};

/**
 * @param {() => any} fn  ölçülecek iş (sonucu döndürmeli ki optimize edilip atılmasın)
 * @returns {{ ms: number, reps: number, samples: number[], warmup: number, censored: boolean }}
 */
export function measure(fn, { minReps = 5, maxReps = 21, minTotal = 100, budget = Infinity } = {}) {
  gc();
  let t0 = performance.now();
  let sink = fn(); // ısınma turu (JIT + önbellek)
  const warmup = performance.now() - t0;
  if (warmup > budget) {
    // çok yavaş: tekrar etmeye değmez, ısınma süresi alt sınır olarak kaydedilir
    return { ms: warmup, reps: 0, samples: [], warmup, censored: true, sink: !!sink };
  }
  const samples = [];
  let total = 0;
  while (samples.length < minReps || (total < minTotal && samples.length < maxReps)) {
    t0 = performance.now();
    sink = fn();
    const dt = performance.now() - t0;
    samples.push(dt);
    total += dt;
  }
  return { ms: median(samples), reps: samples.length, samples, warmup, censored: false, sink: !!sink };
}

/** Bir atomun girdinin tamamı üzerindeki süresi: kurucu (ön işleme) + arama + çıktı üretimi. */
export function runAtom(AtomClass, params, docs) {
  const atom = new AtomClass(params);
  let count = 0;
  for (const d of docs) for (const _ of atom.process(d)) count++;
  return count;
}
