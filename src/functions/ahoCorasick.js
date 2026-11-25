// Aho-Corasick (1975): çok desenli otomat, metin üzerinde tek geçiş. O(n + M·σp + eşleşme).
//
// Uygulama ayrıntıları:
//  - Geçişler küçültülmüş alfabe üzerinde (σp + 1 sütun) tam DFA tablosu olarak tutulur:
//    delta[s·A + c]. Başarısızlık bağlantıları ön işlemede BFS ile tabloya gömülür, böylece
//    aramada her karakter için tek tablo okuması yapılır.
//  - Desenlerde geçmeyen karakterler 0 koduna düşer ve otomatı köke döndürür.
//  - Çıktılar "sözlük sonek bağlantısı" (dict) ile zincirlenir; çakışan/iç içe desenler kaçmaz.

import { encodePattern } from './alphabet.js';

export function prepareAhoCorasick(patterns, alphabet) {
  const A = alphabet.size;
  let total = 1;
  for (const p of patterns) total += p.length;
  let delta = new Int32Array(total * A).fill(-1);
  const out = new Int32Array(total).fill(-1); // durumda biten desen (benzersiz desenler: en fazla 1)
  const depth = new Int32Array(total);
  let states = 1;
  patterns.forEach((p, uid) => {
    const x = encodePattern(p, alphabet);
    let s = 0;
    for (let i = 0; i < x.length; i++) {
      const idx = s * A + x[i];
      if (delta[idx] === -1) {
        delta[idx] = states;
        depth[states] = depth[s] + 1;
        states++;
      }
      s = delta[idx];
    }
    out[s] = uid;
  });
  delta = delta.slice(0, states * A);
  const fail = new Int32Array(states);
  const dict = new Int32Array(states); // bir sonraki çıktılı durum (0 = yok)
  const queue = new Int32Array(states);
  let qh = 0;
  let qt = 0;
  for (let c = 0; c < A; c++) {
    const t = delta[c];
    if (t === -1) delta[c] = 0;
    else {
      fail[t] = 0;
      queue[qt++] = t;
    }
  }
  while (qh < qt) {
    const s = queue[qh++];
    const f = fail[s];
    dict[s] = out[f] !== -1 ? f : dict[f];
    for (let c = 0; c < A; c++) {
      const idx = s * A + c;
      const t = delta[idx];
      if (t === -1) delta[idx] = delta[f * A + c];
      else {
        fail[t] = delta[f * A + c];
        queue[qt++] = t;
      }
    }
  }
  // hasOut[s] = 1 ise s'de veya dict zincirinde çıktı vardır (aramada hızlı kontrol)
  const hasOut = new Uint8Array(states);
  for (let s = 1; s < states; s++) if (out[s] !== -1 || dict[s] !== 0) hasOut[s] = 1;
  const lengths = new Int32Array(patterns.map((p) => p.length));
  return { A, states, delta, out, dict, hasOut, lengths };
}

export function searchAhoCorasick(text, map, prep, hits) {
  const { A, delta, out, dict, hasOut, lengths } = prep;
  const n = text.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    s = delta[s * A + map[text.charCodeAt(i)]];
    if (hasOut[s] === 1) {
      let t = out[s] !== -1 ? s : dict[s];
      while (t !== 0) {
        const uid = out[t];
        hits.add(i - lengths[uid] + 1, uid);
        t = dict[t];
      }
    }
  }
}
