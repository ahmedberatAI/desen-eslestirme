// Raporun anlatı metni. bench/report.js tarafından ölçüm sonuçlarıyla birlikte HTML'e çevrilir.
// Sayılar (tablolar, oranlar) her zaman bench/results/ altındaki ham sonuçlardan hesaplanır.

import { readFileSync } from 'node:fs';
import { ExactMatch } from '../src/molecules/ExactMatch.js';
import { parseJsonl } from '../src/corpus.js';
import { ALPHABET_LABELS } from '../bench/data.js';
import { moleculeChoice } from '../bench/validate.js';

const DATA = new URL('../tests/data/', import.meta.url);
const humaneval = () => parseJsonl(readFileSync(new URL('humaneval.jsonl', DATA), 'utf8'));
const gpt2 = () => readFileSync(new URL('train_gpt2.c', DATA), 'utf8');

export const EXPLAIN_PATTERNS = ['attention_forward', 'layernorm_forward'];

function explainExample() {
  const em = new ExactMatch({ patterns: EXPLAIN_PATTERNS });
  const r = em.decide({ id: 'train_gpt2.c', text: gpt2() });
  const short = {
    requested: r.requested,
    selected: r.selected,
    shape: { n: r.shape.n, sigma: r.shape.sigma, sigmaEff: r.shape.sigmaEff, k: r.shape.k, mMin: r.shape.mMin, mMax: r.shape.mMax, mAvg: r.shape.mAvg },
    estimates: r.estimates.slice(0, 3).map((e) => ({ atom: e.atom, cost: Number(e.cost.toPrecision(3)), features: e.features })),
    why: r.why,
  };
  const lines = Object.entries(short).map(([k, val]) =>
    k === 'estimates' ? `  "estimates": [
${val.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}
  ]` : `  "${k}": ${JSON.stringify(val)}`);
  return `{
${lines.join(',\n')}
}`;
}

const nice = (atom) => atom.replace('Search', '');
const int = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const label = (a) => ALPHABET_LABELS[a] ?? a;

export function sections(c) {
  const v = c.val;
  const auto = v.table.find((p) => p.policy === 'ExactMatch (auto)');
  const threshold = v.table.find((p) => p.policy.startsWith('Eşik kuralı'));
  const classic = v.table.find((p) => p.policy.startsWith('Klasik kural'));
  const singles = v.table.filter((p) => p.policy.startsWith('Her zaman')).sort((a, b) => a.geomeanSlowdown - b.geomeanSlowdown);
  const bestSingle = singles[0];
  const calAuto = c.calTable.table.find((p) => p.policy === 'ExactMatch (auto)');
  const wrong = v.mispredictions;
  const worst = wrong[0];
  const m = c.machine;
  const nVal = v.meta.cases;
  const over2 = wrong.filter((w) => w.slowdown > 2).length;
  const docs = humaneval();
  const heTotal = docs.reduce((s, d) => s + d.text.length, 0);
  const bestOf = (r) => Object.entries(r.times).reduce((b, [a, t]) => (!b || t.ms < b.ms ? { a, ms: t.ms } : b), null).a;
  const winners = new Set(c.calRows.map(bestOf));
  const winCount = (atom) => c.calRows.filter((r) => bestOf(r) === atom).length;
  // alfabe / kaynak başına molekül başarımı (doğrulama kümesi)
  const perAlphabet = {};
  for (const r of c.valRows) {
    const best = Math.min(...Object.values(r.times).map((t) => t.ms));
    const s = r.times[moleculeChoice(r.shape)].ms / best;
    const g = (perAlphabet[r.alphabet] ??= { n: 0, log: 0, fastest: 0, worst: 0 });
    g.n++;
    g.log += Math.log(s);
    if (s <= 1) g.fastest++;
    g.worst = Math.max(g.worst, s);
  }
  const geo = (a) => Math.exp(perAlphabet[a].log / perAlphabet[a].n);
  const second = wrong[1];
  const W = (id) => wrong.find((w) => w.id === id);
  const ms = (x) => (x < 1 ? `${(x * 1000).toFixed(0)} µs` : `${x.toFixed(2)} ms`);
  const realStream = c.valRows.filter((r) => r.source === 'humaneval');

  return `
<h1>Akıllı Tam Desen Eşleştirme: kod ve yapay zekâ derlemleri için atomlar ve seçici bir molekül</h1>
<div class="meta">IoS görevi <code>text.pattern-match.exact</code> · Bileşen yayını biçiminde vize projesi raporu ·
<b>YZM327 Yapay Zeka için Yazılım Mühendisliği</b> · Grup: <b>Ahmed Berat Özer, Görkem Özer</b> · Kasım 2026 ·
Kod: github.com/ahmedberatAI/desen-eslestirme</div>

<h2>1. Ne yapar ve neden</h2>
<p>Bir metin içinde bir veya daha çok desenin geçtiği <b>bütün</b> konumları bulmak, yazılım araçlarının ve yapay zekâ
veri hatlarının en sık yaptığı işlerdendir: kod tabanında bir API adını veya tanımlayıcıyı aramak (grep, IDE araması,
statik analiz), loglarda hata imzalarını taramak, depoda sızmış gizli anahtar önekleri aramak; LLM tarafında ise eğitim
derleminde değerlendirme kıyaslamalarının parçalarını aramak (kıyaslama sızıntısı / <i>benchmark contamination</i>),
model çıktısında yasaklı ifade listelerini denetlemek ve özel token'ları bulmak. Tek bir "en hızlı" algoritma yoktur:
kısa desende iyi olan uzun desende, tek desende iyi olan yüzlerce desende geri kalır; küçük alfabeli veride (bit dizileri,
ajan eylem izleri) iyi olan kaynak kodda geri kalabilir. Bu proje (i) IoS atom sözleşmesine uyan <b>10 yeni tam eşleştirme
atomu</b> (başlangıç paketindeki Naive ve Boyer-Moore ile birlikte 12), (ii) girdinin şekline bakarak bunlardan en ucuzunu
seçen <b><code>ExactMatch</code> molekülü</b> ve (iii) seçimin işe yaradığını gösteren <b>kalibrasyon + görülmemiş veri
doğrulaması</b> sunar. Molekülün çözdüğü iş bir <b>algoritma seçimi problemidir</b> (Rice 1976): girdi özelliklerinden her
algoritmanın çalışma süresini tahmin eden, ölçümlerden öğrenilmiş bir model (Hutter vd. 2014) ile en ucuz atom seçilir.
Kapsam yalnızca tam eşleşmedir; yaklaşık eşleşme (düzenleme mesafesi, bulanık arama, gömme tabanlı/anlamsal arama) kapsam dışıdır.</p>
<p><b>Katkı özeti.</b> A grubundan dört (Horspool, Shift-Or, Tuned Boyer-Moore, HASHq), B grubundan iki (KMP, Rabin-Karp),
C grubundan iki (Aho-Corasick, <i>Wu-Manber</i>) ve D grubundan iki (suffix array, <i>FM-index</i>) atom; atom başına
beklenen iş miktarını tahmin eden özellikler ve ölçümle öğrenilen katsayılardan oluşan bir <b>maliyet modeli</b>;
gerçek yazılım/YZ verisi (karpathy/llm.c <code>train_gpt2.c</code>, OpenAI HumanEval) ile doğruluk kanıtı. ${nVal} vakalık
doğrulamada molekül, en hızlı atomu vakaların <b>${c.pct(auto.fastestRate)}</b>'inde seçti; yavaşlamanın geometrik ortalaması
<b>${c.fx(auto.geomeanSlowdown)}</b> (en iyi tek atom ${nice(bestSingle.policy.replace('Her zaman ', ''))}: ${c.fx(bestSingle.geomeanSlowdown)};
eşik kuralı: ${c.fx(threshold.geomeanSlowdown)}; klasik BM/AC kuralı: ${c.fx(classic.geomeanSlowdown)}).</p>

<h2>2. Algoritmalar</h2>
<p>Bütün atomlar ortak <code>ExactSearchAtom</code> sınıfından türer. Ortak sınıf parametreleri doğrular, ignoreCase için
yalnızca ASCII <code>a–z</code>'yi katlar, katlamadan sonra yinelenen desenleri tek kez aratır ve sonuçları sözleşmedeki
sıraya koyar (anahtar = konum·P + özgün desen indeksi; tipli dizide sayısal sıralama). Böylece her atom yalnızca
"metinde bu desen nerede?" sorusunu çözer. Tablo kayması kullanan atomlar <b>alfabe küçültme</b> uygular: desenlerde
geçen karakterlere 1..σ<sub>p</sub> kodu verilir, diğer bütün karakterler 0 ("diğer") sınıfına düşer; tablolar 65 536 yerine
σ<sub>p</sub>+1 hücrelidir ve Unicode metinlerde de doğru çalışır. Atomlarda <code>indexOf</code>, <code>includes</code>,
<code>RegExp</code> vb. kullanılmaz (bir test kaynak kodu tarar).</p>
<table class="small"><thead><tr><th>Atom</th><th>Fikir</th><th>Ön işleme</th><th>Arama (ortalama / en kötü)</th></tr></thead><tbody>
<tr><td>Horspool</td><td>Pencerenin son karakterine göre kötü karakter kayması</td><td>O(m+σ)</td><td>~n/E[kayma] / O(nm)</td></tr>
<tr><td>Shift-Or</td><td>Bit paralel durum; karakter başına bir kaydırma + VEYA</td><td>O(m+σ)</td><td>Θ(n) (m≤32)</td></tr>
<tr><td>Tuned BM</td><td>Hume-Sunday "UFAST": sentinel + 3 kez açılmış, karşılaştırmasız atlama döngüsü</td><td>O(n+m+σ)*</td><td>~n/E[kayma] / O(nm)</td></tr>
<tr><td>HASHq</td><td>Son q-gramın desende sağdan en yakın geçişine göre kayma (Lecroq 2007)</td><td>O(σ<sup>q</sup>+mq)</td><td>~nq/(m−q+1) / O(nm)</td></tr>
<tr><td>KMP</td><td>Başarısızlık fonksiyonu, metinde geri gitmez</td><td>O(m)</td><td>Θ(n)</td></tr>
<tr><td>Rabin-Karp</td><td>Uzunluk grubu başına bir kayan özet + bit filtresi + doğrulama</td><td>O(M)</td><td>O(n·L<sub>farklı</sub>+doğrulama)</td></tr>
<tr><td>Aho-Corasick</td><td>Tam DFA (başarısızlık bağlantıları tabloya gömülü), sözlük bağlantıları</td><td>O(M·σ<sub>p</sub>)</td><td>Θ(n+eşleşme)</td></tr>
<tr><td>Wu-Manber</td><td>L=m<sub>min</sub> pencerenin son B karakterlik bloğuna göre kayma; kayma 0 ise kova doğrulaması</td><td>O(σ<sup>B</sup>+kL)</td><td>~nB/E[kayma] / O(nM)</td></tr>
<tr><td>Suffix array</td><td>Önek ikiye katlama + sayma sıralaması; desen başına iki ikili arama</td><td>O(n log n)</td><td>O(m log n + occ)</td></tr>
<tr><td>FM-index</td><td>BWT, C tablosu, 64 satırda bir Occ kontrol noktası; geriye doğru arama</td><td>O(n log n)</td><td>O(m + occ)</td></tr>
</tbody></table>
<p style="font-size:8.4pt">* Tuned BM her belge için metni kodlanmış bir tipli diziye kopyalar (sentinel için). M = desen uzunlukları toplamı.</p>
<h3>Kaynak tariflerden ayrıldığımız noktalar</h3>
<ol>
<li><b>HASHq, desende olmayan q-gram için kayma.</b> q-gram kaymasını Horspool'a benzetip bu durumda m kadar kaydıran
uyarlamalar <b>yanlıştır</b>. Pencerenin son q-gramı desende yoksa bile, desenin bir sonraki hizalaması bu q-gramın son q−1
karakteriyle örtüşebilir. Güvenli en büyük kayma <b>m − q + 1</b>'dir (Lecroq'un tablosu da böyle başlar). Karşı örnek (birim testinde):
desen <code>abc</code>, q=2, metin <code>xyabc</code>: ilk pencerenin 2-gramı <code>ya</code> desende yok; m=3 kaydırmak 2. konumdaki
eşleşmeyi atlar. Test, q'nun gerçekten 2 seçildiğini ve tablodaki kaymanın 2 olduğunu da denetler.</li>
<li><b>HASHq doğrulamadan sonra kayma</b> 1 değil, son q-gramın desende bir önceki geçişine olan uzaklıktır (yoksa m−q+1).
q, (σ<sub>p</sub>)<sup>q</sup> ≥ 2m olacak en küçük değerdir (q ≤ 8, tablo ≤ 2<sup>20</sup>); Lecroq'taki çakışabilen karma yerine
q-gramın küçültülmüş alfabedeki tam kodu kullanılır (çakışma yok, kaymalar gereksiz yere küçülmez).</li>
<li><b>Tuned BM sentinel.</b> JavaScript dizgileri değiştirilemediği için sentinel, metnin kodlanmış kopyasının sonuna
yazılır. Atlama döngüsünün sentinel bölgesinde n+m−1'i aşamayacağı (i + skip[t[i]] ≤ n+m−1) kodda gerekçelendirildi.
Bu kopya O(n) ek iş getirir; C'deki "bedava" sentinel avantajı JavaScript'te yoktur (bkz. §7).</li>
<li><b>Shift-Or, m &gt; 32.</b> JavaScript bit işlemleri 32 bittir; ilk 32 karakter filtre olarak aranır, adaylar kalan
karakterlerle doğrulanır (eşleşme kaçmaz).</li>
<li><b>Wu-Manber.</b> Blok özeti küçültülmüş alfabede tam kodlamadır (çakışma yok); PREFIX tablosu yerine kova doğrudan
doğrulanır; B, σ<sub>p</sub><sup>B</sup> ≥ 2kL olacak şekilde seçilir.</li>
<li><b>Rabin-Karp</b> çok desenlidir (aynı uzunluktaki desenler tek geçişte); özet mod 2<sup>30</sup> tutulur (V8'de küçük tamsayı).
<b>FM-index</b> örneklenmiş SA yerine tam SA saklar (bu boyutlarda bellek sorun değil, konum bulma O(1)).</li>
</ol>

<h2>3. Girdi ve çıktılar, parametreler</h2>
<p><b>Girdi:</b> Corpus.Document akışı <code>{ id: "src/model.py", text: "import torch…" }</code>. Komut satırı iki biçim okur:
<b>JSONL</b> (her satır <code>{"id": …, "text": …}</code>; LLM eğitim/değerlendirme derlemlerinin yaygın biçimi; <code>id</code> yoksa
<code>doc-&lt;sıra&gt;</code>) ve <b>düz metin</b> (girdinin tamamı tek belge; ör. bir kaynak kod veya log dosyası; metne dokunulmaz,
konumlar dosyadaki indekslerdir). <b>Parametreler:</b> <code>patterns</code> (boş olmayan dizgilerden boş olmayan liste; aksi halde
hata), <code>ignoreCase</code> (yalnızca ASCII A–Z/a–z eşit), molekülde ayrıca <code>strategy</code> (<code>"auto"</code> veya kayıtlı
bir atom adı; bilinmeyen ad geçerli seçenekleri listeleyen bir hata verir). <b>Çıktı:</b> her eşleşme için Text.Match
<code>{ id, pattern, position, length }</code>; konum 0 tabanlı UTF-16 kod birimi; örtüşen eşleşmeler ve yinelenen desenler ayrı ayrı;
sıra: belge → konum → desenin listedeki sırası; <code>pattern</code> verildiği haliyle yazılır. Atomlar ekrana yazmaz, dosya/ağ
kullanmaz, deterministiktir.</p>

<h2>4. Seçim yöntemi</h2>
<p><b>Veri şekli</b> (<code>src/shape.js</code>, yalnızca akıştaki ilk belgeden): metin uzunluğu n; metnin alfabe büyüklüğü σ ve
<b>etkin alfabe</b> σ<sub>eff</sub> = 1/Σp<sub>c</sub><sup>2</sup> (rastgele iki karakterin eşit olma olasılığının tersi; dengesiz
dağılımda kaymayı σ'dan daha iyi öngörür — kaynak kodda σ = 94 iken girinti boşlukları yüzünden σ<sub>eff</sub> ≈ 10); desen sayısı k
(ve tekilleştirilmiş k); m<sub>min</sub>, m<sub>max</sub>, m<sub>ort</sub>; uzunluk histogramı; desen alfabesi σ<sub>p</sub>; toplam uzunluk M.</p>
<p><b>Maliyet modeli.</b> Her atom <code>selection.features(shape)</code> ile kendi algoritmasının <i>beklenen iş</i> miktarlarını
verir ve molekül tahmini süreyi t̂ = Σ<sub>f</sub> c<sub>f</sub>·x<sub>f</sub> ile hesaplar. Ortak formül: kötü karakter/blok
kaymasının beklentisi, L genişlikli kayma penceresi, s<sub>B</sub> büyüklüğünde blok alfabesi ve k desen için
E = Σ<sub>d=1..L</sub> a<sup>d−1</sup>, a = (1−1/s<sub>B</sub>)<sup>k</sup>. Örneğin Horspool: <code>scan</code> = Σ n / E(m, σ<sub>eff</sub>),
<code>prep</code> = Σ(m+σ<sub>p</sub>), <code>base</code> = 1; HASHq: <code>scan</code> = Σ q·n / E(m−q+1, σ<sub>eff</sub><sup>q</sup>);
Wu-Manber: adım = n / E(L−B+1, σ<sub>eff</sub><sup>B</sup>, k), <code>verify</code> = adım · P(kayma=0) · (1+k/σ<sup>B</sup>);
Aho-Corasick: <code>scan</code> = n, <code>scanMem</code> = n·log<sub>2</sub>(tablo baytı) (önbellek kaçırmaları), <code>prep</code> = (M+1)(σ<sub>p</sub>+1);
suffix array: <code>prep</code> = n log n, <code>query</code> ∝ Σ m log n; FM-index: <code>prep</code> = n log n, <code>occ</code> = nσ/64, <code>query</code> = Σ m.
Katsayılar, kalibrasyon ölçümlerine <b>negatif olmayan, göreli hatayı en aza indiren</b> (ağırlık 1/t²) en küçük kareler ile
öğrenilir (özellik sayısı ≤ 5 olduğundan bütün alt kümeler denenir). Molekül uygulanabilir atomlar arasından en küçük t̂'yi seçer;
<code>applicable(shape)</code> metin döndüren atom (ör. n &gt; 2<sup>24</sup> iken dizin atomları) hiç seçilmez.</p>
<p><b>Neden kural ya da kara kutu sınıflandırıcı değil de bu model?</b> Makine öğrenmesi açısından bu, özellikleri algoritma
analizinden gelen (beklenen kayma, DFA boyutu, n log n), ağırlıkları ölçümden öğrenilen, atom başına ayrı, negatif olmayan doğrusal
bir <b>çalışma süresi regresyonudur</b>. Üç gerekçe: (a) <b>genişletilebilirlik</b> — "girdi → atom adı" öğrenen bir sınıflandırıcı
(ör. karar ağacı) veya elle yazılmış eşikler (ör. "k ≥ 32 ise AC") yeni atom eklendiğinde baştan eğitilmeli/yazılmalıdır; bu modelde
yeni atom <code>registry.register(YeniAtom)</code> ile eklenir, kendi özelliklerini ve varsayılan katsayılarını getirir,
<code>npm run calibrate</code> yalnızca katsayıları günceller; molekülün kodunda hiçbir atom adı yoktur (testte sahte bir atomun molekül
kodu değişmeden seçilmesiyle doğrulanır); (b) <b>az veriyle genelleme</b> — 180 vaka × 12 atomluk küçük bir eğitim kümesinde atom başına
2–4 parametreli, fiziksel anlamı olan bir model aşırı uyuma dayanıklıdır (§6'da örneklem içi/dışı karşılaştırma); (c) <b>açıklanabilirlik</b> —
her kararın gerekçesi özellik × katsayı olarak okunabilir. <b>record</b> kararı ve dayandığı sayıları içerir; GPT-2 eğitim kodunda
(<code>train_gpt2.c</code>) iki çekirdek fonksiyon adı için <code>explain</code> çıktısı (kısaltılmış):</p>
<pre>${c.esc(explainExample())}</pre>

<h2>5. Nasıl test edildi</h2>
<ul>
<li><b>Sözleşme testleri</b> (her atom + molekül): alanlar, 0 tabanlı UTF-16 konum (BMP dışı karakterlerle), örtüşme
(AAAAA/AA → 0,1,2,3), çok belgeli sıralama ve aynı konumda liste sırası, yinelenen desen, ignoreCase'in yalnızca ASCII'yi
etkilemesi (ı/I, é/É negatif kontrolleri), boş metin ve metinden uzun desen, boş desen/boş liste hatası, determinizm;
ayrıca atom kaynaklarında yasak işlev (indexOf, RegExp, console, fs…) taraması.</li>
<li><b>Atom birim testleri:</b> atom başına 14 ortak + 1–3 atoma özgü, sonucu elle hesaplanmış özel durum (periyodik ABAB, tek
karakter, desen alfabesinde olmayan metin karakterleri, m=32/33 sınırı, sentinelde biten eşleşme, he/she/his/hers, m−q+1 karşı örneği…).</li>
<li><b>Doğruluk kanıtı (oracle):</b> her atom ve molekül, NaiveSearch ile eleman eleman karşılaştırıldı: GPT-2 eğitim kaynak dosyası
<code>train_gpt2.c</code> (50 680 karakter; kısa, uzun, API adları, 300 desen, ignoreCase), <b>164 HumanEval problemi</b> (çok belgeli akış,
${int(heTotal)} karakter), eylem izi/hex/kaynak kod/ikili/çok dilli Unicode alfabeleri (m = 1…64), çok tekrarlı metinler
(0<sup>n</sup>, (01)<sup>n</sup>, (UDL)<sup>n</sup>, girinti), karışık uzunluk, yinelenen desen ve <b>400 tohumlu rastgele vaka</b>. Ölçüm
betikleri de her vakada bütün atomların eşleşme sayısının aynı olduğunu denetler.</li>
<li><b>Molekül testleri:</b> record alanları; en düşük tahminin seçilmesi ve maliyet = Σ katsayı×özellik; zorla seçilen her
stratejinin aynı sonucu vermesi; sahte atomun (test içinde kayıt defterine eklenen) molekül kodu değişmeden seçilmesi;
uygulanamaz atomun hiç seçilmemesi. <b>Derlem okuyucu ve CLI testleri:</b> JSONL (CRLF, BOM, eksik/sayısal id, bozuk satırda satır
numaralı hata), düz metin girdi, <code>--format</code>, <code>explain</code>. Toplam 363 test, ~4 s; <code>npm test</code>
bağımlılıksız çalışır.</li>
</ul>

<h2>6. Sonuçlar</h2>
<p><b>Deney düzeni.</b> ${c.esc(m.cpu)}, ${m.cores} mantıksal çekirdek, ${m.memoryGB} GB, ${c.esc(m.platform)}, Node ${m.node} (V8 ${m.v8}).
Her atom × vaka için süre = atomun kurulumu (ön işleme) + arama + çıktı nesnelerinin üretimi. Önce bir ısınma turu, sonra en
az 5 tekrar (toplam ≥ 100 ms olana dek, en çok 21) ve <b>medyan</b>. Isınması 600 ms'yi aşan ölçümler "sansürlü" kaydedildi
(yalnızca çok desenli büyük girdilerde — ör. n = 10⁶, k = 512 — desen başına ayrı geçiş yapan tek desenli atomlar: kaba kuvvet,
KMP, Shift-Or ve Boyer-Moore ailesi; sansürlü hiçbir ölçüm o vakadaki en hızlı sürenin 3 katı yakınında değil). Ön denemede her tekrardan önce
zorla GC yapmanın süreleri 2–6 kat şişirdiği görüldü; GC yalnızca ısınmadan önce bir kez çağrıldı. Ölçümler sırasında makinede
başka ağır iş çalışmadı. <b>Kalibrasyon:</b> 3 alfabe — RL ajan <b>eylem izi</b> (<code>UDLR</code>, σ=4), <b>hex döküm</b> (σ=16) ve
<b>kaynak kod</b> (σ=94, karakter frekansları gerçek kod derleminden) — × n ∈ {10⁴,10⁵,10⁶} × m ∈ {4,8,16,32,64} × k ∈ {1,8,64,512}
= 180 vaka (${c.calMeta.seconds} s). <b>Doğrulama:</b> ${nVal} görülmemiş vaka: farklı tohumlar; n, k, m ızgara noktalarının
<i>arasından</i> (n ≈ 1,4·10⁴…8·10⁵, k = 1…400, sabit veya karışık m = 3…80); kalibrasyonda olmayan iki alfabe (<b>ikili</b>
<code>01</code> ve 62 karakterlik <b>çok dilli</b> Unicode) ve 10 gerçek veri vakası (<code>train_gpt2.c</code>, 4×<code>train_gpt2.c</code>,
HumanEval akışı). Desenlerin yarısı metinden kesildi (kesin eşleşme), yarısı rastgele.</p>
<figure>${c.svg('fig-winners.svg', '92%')}<figcaption><b>Şekil 1.</b> Kalibrasyon ızgarasında en hızlı atom (180 vakada ${winners.size}
farklı atom en az bir kez birinci). Tek desende Horspool ile HASHq bölgeyi paylaşıyor (hex'te kısa desende Horspool,
uzun desende HASHq; eylem izinde m = 4'te Shift-Or, daha uzunda q-gram kayması kullanan HASHq); çok desende Wu-Manber (${winCount('WuManberSearch')}/180 hücre), çok kısa desende (m = 4) Aho-Corasick ve büyük k ile
küçük n'de Rabin-Karp (tek uzunluk grubu, tek kayan özet) kazanıyor. Dizin atomları (suffix array, FM-index) hiçbir hücrede
kazanmıyor: tek geçişlik bir aramada O(n log n) dizin inşası, en çok 512 desenle geri ödenmiyor.</figcaption></figure>
<p><b>Doğrulama tablosu</b> (${nVal} vaka; yavaşlama = seçilen atomun süresi / o vakada en hızlı atomun süresi):</p>
${c.policyTable(v.table)}
<p>Molekül hem ortalamada (geo. ort. ${c.fx(auto.geomeanSlowdown)}) hem de toplam sürede (${c.fx(auto.totalRatio)}) bütün sabit
politikalardan iyi. En güçlü sabit politika "her zaman ${nice(bestSingle.policy.replace('Her zaman ', ''))}" (${c.fx(bestSingle.geomeanSlowdown)},
toplam ${c.fx(bestSingle.totalRatio)}). Tek bir girdi özelliğine bakan iki sabit kural geride kalıyor: <b>klasik kural</b> (k = 1 → Boyer-Moore,
k &gt; 1 → Aho-Corasick) ${c.fx(classic.geomeanSlowdown)}'de, çünkü σ ve m'yi görmediği için Wu-Manber'in kazandığı geniş bölgeyi kaçırıyor;
<b>eşik kuralı</b> (m &lt; 50 → Tuned BM, değilse HASHq) ${c.fx(threshold.geomeanSlowdown)}'de, çünkü çok desenli girdide k ayrı geçiş yapan
tek desenli atomlara bağlı kalıyor. Kalibrasyonda hiç görülmemiş alfabelerde molekülün başarımı kalibre edilmiş alfabelerle aynı düzeyde:
${['binary', 'unicode', 'actions', 'hex', 'code'].map((a) => `${label(a)} ${c.fx(geo(a))}`).join(', ')} (geo. ort. yavaşlama).
Kalibrasyon kümesinde (örneklem içi) molekülün geo. ortalaması ${c.fx(calAuto.geomeanSlowdown)};
görülmemiş veride ${c.fx(auto.geomeanSlowdown)}. Karar maliyeti (veri şekli + 12 tahmin) medyan ${v.decisionMs?.median} ms'dir ve
tabloya dahil değildir.</p>
<figure>${c.svg('fig-ecdf.svg', '66%')}<figcaption><b>Şekil 2.</b> Doğrulama kümesinde yavaşlamanın birikimli dağılımı. Molekül
vakaların ${c.pct(auto.within10Rate)}'ünde en iyinin %10 yakınında; en kötü kuyruk tek bir vakadan (${worst.id}, aşağıda) geliyor,
bu vaka hariç en kötü yavaşlama ${c.fx(second.slowdown)}.</figcaption></figure>
<h3>Yanlış seçimlerin analizi</h3>
${c.wrongTable(wrong, 8)}
<ul>
<li><b>${worst.id} (HumanEval akışı, k=${worst.k}, ${c.fx(worst.slowdown)})</b> — tek büyük hata, sözleşmenin "ilk belgeye bakarak karar ver"
kuralından geliyor. Akışın ilk belgesi (HumanEval/0) yalnızca ${worst.n} karakter; bu kadar kısa bir metinde model
${nice(worst.chosen)}'i seçiyor (n küçükken dizin inşası ucuz). Ama akışta ${docs.length} belge var ve dizin <i>her belge için
yeniden</i> kuruluyor; toplam metin ${int(heTotal)} karakter: ${ms(worst.chosenMs)}'ye karşı ${nice(worst.best)} ${ms(worst.bestMs)}.
Aynı akıştaki diğer iki vaka da ilk belgeye göre yanlış atomu seçiyor ama daha az zararla
(${realStream.filter((r) => r.id !== worst.id).map((r) => `${r.id}: k=${r.shape.k}, ${nice(moleculeChoice(r.shape))}`).join('; ')}); HumanEval akışında geo. ort.
${c.fx(geo('humaneval'))}. Veri şekli toplam akış uzunluğunu ve belge sayısını bilemediği için bu hata kaçınılmaz; bkz. §7.</li>
<li><b>Tek/az desen, kısa metin, &lt; 0,1 ms</b> (${['val-29', 'val-111', 'val-5', 'val-96', 'val-27'].filter(W).join(', ')}): Horspool, HASHq ve
Wu-Manber aynı kayma fikrinin çeşitleri; aralarındaki fark birkaç on mikrosaniye ve büyük ölçüde sabit maliyetlerden (σ<sub>p</sub><sup>q</sup>
veya σ<sub>p</sub><sup>B</sup> hücrelik tablo tahsisi) geliyor. ${W('val-111') ? `Gerçek kodda (${'val-111'}, train_gpt2.c, tek 60 karakterlik desen)
σ<sub>eff</sub> = ${W('val-111').sigmaEff}: girinti boşlukları alfabeyi küçük gösteriyor ve model q-gram kaymasını (HASHq) seçiyor; ölçümde
Horspool ${ms(W('val-111').bestMs)} ile daha hızlı — rastgele metin varsayımının bozulduğu bir örnek. ` : ''}Bu bölgedeki farklar ölçüm gürültüsüne yakın.</li>
<li><b>Görülmemiş ikili alfabe ve uzun desenli kod</b> (${['val-87', 'val-67', 'val-53'].filter(W).join(', ')}): kalibrasyonda σ = 2 hiç yoktu (en küçük
alfabe 4); ikili metinde model Wu-Manber'in blok kaymasını biraz iyimser tahmin ediyor, bit paralel Shift-Or veya Aho-Corasick 1,5–1,6× daha hızlı.
Kod alfabesinde 59 adet 70 karakterlik desende (val-53) Rabin-Karp seçildi; desen başına geçiş yapan Tuned BM, uzun desenlerdeki büyük kaymalarla
1,7× daha hızlıydı.</li>
</ul>
<p>Yanlış seçimlerin ${nVal - Math.round(auto.fastestRate * nVal)} tanesinden ${over2} tanesi 2×'ten kötü${worst ? `; en kötüsü ${worst.id} (${label(worst.alphabet)}, ${c.fx(worst.slowdown)})` : ''}.</p>

<h2>7. Sınırlar</h2>
<ul>
<li><b>İlk belge varsayımı.</b> Karar yalnızca akıştaki ilk belgeye göre verilir (sözleşme). Çok sayıda kısa belgeden oluşan akışlarda
(HumanEval gibi kıyaslama derlemleri, kod deposundaki küçük dosyalar) ilk belge temsilî olmayabilir; özellikle belge başına ön işleme
yapan dizin atomları için maliyet belge sayısıyla çarpılmalıdır. HumanEval'in ilk belgesi 600 karakterken akışın tamamı
${int(heTotal)} karakterdir. Doğal düzeltme, veri şekline "beklenen belge sayısı/toplam uzunluk" eklemektir; akış önceden
bilinmediğinden sözleşme dışıdır.</li>
<li><b>Rastgele metin varsayımı.</b> Beklenen kayma formülleri karakterlerin bağımsız ve σ<sub>eff</sub> ile dağıldığını varsayar.
Gerçek kod bu varsayımı bozar (anahtar sözcükler, girinti blokları, tekrar eden tanımlayıcılar); çok tekrarlı metinlerde (0000…, girinti
boşlukları) Horspool ailesinin en kötü durum davranışı (O(nm)) modelde yoktur; bu girdilerde KMP/Shift-Or/AC daha güvenlidir ama model
bunu görmez.</li>
<li><b>Model hatası.</b> Atom başına medyan göreli hata Ek A'da. Hata özellikle çok küçük sürelerde (&lt; 0,1 ms; JIT ve tahsis
gürültüsü) ve çıktı nesnesi üretiminin baskın olduğu, eşleşmesi çok vakalarda (eylem izi, m=4) büyük. Çıktı maliyeti bütün atomlar için ortak
olduğundan seçimi az etkiler.</li>
<li><b>Tuned BM'nin konumu.</b> Hume-Sunday'in sentinel fikri C'de bedavadır, JavaScript'te O(n) kopya gerektirir; aynı nedenle Horspool,
HASHq ve Wu-Manber metin dizgisi üzerinde doğrudan çalışacak biçimde yazıldı.</li>
<li><b>Makine ve motor bağımlılığı.</b> Katsayılar tek bir makinede (yukarıda) ve V8 ${m.v8} ile ölçüldü; başka bir makinede
<code>npm run calibrate</code> yeniden çalıştırılmalıdır. Dizin atomlarının uygulanabilirlik sınırı (n ≤ 2<sup>24</sup>) bellek tahminidir, ölçülmemiştir.</li>
</ul>

<h2>8. Nasıl kullanılır</h2>
<pre>npm test                                   # bütün testler, bağımlılıksız
node bin/ios.js run ExactMatch --patterns TODO,FIXME [--ignoreCase] [--strategy auto] &lt; derlem.jsonl &gt; cikti.jsonl
node bin/ios.js explain --patterns attention_forward,layernorm_forward &lt; tests/data/train_gpt2.c   # yalnızca karar
node bin/ios.js run ExactMatch --patterns-file desenler.txt --strategy WuManberSearch --input kod.c
node bin/ios.js run ExactMatch --patterns "def ,return " --input tests/data/humaneval.jsonl   # çok belgeli akış
node bin/ios.js list                       # kayıtlı atomlar
npm run calibrate &amp;&amp; npm run bench &amp;&amp; npm run figures &amp;&amp; npm run report</pre>
<pre>import { ExactMatch, registry, parseCorpus } from './src/index.js';
registry.register(MyNewAtom);              // molekül kodu değişmeden seçilebilir hale gelir
const em = new ExactMatch({ patterns: ['torch.', 'self.'], strategy: 'auto' });
for (const m of em.run(parseCorpus(text))) { /* { id, pattern, position, length } */ }
console.log(em.record);                    // { requested, selected, shape, estimates, why }</pre>

<h2>Grup katkıları</h2>
<p style="font-size:8.6pt"><b>Ahmed Berat Özer:</b> ortak atom sınıfı, alfabe küçültme, A grubu atomları (Horspool, Shift-Or, Tuned BM,
HASHq) ve q-gram kayma düzeltmesi, veri şekli, maliyet modeli, <code>ExactMatch</code> molekülü, kayıt defteri, kalibrasyon.
<b>Görkem Özer:</b> B/C/D grubu atomları (KMP, Rabin-Karp, Aho-Corasick, Wu-Manber, suffix array, FM-index), sözleşme/oracle/rastgele
testler, JSONL derlem okuyucu ve komut satırı, doğrulama kümesi, politika karşılaştırması ve şekiller. <b>Birlikte:</b> deney tasarımı,
yanlış seçim analizi, rapor, sunum.</p>

<h2>Kaynaklar ve araçlar</h2>
<p style="font-size:8.4pt">Boyer R.S., Moore J.S. (1977) CACM 20(10):762–772 · Horspool R.N. (1980) SP&amp;E 10(6):501–506 ·
Hume A., Sunday D. (1991) Fast string searching, SP&amp;E 21(11):1221–1248 · Lecroq T. (2007) Fast exact string matching algorithms, IPL 102(6):229–235 ·
Knuth D., Morris J., Pratt V. (1977) SIAM J. Comput. 6(2):323–350 · Karp R.M., Rabin M.O. (1987) IBM J. R&amp;D 31(2):249–260 ·
Baeza-Yates R., Gonnet G.H. (1992) CACM 35(10):74–82 · Aho A.V., Corasick M.J. (1975) CACM 18(6):333–340 · Wu S., Manber U. (1994) TR-94-17, Univ. Arizona ·
Manber U., Myers G. (1993) SIAM J. Comput. 22(5):935–948 · Ferragina P., Manzini G. (2000) FOCS 390–398 · Charras C., Lecroq T., Exact String Matching Algorithms (çevrimiçi) ·
Rice J.R. (1976) The algorithm selection problem, Advances in Computers 15:65–118 · Hutter F., Xu L., Hoos H.H., Leyton-Brown K. (2014) Algorithm runtime prediction:
Methods &amp; evaluation, Artificial Intelligence 206:79–111 · Chen M. vd. (2021) Evaluating large language models trained on code, arXiv:2107.03374 (HumanEval) ·
Internet of Science: hub.ioscience.org/p/learn/, ioscience.org/articles/components/ · Veri: karpathy/llm.c <code>train_gpt2.c</code> (MIT, commit f1e2ace),
openai/human-eval <code>HumanEval.jsonl</code> (MIT, commit b9453e8); kaynak ve lisans metinleri <code>tests/data/README.md</code>.<br>
<b>Yapay zekâ aracı:</b> Kodun, testlerin, ölçüm betiklerinin ve bu rapor taslağının hazırlanmasında bir YZ kodlama asistanı
(Claude Code) kullanıldı. Bütün doğruluk iddiaları oracle testleriyle, bütün performans iddiaları depodaki ham
ölçümlerle (bench/results/) desteklenmektedir. [Ders politikasına göre düzenleyin.]</p>

<div class="appendix">
<h2>Ek A. Kalibrasyon: öğrenilen katsayılar ve model hatası</h2>
${c.fitTable(c.fits)}
<div class="two"><figure>${c.svg('fig-model.svg', '55%')}<figcaption><b>Şekil A1.</b> Doğrulama kümesinde bütün atomlar için tahmin edilen ve ölçülen süreler (log-log; kesikli çizgi y = x).</figcaption></figure></div>
<h2>Ek B. Kalibrasyon kümesinde (örneklem içi) politikalar</h2>
${c.policyTable(c.calTable.table)}
<figure>${c.svg('fig-molecule.svg', '92%')}<figcaption><b>Şekil B1.</b> Kalibrasyon ızgarasında molekülün seçimi; ✓ en hızlı atomun
seçildiğini, sayı yavaşlamayı gösterir; kalın çerçeve &gt; 1,5×.</figcaption></figure>
<h2>Ek C. Ham veriler</h2>
<p><code>bench/results/calibration-raw.json</code> (180 vaka × 12 atom: süre, tekrar sayısı, sansür, özellikler),
<code>calibration-fit.json</code>, <code>validation-raw.json</code>, <code>validation-table.{json,md}</code>, <code>figures/*.svg</code>.
Bütün vakalar tohumdan yeniden üretilebilir (<code>bench/cases.js</code>).</p>
</div>`;
}
