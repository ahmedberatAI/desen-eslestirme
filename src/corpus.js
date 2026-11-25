// Derlem (corpus) okuyucu. Corpus.Document = { id: "src/model.py", text: "import torch\n..." }
//
// İki girdi biçimi desteklenir:
//  - JSONL: her boş olmayan satır bir JSON nesnesidir (LLM eğitim/değerlendirme derlemlerinin
//    yaygın biçimi). `text` alanı zorunludur ve dizgi olmalıdır; `id` yoksa "doc-<sıra>" verilir,
//    sayı ise dizgiye çevrilir. Diğer alanlar yok sayılır.
//  - text: girdinin tamamı tek bir belgedir (ör. bir kaynak kod veya log dosyası). Metne hiçbir
//    dönüşüm uygulanmaz; konumlar dosyadaki UTF-16 indeksleridir (satır sonları dahil).
// "auto" biçimde, ilk boşluk olmayan karakter "{" ise JSONL, değilse düz metin kabul edilir.
// Okuyucu bir atom değildir; hazır dizgi işlevlerini kullanabilir.

/** Biçim tahmini: 'jsonl' | 'text'. */
export function detectFormat(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') continue;
    return c === '{' ? 'jsonl' : 'text';
  }
  return 'text';
}

/** JSONL metnini satır satır gezip belgeleri üretir. */
export function* iterJsonl(text) {
  let start = 0;
  let line = 0;
  let index = 0;
  const len = text.length;
  while (start < len) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = len;
    const raw = text.slice(start, end).trim();
    line++;
    start = end + 1;
    if (!raw) continue;
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (err) {
      throw new SyntaxError(`JSONL ${line}. satır geçerli JSON değil: ${err.message}`);
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new TypeError(`JSONL ${line}. satır bir nesne değil`);
    if (typeof obj.text !== 'string') throw new TypeError(`JSONL ${line}. satır: "text" alanı dizgi olmalı`);
    index++;
    const id = typeof obj.id === 'string' ? obj.id : typeof obj.id === 'number' ? String(obj.id) : `doc-${index}`;
    yield { id, text: obj.text };
  }
}

/** JSONL metnini ayrıştırır ve Corpus.Document dizisi döndürür. */
export function parseJsonl(text) {
  return [...iterJsonl(stripBom(text))];
}

/**
 * Girdiyi biçime göre belgelere çevirir.
 * @param {string} text
 * @param {{ format?: 'auto'|'jsonl'|'text', id?: string }} [opts]  id: düz metin belgesinin kimliği
 */
export function parseCorpus(text, { format = 'auto', id = 'stdin' } = {}) {
  const t = stripBom(text);
  const f = format === 'auto' ? detectFormat(t) : format;
  if (f === 'jsonl') return parseJsonl(t);
  if (f === 'text') return t.length ? [{ id, text: t }] : [];
  throw new RangeError(`Bilinmeyen biçim: ${format} (auto, jsonl veya text)`);
}

/** Bir okunabilir akıştan (ör. process.stdin) bütün metni okuyup ayrıştırır. */
export async function readCorpusStream(stream, opts) {
  stream.setEncoding?.('utf8');
  let text = '';
  for await (const chunk of stream) text += chunk;
  return parseCorpus(text, opts);
}

/** Belgeleri JSONL metnine çevirir (testler ve veri üretimi için). */
export function formatJsonl(docs) {
  return docs.map((d) => JSON.stringify({ id: d.id, text: d.text })).join('\n') + '\n';
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
