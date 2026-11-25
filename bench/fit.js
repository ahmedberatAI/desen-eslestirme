// Maliyet modeli katsayılarının ölçümlerden kestirimi.
//
// Model: t̂ = Σ_f c_f · x_f, c_f ≥ 0 (negatif olmayan katsayılar).
// Hedef: göreli hatanın karesi Σ ((t̂_i − t_i) / t_i)²; yani ağırlıklı en küçük kareler,
// ağırlık 1/t_i². Böylece 10 µs'lik ve 1 s'lik ölçümler eşit önem taşır.
// Negatif olmama: özellik sayısı küçük (≤ 5) olduğu için bütün alt kümeler denenir; her alt
// kümede sıradan ağırlıklı EKK çözülür, bütün katsayıları ≥ 0 olan en düşük hatalı çözüm seçilir
// (küçük boyutta Lawson-Hanson NNLS ile aynı sonucu verir).

/** Küçük doğrusal sistem: Gauss eliminasyonu, kısmi pivotlama. */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * @param {Array<{features: Record<string, number>, ms: number}>} rows
 * @param {string[]} names  özellik adları
 * @returns {{ coefficients: Record<string, number>, relErrorMedian: number, relErrorMax: number, n: number }}
 *          katsayılar saniye cinsindendir.
 */
export function fitCoefficients(rows, names) {
  const data = rows.filter((r) => r.ms > 0 && Number.isFinite(r.ms));
  const t = data.map((r) => r.ms / 1000);
  // ölçekleme: her sütunu (x/t) ortalamasına böl, sonra geri çevir (sayısal kararlılık)
  const X = data.map((r, i) => names.map((f) => (r.features[f] ?? 0) / t[i]));
  const scale = names.map((_, j) => {
    let s = 0;
    for (const row of X) s += Math.abs(row[j]);
    return s / Math.max(1, X.length) || 1;
  });
  const Z = X.map((row) => row.map((v, j) => v / scale[j]));
  let best = null;
  const F = names.length;
  for (let mask = 1; mask < 1 << F; mask++) {
    const idx = [];
    for (let j = 0; j < F; j++) if (mask & (1 << j)) idx.push(j);
    const p = idx.length;
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const b = new Array(p).fill(0);
    for (const row of Z) {
      for (let a = 0; a < p; a++) {
        b[a] += row[idx[a]]; // hedef 1 (t/t)
        for (let c = 0; c < p; c++) A[a][c] += row[idx[a]] * row[idx[c]];
      }
    }
    for (let a = 0; a < p; a++) A[a][a] *= 1 + 1e-9; // çok küçük sırt (ridge)
    const sol = solve(A, b);
    if (!sol || sol.some((v) => !(v >= 0))) continue;
    let err = 0;
    for (const row of Z) {
      let pred = 0;
      for (let a = 0; a < p; a++) pred += sol[a] * row[idx[a]];
      err += (pred - 1) ** 2;
    }
    if (!best || err < best.err) best = { err, idx, sol };
  }
  const coefficients = Object.fromEntries(names.map((f) => [f, 0]));
  if (best) best.idx.forEach((j, a) => (coefficients[names[j]] = best.sol[a] / scale[j]));
  const rel = data.map((r, i) => {
    let pred = 0;
    for (const f of names) pred += coefficients[f] * (r.features[f] ?? 0);
    return Math.abs(pred - t[i]) / t[i];
  });
  rel.sort((a, b) => a - b);
  return {
    coefficients,
    relErrorMedian: rel.length ? rel[rel.length >> 1] : NaN,
    relErrorP90: rel.length ? rel[Math.floor(rel.length * 0.9)] : NaN,
    relErrorMax: rel.length ? rel[rel.length - 1] : NaN,
    n: data.length,
  };
}
