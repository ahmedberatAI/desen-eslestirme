// Knuth-Morris-Pratt (1977): başarısızlık (önek) fonksiyonu ile metinde geri gitmeden tarama.
// Ön işleme O(m), arama O(n) en kötü durumda da; akış dostudur.
// Bir tam eşleşmeden sonra j = fail[m-1] ile devam edildiğinden örtüşen eşleşmeler de bulunur.

export function prepareKmp(pattern) {
  const m = pattern.length;
  const p = new Int32Array(m);
  for (let i = 0; i < m; i++) p[i] = pattern.charCodeAt(i);
  // fail[i] = p[0..i]'nin hem öneki hem (kendisi olmayan) soneki olan en uzun dizgenin uzunluğu
  const fail = new Int32Array(m);
  let k = 0;
  for (let i = 1; i < m; i++) {
    while (k > 0 && p[i] !== p[k]) k = fail[k - 1];
    if (p[i] === p[k]) k++;
    fail[i] = k;
  }
  return { m, p, fail };
}

export function searchKmp(text, prep, uid, hits) {
  const { m, p, fail } = prep;
  const n = text.length;
  if (m > n) return;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    while (j > 0 && p[j] !== c) j = fail[j - 1];
    if (p[j] === c) {
      j++;
      if (j === m) {
        hits.add(i - m + 1, uid);
        j = fail[m - 1];
      }
    }
  }
}
