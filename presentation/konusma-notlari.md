# Sunum konuşma notları — 5 dakika

**YZM327 Yapay Zeka için Yazılım Mühendisliği · Vize Projesi**
**Ahmed Berat Özer & Görkem Özer**

Açmak için: `presentation/sunum.html` dosyasını tarayıcıda açın → `f` tam ekran, `→`/boşluk ileri, `←` geri.
Sağ altta geçen süre görünür. Yedek: `presentation/sunum.pdf`. Canlı demo: `presentation/demo/demo.ps1`
(önceden bir terminalde depo kökünde açık tutun; internet gerekmez).

| # | Slayt | Konuşan | Süre | Bitiş |
|---|---|---|---:|---:|
| 1 | Kapak | Ahmed Berat | 15 sn | 0:15 |
| 2 | Problem | Ahmed Berat | 35 sn | 0:50 |
| 3 | Atomlar | Görkem | 45 sn | 1:35 |
| 4 | Molekül | Ahmed Berat | 45 sn | 2:20 |
| 5 | Canlı demo | Ahmed Berat | 45 sn | 3:05 |
| 6 | Sonuçlar | Görkem | 50 sn | 3:55 |
| 7 | Yanlış seçim | Görkem | 35 sn | 4:30 |
| 8 | Özet | Ahmed Berat | 30 sn | 5:00 |

---

### 1 · Kapak — Ahmed Berat (15 sn)
"Merhaba, ben Ahmed Berat Özer, bu Görkem Özer. Projemiz Internet of Science için akıllı tam desen eşleştirme:
kaynak kodda, loglarda ve yapay zekâ derlemlerinde desenlerin bütün konumlarını bulan atomlar ve bunlar arasından
girdiye göre seçim yapan bir molekül."

### 2 · Problem — Ahmed Berat (35 sn)
"Kod tabanında bir API adını aramak, depoda sızmış anahtar aramak ya da bir LLM'in eğitim verisinde HumanEval gibi bir
kıyaslamanın parçalarını aramak — hepsi aynı işe çıkıyor: bu desenler metnin neresinde? Bunun için onlarca algoritma
var ama hiçbiri her durumda en hızlı değil. Sağdaki harita bizim ölçümlerimiz: her hücre bir girdi şekli — satırlar
desen sayısı, sütunlar desen uzunluğu — renk o durumda en hızlı atom. 180 vakada 9 farklı atom birinci oldu.
Tek desende Horspool ve q-gram kayması kullanan HASHq, çok desende Wu-Manber — 180 hücrenin 88'inde —, çok kısa desende Aho-Corasick, küçük metinde çok desende Rabin-Karp öne çıkıyor. Yani soru 'hangi algoritma?' değil, 'bu girdi için hangisi?' — yapay zekâdaki adıyla bir algoritma seçimi problemi."

### 3 · Atomlar — Görkem (45 sn)
"Dört gruptan on yeni atom yazdık; başlangıç paketindeki Naive ve Boyer-Moore ile on iki. Hepsi aynı sözleşmeye
uyuyor: aynı girdi, aynı çıktı, örtüşen eşleşmeler, aynı sıralama. Doğrulama ve sıralama ortak sınıfta, her atom
yalnızca aramayı yapıyor. Wu-Manber ve FM-index bonus atomlar.
Önemli bir nokta: q-gram kayması kullanan HASHq'da, desende hiç geçmeyen bir q-gram görülünce m kadar kaydırmak cazip
ama yanlış. Örnekte abc deseni xyabc metninde kaçıyor. Doğru kayma m eksi q artı bir; bunu birim testine koyduk, testte
q'nun gerçekten 2 seçildiğini de denetliyoruz. Atomlarda indexOf ya da RegExp yok, bunu bir test kaynak kodu tarayarak denetliyor."

### 4 · Molekül — Ahmed Berat (45 sn)
"Molekül kural tablosu kullanmıyor, ölçümle öğrenilen bir maliyet modeli kullanıyor. Önce ilk belgeden veri şeklini
çıkarıyor: metin uzunluğu, alfabe, etkin alfabe, desen sayısı ve uzunlukları. Sonra her atom kendi beklenen işini
söylüyor; örneğin Horspool için beklenen kayma sayısı. Bunları 180 vakalık ölçümle öğrendiğimiz katsayılarla çarpıyoruz,
en ucuz tahmini seçiyoruz. Makine öğrenmesi diliyle: atom başına açıklanabilir bir çalışma süresi regresyonu. Neden kara
kutu bir sınıflandırıcı değil? Çünkü yeni atom eklenince sınıflandırıcıyı baştan eğitmek gerekir; burada molekülün kodunda
tek bir atom adı yok. Yeni atom bir satırla kayıt defterine ekleniyor; testte sahte bir atom ekleyip molekül değişmeden
seçildiğini gösteriyoruz."

### 5 · Canlı demo — Ahmed Berat (45 sn)
*(terminale geç: `demo.ps1`, adım 1 ve 2; zaman kalırsa 3)*
"Veri, GPT-2'yi saf C ile eğiten llm.c projesinin kaynak dosyası. Önce tek bir çekirdek fonksiyonu, attention_forward'u
arıyorum. explain yalnızca kararı yazıyor: veri şekli, tahminler, neden. Tek desen için q-gram kayması kullanan HASHq
seçildi; ikinci Wu-Manber yüzde on sekiz daha pahalı. Aynı dosyada 300 sembolü — fonksiyon ve değişken adlarını —
birlikte aratınca karar çok desenli Wu-Manber'e dönüyor. run komutu eşleşmeleri JSONL olarak yazıyor: fonksiyonun tanımı
ve çağrıldığı yer."
*Yedek plan: demo çalışmazsa slayttaki çıktıyı anlat.*

### 6 · Sonuçlar — Görkem (50 sn)
"Doğrulamayı kalibrasyonda hiç kullanmadığımız 120 vakada yaptık: farklı tohumlar, ızgara noktalarının arası,
iki yeni alfabe — ikili ve çok dilli Unicode — ve gerçek veri: GPT-2 kodu ve HumanEval. Her ölçüm ısınma turu ve en az
beş tekrarın medyanı. Molekül vakaların yüzde 80,8'inde en hızlıyı seçti, ortalama yavaşlama 1,09 kat. En iyi sabit
seçenek 'her zaman Wu-Manber' 1,25 kat; toplam sürede de 1,29'a karşı 1,50. Tek özelliğe bakan iki sabit kural geride:
'tek desende Boyer-Moore, çok desende Aho-Corasick' kuralı 2,6 kat, desen uzunluğu eşiği kuralı 7,4 kat. Görülmemiş
alfabelerde de molekül aynı kalitede: 1,03 ile 1,06 kat arası. Sağdaki eğri: molekül vakaların yüzde 83'ünde en iyinin
yüzde on yakınında."

### 7 · Yanlış seçim — Görkem (35 sn)
"En kötü vakamızı saklamıyoruz: 20 kat. 164 HumanEval probleminden oluşan bir akış. Sözleşme gereği karar ilk belgeye
göre veriliyor; ilk belge yalnızca 600 karakter, bu yüzden dizin kurmak ucuz görünüyor ve suffix array seçiliyor. Ama
dizin 164 belgenin her biri için yeniden kuruluyor. Kök neden veri şeklinin akışın uzunluğunu bilememesi. Bu vaka
dışında en kötü yavaşlama 2,9 kat. Çözüm önerimiz veri şekline belge sayısını eklemek; raporda tartıştık."

### 8 · Özet — Ahmed Berat (30 sn)
"Özetle: on iki atom, 363 test, 400 rastgele vakada oracle ile birebir aynı sonuç, 300 ölçülmüş vaka; gerçek veri olarak
GPT-2 eğitim kodu ve HumanEval. Sınırlarımız: ilk belge varsayımı, rastgele metin varsayımı ve makineye bağlı katsayılar.
Her şey tek komutla yeniden üretilebilir. Teşekkürler, sorularınızı alalım."

---

## Olası sorular ve kısa cevaplar

- **Bunun yapay zekâyla ilgisi ne?** İki yönden: (1) veri — LLM eğitim derlemlerinde kıyaslama sızıntısı taraması, çıktı
  kara listeleri, özel token araması tam desen eşleştirmedir; gerçek veri olarak HumanEval ve GPT-2 eğitim kodunu kullandık.
  (2) yöntem — molekül bir algoritma seçimi problemi çözüyor (Rice 1976): ölçümlerden öğrenilen bir çalışma süresi
  modeliyle (Hutter vd. 2014) en ucuz atomu seçiyor.
- **Neden kural ya da sınıflandırıcı değil de maliyet modeli?** Yeni atom eklenince kurallar elle yeniden yazılmalı,
  sınıflandırıcı yeniden eğitilmeli; modelde atom kendi özelliklerini getirir, `npm run calibrate` yalnızca katsayıları
  günceller. Molekül kodu değişmez. Ayrıca 180 vakalık küçük veride az parametreli model aşırı uyuma dayanıklı ve açıklanabilir.
- **σ_eff nedir?** 1/Σp²: rastgele iki karakterin eşit olma olasılığının tersi. Kaynak kodda σ = 94 ama girinti boşlukları
  yüzünden σ_eff ≈ 6–10; kaymayı σ'dan daha iyi öngörüyor.
- **Katsayılar nasıl bulundu?** Negatif olmayan, göreli hatayı (ağırlık 1/t²) en aza indiren en küçük kareler;
  özellik sayısı ≤ 5 olduğu için bütün alt kümeler deneniyor.
- **Tuned BM neden neredeyse hiç kazanmadı?** Sentinel için JavaScript'te metni kopyalamak gerekiyor (dizgiler değiştirilemez);
  bu O(n) kopya, C'deki avantajı siliyor. Horspool aynı fikri kopyasız uyguluyor.
- **Dizin atomları neden kazanmıyor?** Tek seferlik aramada O(n log n) inşa en çok 512 desenle geri ödenmiyor;
  binlerce desen ve kısa metinde rekabetçiler.
- **Doğruluğu nasıl garanti ettiniz?** Her atom ve molekül, NaiveSearch ile eleman eleman karşılaştırılıyor: train_gpt2.c,
  HumanEval, 5 alfabe, tekrarlı metinler ve 400 tohumlu rastgele vaka. Ölçüm betikleri de her vakada eşleşme sayılarını
  çapraz kontrol ediyor.
- **Ölçüm gürültüsü?** Isınma + ≥ 5 tekrar medyanı; 0,1 ms altındaki farkları yorumlamıyoruz.
- **Kim ne yaptı?** Ahmed Berat: A grubu atomlar, veri şekli, maliyet modeli, molekül, kalibrasyon. Görkem: B/C/D
  grubu atomlar, testler, JSONL okuyucu ve CLI, doğrulama ve şekiller. Rapor ve deney tasarımı birlikte.
