// Rabin-Karp (Karp & Rabin 1987): kayan polinom özeti.
//
// Çok desenli sürüm: desenler uzunluklarına göre gruplanır; her farklı uzunluk L için metin
// üzerinde L genişliğinde tek bir kayan özet hesaplanır ve özet bir bit filtresinde + açık adresli
// tabloda aranır. Özetler eşit olduğunda karakter karakter doğrulama ŞARTTIR (çakışma olabilir).
// Maliyet: O(n · farklı uzunluk sayısı + doğrulamalar).
//
// Özet: h(s) = Σ s[i]·B^(L-1-i) mod 2^30. Math.imul taşmayı mod 2^32 yapar; 2^30, 2^32'yi
// böldüğü için alt 30 bit tutarlıdır. 30 bit, V8'de değerin "küçük tamsayı" (Smi) kalmasını sağlar.

const BASE = 0x01000193; // tek sayı (FNV asal)
const MASK = 0x3fffffff;

function hashString(s, from, L) {
  let h = 0;
  for (let i = 0; i < L; i++) h = (Math.imul(h, BASE) + s.charCodeAt(from + i)) & MASK;
  return h;
}

export function prepareRabinKarp(patterns) {
  const byLength = new Map();
  patterns.forEach((p, uid) => {
    if (!byLength.has(p.length)) byLength.set(p.length, []);
    byLength.get(p.length).push(uid);
  });
  const groups = [];
  for (const [L, uids] of [...byLength.entries()].sort((a, b) => a[0] - b[0])) {
    // B^(L-1) mod 2^32
    let pow = 1;
    for (let i = 0; i < L - 1; i++) pow = Math.imul(pow, BASE);
    // açık adresli tablo: boyut 2'nin kuvveti, en az 2·adet
    let size = 4;
    while (size < uids.length * 2) size <<= 1;
    const mask = size - 1;
    const keys = new Int32Array(size);
    const heads = new Int32Array(size).fill(-1); // zincir başı (uid listesindeki sıra)
    const next = new Int32Array(uids.length).fill(-1);
    const filterBits = Math.min(1 << 22, Math.max(1 << 10, size * 16));
    const filter = new Uint32Array(filterBits >>> 5);
    const fmask = filterBits - 1;
    uids.forEach((uid, idx) => {
      const h = hashString(patterns[uid], 0, L);
      filter[(h & fmask) >>> 5] |= 1 << (h & 31);
      let slot = (h ^ (h >>> 15)) & mask;
      while (heads[slot] !== -1 && keys[slot] !== h) slot = (slot + 1) & mask;
      if (heads[slot] === -1) keys[slot] = h;
      else next[idx] = heads[slot];
      heads[slot] = idx;
    });
    groups.push({ L, uids, pow, keys, heads, next, mask, filter, fmask });
  }
  return { patterns, groups };
}

export function searchRabinKarp(text, prep, hits) {
  const n = text.length;
  for (const g of prep.groups) {
    if (g.L > n) break; // gruplar artan uzunlukta
    searchGroup(text, n, g, prep.patterns, hits);
  }
}

function searchGroup(text, n, g, patterns, hits) {
  const { L, uids, pow, keys, heads, next, mask, filter, fmask } = g;
  let h = hashString(text, 0, L);
  const last = n - L;
  for (let j = 0; ; j++) {
    if ((filter[(h & fmask) >>> 5] & (1 << (h & 31))) !== 0) {
      let slot = (h ^ (h >>> 15)) & mask;
      while (heads[slot] !== -1 && keys[slot] !== h) slot = (slot + 1) & mask;
      for (let idx = heads[slot]; idx !== -1; idx = next[idx]) {
        const p = patterns[uids[idx]];
        let i = 0;
        while (i < L && text.charCodeAt(j + i) === p.charCodeAt(i)) i++;
        if (i === L) hits.add(j, uids[idx]);
      }
    }
    if (j === last) break;
    h = (Math.imul(h - Math.imul(text.charCodeAt(j), pow), BASE) + text.charCodeAt(j + L)) & MASK;
  }
}
