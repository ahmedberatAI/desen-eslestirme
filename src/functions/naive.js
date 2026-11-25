// Kaba kuvvet (naive) arama: her hizalamada soldan sağa karşılaştırma. O(n·m) en kötü durum.
// Test oracle'ı olarak kullanıldığı için bilerek en basit haliyle yazılmıştır.

export function searchNaive(text, pattern, uid, hits) {
  const n = text.length;
  const m = pattern.length;
  for (let j = 0; j + m <= n; j++) {
    let i = 0;
    while (i < m && text.charCodeAt(j + i) === pattern.charCodeAt(i)) i++;
    if (i === m) hits.add(j, uid);
  }
}
