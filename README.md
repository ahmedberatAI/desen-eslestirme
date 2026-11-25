# Akıllı Tam Desen Eşleştirme — IoS `text.pattern-match.exact`

Kaynak kod, log ve yapay zekâ derlemleri (LLM eğitim/değerlendirme verisi) içinde bir veya daha çok desenin geçtiği
**bütün** yerleri bulan, Internet of Science (IoS) atom sözleşmesine uygun 12 tam eşleştirme atomu ve girdinin şekline
bakarak bunlardan en hızlı olacağını tahmin edileni seçen **`ExactMatch` molekülü**.

Neden önemli? Kod tabanında API/tanımlayıcı araması, loglarda hata imzası taraması, depoda sızmış anahtar öneki
araması; LLM tarafında ise eğitim derleminde kıyaslama sızıntısı (benchmark contamination) taraması, model çıktısında
yasaklı ifade listesi denetimi ve özel token araması hep aynı işe indirgenir: "bu desenler metnin neresinde?". Her durumda en
hızlı tek bir algoritma yoktur; molekül bu **algoritma seçimi problemini** (Rice 1976) ölçümlerden öğrenilmiş bir çalışma
süresi modeliyle çözer.

- Saf JavaScript, Node.js ≥ 22, ES modülleri. **Hiçbir npm bağımlılığı yok.**
- Testler Node'un kendi `node:test` modülüyle yazıldı: `npm test` temiz bir kopyada kurulum gerektirmeden çalışır.
- Girdi: JSONL derlem (`{"id": ..., "text": ...}` satırları) veya düz metin (ör. bir kaynak dosyası = tek belge).
- Seçim yöntemi: ölçümlerle kalibre edilmiş **maliyet modeli** (atom başına beklenen iş özellikleri × öğrenilen katsayılar).
- Rapor: [`report/rapor.pdf`](report/rapor.pdf) (IoS bileşen yayını biçiminde).

## Kurulum ve komutlar

```bash
git clone https://github.com/ahmedberatAI/desen-eslestirme.git
cd desen-eslestirme
node --version          # >= 22
npm test                # bütün testler (≈ 4 s), bağımlılık kurmadan
npm run calibrate       # kalibrasyon ızgarası (180 vaka × 12 atom, ≈ 8 dk) -> src/calibration.json
npm run bench           # doğrulama kümesi (120 vaka × 12 atom, ≈ 3 dk) -> bench/results/validation-table.md
npm run figures         # SVG şekiller -> bench/results/figures/
npm run report          # rapor HTML + PDF (PDF için Edge/Chrome gerekir) -> report/
```

`npm run calibrate` ve `npm run bench` `--quick` seçeneğiyle küçük bir ızgarada saniyeler içinde
denenebilir (`node --expose-gc bench/calibrate.js --quick --out /tmp/x`).

## Komut satırı

```bash
# düz metin girdi (tek belge): GPT-2 eğitim kodunda iki fonksiyonun bütün geçişleri, JSONL olarak stdout'a
node bin/ios.js run ExactMatch --patterns attention_forward,layernorm_forward < tests/data/train_gpt2.c > cikti.jsonl

# JSONL derlem (çok belgeli akış), büyük/küçük harf duyarsız, belirli bir atomu zorlayarak
node bin/ios.js run ExactMatch --patterns "todo,return " --ignoreCase --strategy HorspoolSearch --input tests/data/humaneval.jsonl

# yalnızca kararı (record) JSON olarak yaz
node bin/ios.js explain --patterns attention_forward,layernorm_forward < tests/data/train_gpt2.c

# kayıtlı atomları listele
node bin/ios.js list
```

Ek seçenekler: `--patterns-file desenler.txt` (satır başına bir desen), `--input dosya` (`.jsonl` uzantısı JSONL okunur),
`--format auto|jsonl|text` (varsayılan `auto`: ilk karakter `{` ise JSONL), `--quiet`.

## Programdan kullanım

```js
import { ExactMatch, parseCorpus } from './src/index.js';

const em = new ExactMatch({ patterns: ['torch.', 'self.'], ignoreCase: false, strategy: 'auto' });
for (const match of em.run(parseCorpus(jsonlText))) console.log(match);
// { id: 'src/model.py', pattern: 'torch.', position: 7, length: 6 }
console.log(em.record); // { requested, selected, shape, estimates, why }
```

## Atomlar

| Atom | Grup | Algoritma | Kaynak | Not |
|---|---|---|---|---|
| `NaiveSearch` | – | Kaba kuvvet | – | Test oracle'ı (başlangıç paketi) |
| `BoyerMooreSearch` | – | Boyer-Moore (kötü karakter + iyi sonek) | Boyer & Moore 1977 | Başlangıç paketi örneği |
| `HorspoolSearch` | A | Horspool (BMH) | Horspool 1980 | Yalnızca kötü karakter kayması |
| `ShiftOrSearch` | A | Shift-Or (bit paralel) | Baeza-Yates & Gonnet 1992 | m ≤ 32 doğrudan; m > 32 filtre + doğrulama |
| `TunedBoyerMooreSearch` | A | Tuned Boyer-Moore (UFAST) | Hume & Sunday 1991 | Sentinel + 3 kez açılmış atlama döngüsü |
| `HashQSearch` | A | HASHq (q-gram Horspool) | Lecroq 2007; Wu & Manber 1994 | q-gram özetli kayma (m − q + 1 düzeltmesi) |
| `KmpSearch` | B | Knuth-Morris-Pratt | KMP 1977 | En kötü durumda doğrusal |
| `RabinKarpSearch` | B | Rabin-Karp (çok desenli) | Karp & Rabin 1987 | Her farklı uzunluk için tek kayan özet |
| `AhoCorasickSearch` | C | Aho-Corasick | Aho & Corasick 1975 | Tam DFA, tek geçiş |
| `WuManberSearch` | C | Wu-Manber (**bonus**) | Wu & Manber 1994 | Blok kayması, çok desen |
| `SuffixArraySearch` | D | Suffix array + ikili arama | Manber & Myers 1993 | Önek ikiye katlama ile inşa |
| `FmIndexSearch` | D | FM-index (**bonus**) | Ferragina & Manzini 2000 | BWT + geriye doğru arama |

Her atomun çekirdeği `src/functions/` altında saf bir modül, atom sınıfı `src/atomic/` altında
(`manifest` + `selection { features, defaults, applicable? }`). Atomlarda `indexOf`, `includes`,
`startsWith`, `RegExp` vb. hazır arama işlevleri **kullanılmaz**; bu, `tests/unit/contract.test.js`
içinde kaynak kod taranarak denetlenir.

## Depo yapısı

```
src/functions/        algoritma çekirdekleri (saf fonksiyonlar) + alfabe, sonuç toplayıcı, maliyet formülleri
src/atomic/           atom sınıfları (ExactSearchAtom ortak sınıfı + 12 atom)
src/molecules/ExactMatch.js   molekül (maliyet modeliyle seçim)
src/registry.js       kayıt defteri (yeni atom = registry.register(Atom); molekül değişmez)
src/shape.js          veri şekli: n, σ, σ_eff, k, m (min/maks/ort.), uzunluk histogramı
src/calibration.json  kalibrasyonla bulunan katsayılar (npm run calibrate üretir)
src/corpus.js         derlem okuyucu: JSONL ({id, text}) ve düz metin
bin/ios.js            komut satırı (run / explain / list)
bench/                veri üretici, zaman ölçümü, kalibrasyon, doğrulama, şekiller, rapor
bench/results/        ham ölçümler (JSON), doğrulama tablosu (MD/JSON), şekiller (SVG)
tests/unit/           sözleşme, atom birim, oracle doğruluk, molekül, CLI, yardımcı testleri
tests/benchmarks/     ölçüm altyapısı duman testleri
tests/data/           llm.c train_gpt2.c (GPT-2 eğitim kodu), OpenAI HumanEval (164 problem) — kaynak/lisans: tests/data/README.md
report/               rapor (HTML + PDF)
presentation/         5 dakikalık sunum (HTML + PDF), konuşma notları, canlı demo betiği
```

## Veri

| Veri | Rol | Ayrıntı |
|---|---|---|
| `tests/data/train_gpt2.c` | gerçek, **tek uzun belge** | GPT-2'yi saf C ile eğiten karpathy/llm.c kaynak dosyası, 50 680 karakter (MIT) |
| `tests/data/humaneval.jsonl` | gerçek, **çok belgeli akış** | OpenAI HumanEval kod üretme kıyaslaması, 164 problem (prompt + çözüm), 103 560 karakter (MIT) |
| eylem izi `UDLR` (σ=4) | sentetik, kalibrasyon | RL ajan eylem dizileri (yukarı/aşağı/sol/sağ) |
| hex (σ=16) | sentetik, kalibrasyon | özet/ikili döküm (SHA, sihirli bayt imzaları) |
| kaynak kod (σ=94) | sentetik, kalibrasyon | karakter frekansları gerçek kod derleminden sayıldı (σ_eff ≈ 10,5) |
| ikili `01` (σ=2), çok dilli Unicode (σ=62) | sentetik, **yalnızca doğrulama** | kalibrasyonda görülmemiş alfabeler |

## Testler

`npm test` → 360+ test:

- **Sözleşme** (`contract.test.js`): her atom + molekül için alanlar, 0 tabanlı UTF-16 konum, örtüşme,
  sıralama (belge → konum → desen sırası), yinelenen desen, ignoreCase (yalnız ASCII), boş metin /
  uzun desen, boş desen hatası, determinizm, manifest/selection; atom kaynaklarında yasak işlev taraması.
- **Atom birim testleri** (`<Atom>.test.js`): her atom için 14 ortak + 1–4 atoma özgü özel durum
  (periyodik ABAB, tek karakter, alfabede olmayan karakterler, m = 32/33 sınırı, sentinel, `m − q + 1` kayması …).
- **Doğruluk kanıtı** (`correctness.test.js`): `train_gpt2.c` (kısa/uzun/API adları/300 desen/ignoreCase), 164 HumanEval
  problemi (çok belgeli akış), eylem izi/hex/kaynak kod/ikili/unicode alfabeleri, çok tekrarlı metinler (0000…, girinti),
  karışık uzunluklar, yinelenen desenler ve **400 tohumlu rastgele vaka** — her atom ve molekül `NaiveSearch` ile eleman eleman aynı.
- **Molekül** (`molecule.test.js`): record alanları, en ucuz tahminin seçilmesi, zorla seçilen her stratejinin
  aynı sonucu vermesi, bilinmeyen strateji hatası, test içinde kayıt defterine eklenen **sahte atomun molekül
  kodu değişmeden seçilmesi**, **uygulanamaz atomun hiç seçilmemesi**.
- **Derlem okuyucu ve CLI** (`support.test.js`, `cli.test.js`) ve **ölçüm duman testleri** (`tests/benchmarks/smoke.test.js`).

## Seçim yöntemi ve sonuçlar (özet)

Molekül akıştaki ilk belgeden bir **veri şekli** hesaplar (n, σ, etkin alfabe σ_eff = 1/Σp², k, m min/maks/ort.,
uzunluk histogramı). Her atom `selection.features(shape)` ile beklenen iş miktarlarını (ör. beklenen kayma
sayısı, DFA hücre sayısı, dizin inşası n log n) verir; tahmini süre = Σ katsayı × özellik. Bu, atom başına
öğrenilen, açıklanabilir bir **çalışma süresi regresyonudur**: katsayılar `npm run calibrate` ile 180 vakalık ızgarada
(3 alfabe: eylem izi, hex, kaynak kod × n ∈ {10⁴,10⁵,10⁶} × m ∈ {4,8,16,32,64} × k ∈ {1,8,64,512}) negatif olmayan,
göreli hatayı küçülten en küçük karelerle bulunur. Molekülün kodunda hiçbir atom adı yoktur; atomlar kayıt defterinden okunur.

Doğrulama (`npm run bench`): **120 görülmemiş vaka** (farklı tohumlar, ızgara arası n/k/m, kalibrasyonda
olmayan ikili ve Unicode alfabeleri, `train_gpt2.c` / HumanEval gerçek verisi). Makine: Intel Core Ultra 9 275HX,
Windows 11, Node v24.15.0. Ölçüm: 1 ısınma + ≥ 5 tekrarın medyanı.

| Politika | En hızlıyı seçme | %10 içinde | Yavaşlama (geo. ort.) | En kötü yavaşlama | Toplam süre / en iyi |
|---|---:|---:|---:|---:|---:|
| **ExactMatch (auto)** | **80.8%** | **83.3%** | **1.09×** | 20.50× | **1.29×** |
| Her zaman WuManberSearch | 62.5% | 66.7% | 1.25× | 5.42× | 1.50× |
| Klasik kural (k=1 → Boyer-Moore, k>1 → Aho-Corasick) | 17.5% | 19.2% | 2.64× | 13.90× | 1.74× |
| Her zaman AhoCorasickSearch | 17.5% | 18.3% | 2.75× | 13.90× | 1.74× |
| Her zaman HashQSearch | 8.3% | 10.0% | 4.66× | 54.55× | 13.22× |
| Eşik kuralı (m<50 → TunedBM, değilse HASHq) | 3.3% | 4.2% | 7.38× | 218.34× | 25.57× |

Tam tablo ve yanlış seçimlerin listesi: [`bench/results/validation-table.md`](bench/results/validation-table.md).
En kötü durum (20×) tek bir vakadan geliyor: HumanEval akışının ilk belgesi yalnızca 600 karakter olduğu için
molekül suffix array'i seçiyor, ancak dizin 164 belgenin her biri için yeniden kuruluyor ("ilk belgeye göre
karar" kuralının sınırı; raporda §6–7). Bu vaka dışında en kötü yavaşlama 2,9×. Kalibrasyonda görülmemiş
alfabelerde molekül aynı kalitede: ikili 1,06×, Unicode 1,03× (geo. ort.).

Şekiller: `bench/results/figures/` (en hızlı atom haritası, molekül seçimleri, yavaşlama ECDF'i, model doğruluğu).

## Grup üyeleri ve katkılar

**YZM327 Yapay Zeka için Yazılım Mühendisliği** — vize projesi, 2 kişilik grup.

| Üye | Sorumluluk alanı |
|---|---|
| **Ahmed Berat Özer** | Ortak atom sınıfı ve alfabe küçültme; A grubu atomları (Horspool, Shift-Or, Tuned Boyer-Moore, HASHq) ve q-gram kayma düzeltmesi; veri şekli, maliyet modeli ve `ExactMatch` molekülü; kayıt defteri; kalibrasyon ızgarası ve katsayı uydurma |
| **Görkem Özer** | B/C/D grubu atomları (KMP, Rabin-Karp, Aho-Corasick, Wu-Manber, suffix array, FM-index); sözleşme, oracle ve rastgele doğruluk testleri; JSONL derlem okuyucu ve komut satırı (`bin/ios.js`); doğrulama kümesi, politika karşılaştırması, şekiller |
| Birlikte | Deney tasarımı, yanlış seçimlerin analizi, rapor ve sunum |

Her iki üye de kodun bütün bölümlerini açıklayabilecek şekilde birbirinin kodunu gözden geçirmiştir.
Sunum: [`presentation/sunum.html`](presentation/sunum.html) (PDF: [`presentation/sunum.pdf`](presentation/sunum.pdf)),
konuşma notları: [`presentation/konusma-notlari.md`](presentation/konusma-notlari.md).

## Yapay zekâ aracı kullanımı

Bu projede bir yapay zekâ kodlama asistanı (Claude Code) kullanılmıştır: kod iskeletinin ve testlerin yazımı,
ölçüm betiklerinin hazırlanması ve rapor taslağı. Algoritmaların doğruluğu oracle testleriyle, performans
iddiaları depodaki ham ölçümlerle doğrulanmıştır. Ayrıntılar raporun "Kaynaklar ve araçlar" bölümündedir.
(Dersin YZ politikasına göre bu bölüm düzenlenmelidir.)

## Kaynaklar

Boyer & Moore 1977; Horspool 1980; Hume & Sunday 1991; Lecroq 2007; Knuth, Morris & Pratt 1977;
Karp & Rabin 1987; Baeza-Yates & Gonnet 1992; Aho & Corasick 1975; Wu & Manber 1994; Manber & Myers 1993;
Ferragina & Manzini 2000; Rice 1976 (algoritma seçimi problemi); Hutter vd. 2014 (çalışma süresi tahmini);
Chen vd. 2021 (HumanEval); Charras & Lecroq, *Exact String Matching Algorithms*; hub.ioscience.org/p/learn/.
Tam künyeler raporda.
