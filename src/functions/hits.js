// Sonuç toplayıcı. Atomlar eşleşmeleri (konum, benzersiz desen no) çifti olarak ekler;
// toplayıcı bunları özgün desen sıralarına açar ve sözleşmedeki sıraya koyar:
// önce position, eşitse desenin patterns listesindeki sırası (sözleşme 4.2).

export class HitList {
  constructor() {
    this.pos = new Int32Array(64);
    this.uid = new Int32Array(64);
    this.length = 0;
  }

  /** Bir eşleşme ekler: `pos` 0 tabanlı başlangıç, `uid` benzersiz desen indeksi. */
  add(pos, uid) {
    if (this.length === this.pos.length) this.#grow();
    this.pos[this.length] = pos;
    this.uid[this.length] = uid;
    this.length++;
  }

  #grow() {
    const cap = this.pos.length * 2;
    const p = new Int32Array(cap);
    p.set(this.pos);
    const u = new Int32Array(cap);
    u.set(this.uid);
    this.pos = p;
    this.uid = u;
  }

  /**
   * Eşleşmeleri sıralanmış anahtar dizisine çevirir: anahtar = pos * P + özgün indeks.
   * @param {number[][]} groups  groups[uid] = bu benzersiz desene karşılık gelen özgün indeksler (artan)
   * @param {number} P          özgün desen sayısı
   */
  sortedKeys(groups, P) {
    let total = 0;
    for (let i = 0; i < this.length; i++) total += groups[this.uid[i]].length;
    const keys = new Float64Array(total);
    let t = 0;
    let sorted = true;
    let prev = -1;
    for (let i = 0; i < this.length; i++) {
      const base = this.pos[i] * P;
      const g = groups[this.uid[i]];
      for (let j = 0; j < g.length; j++) {
        const key = base + g[j];
        if (key < prev) sorted = false;
        keys[t++] = prev = key;
      }
    }
    if (!sorted) keys.sort();
    return keys;
  }
}

/** Sıralı anahtarlardan Text.Match nesneleri üretir. */
export function* keysToMatches(keys, id, patterns) {
  const P = patterns.length;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const orig = key % P;
    const position = (key - orig) / P;
    const pattern = patterns[orig];
    yield { id, pattern, position, length: pattern.length };
  }
}
