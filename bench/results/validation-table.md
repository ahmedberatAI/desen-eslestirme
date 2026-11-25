# Doğrulama tablosu

Makine: Intel(R) Core(TM) Ultra 9 275HX, 24 çekirdek, Windows_NT 10.0.26200 x64, Node v24.15.0

Vaka sayısı: 120 (kalibrasyonda kullanılmayan tohumlar, ızgara arası değerler, yeni alfabeler: binary, unicode; gerçek veri: llm.c train_gpt2.c, HumanEval).
Ölçüm: her atom × vaka için 1 ısınma + ≥5 tekrarın medyanı. Molekül karar süresi: medyan 0.0669 ms, en çok 0.3346 ms (tabloya dahil değil).

| Politika | En hızlıyı seçme | %10 içinde | Yavaşlama (geo. ort.) | En kötü yavaşlama | Toplam süre / en iyi |
|---|---:|---:|---:|---:|---:|
| **ExactMatch (auto)** | 80.8% | 83.3% | 1.09× | 20.50× (val-116) | 1.29× |
| Her zaman WuManberSearch | 62.5% | 66.7% | 1.25× | 5.42× (val-51) | 1.50× |
| Klasik kural (k=1 → Boyer-Moore, k>1 → Aho-Corasick) | 17.5% | 19.2% | 2.64× | 13.90× (val-106) | 1.74× |
| Her zaman AhoCorasickSearch | 17.5% | 18.3% | 2.75× | 13.90× (val-106) | 1.74× |
| Her zaman HashQSearch | 8.3% | 10.0% | 4.66× | 54.55× (val-2) | 13.22× |
| Eşik kuralı (m<50 → TunedBM, değilse HASHq) | 3.3% | 4.2% | 7.38× | 218.34× (val-2) | 25.57× |
| Her zaman RabinKarpSearch | 3.3% | 3.3% | 8.02× | 97.46× (val-45) | 12.77× |
| Her zaman TunedBoyerMooreSearch | 1.7% | 1.7% | 8.56× | 218.34× (val-2) | 25.80× |
| Her zaman BoyerMooreSearch | 0.0% | 1.7% | 9.12× | 266.28× (val-2) | 28.16× |
| Her zaman HorspoolSearch | 5.8% | 6.7% | 9.32× | 302.05× (val-2) | 34.59× |
| Her zaman ShiftOrSearch | 0.8% | 0.8% | 17.33× | 243.24× (val-2) | 40.43× |
| Her zaman SuffixArraySearch | 0.0% | 0.0% | 22.94× | 237.25× (val-118) | 16.47× |
| Her zaman FmIndexSearch | 0.0% | 0.0% | 24.31× | 267.76× (val-118) | 17.40× |
| Her zaman KmpSearch | 0.0% | 0.8% | 27.73× | 719.60× (val-2) | 78.75× |
| Her zaman NaiveSearch | 0.0% | 0.0% | 38.10× | 950.63× (val-2) | 101.06× |

## Molekülün en kötü 10 yanlış seçimi

| Vaka | Alfabe | n | σ (σ_eff) | k | m | Seçilen | En hızlı | Yavaşlama |
|---|---|---:|---|---:|---|---|---|---:|
| val-116 | humaneval | 600 | 50 (10.186) | 30 | 4–10 | SuffixArraySearch (17.389 ms) | AhoCorasickSearch (0.8482 ms) | 20.50× |
| val-29 | hex | 14796 | 16 (15.991) | 5 | 18–26 | WuManberSearch (0.0947 ms) | HashQSearch (0.0326 ms) | 2.90× |
| val-111 | gpt2 | 50680 | 78 (6.198) | 1 | 60–60 | HashQSearch (0.0471 ms) | HorspoolSearch (0.0204 ms) | 2.31× |
| val-5 | actions | 21593 | 4 (3.999) | 6 | 37–37 | WuManberSearch (0.0832 ms) | HashQSearch (0.0432 ms) | 1.93× |
| val-117 | humaneval | 600 | 50 (10.186) | 300 | 5–12 | WuManberSearch (3.1013 ms) | AhoCorasickSearch (1.7715 ms) | 1.75× |
| val-53 | code | 28390 | 90 (10.527) | 59 | 70–70 | RabinKarpSearch (0.4116 ms) | TunedBoyerMooreSearch (0.2455 ms) | 1.68× |
| val-87 | binary | 186883 | 2 (2) | 1 | 11–11 | WuManberSearch (0.4631 ms) | ShiftOrSearch (0.2923 ms) | 1.58× |
| val-96 | unicode | 31238 | 62 (61.785) | 1 | 37–37 | HashQSearch (0.0427 ms) | HorspoolSearch (0.0272 ms) | 1.57× |
| val-27 | hex | 74663 | 16 (15.984) | 3 | 29–29 | WuManberSearch (0.0719 ms) | HashQSearch (0.0483 ms) | 1.49× |
| val-67 | binary | 419549 | 2 (2) | 10 | 15–41 | WuManberSearch (1.3333 ms) | AhoCorasickSearch (0.9034 ms) | 1.48× |

## Kalibrasyon kümesi (örneklem içi, 180 vaka)

| Politika | En hızlıyı seçme | %10 içinde | Yavaşlama (geo. ort.) | En kötü yavaşlama | Toplam süre / en iyi |
|---|---:|---:|---:|---:|---:|
| **ExactMatch (auto)** | 74.4% | 78.9% | 1.09× | 3.97× (cal-12) | 1.03× |
| Her zaman WuManberSearch | 48.9% | 55.0% | 1.28× | 26.51× (cal-138) | 1.26× |
| Klasik kural (k=1 → Boyer-Moore, k>1 → Aho-Corasick) | 13.3% | 16.1% | 2.54× | 33.67× (cal-159) | 1.76× |
| Her zaman AhoCorasickSearch | 12.8% | 14.4% | 3.06× | 33.67× (cal-159) | 1.87× |
| Her zaman RabinKarpSearch | 12.8% | 16.1% | 3.49× | 56.60× (cal-176) | 2.24× |
| Her zaman HashQSearch | 12.2% | 16.1% | 5.69× | 173.45× (cal-143) | 25.13× |
| Eşik kuralı (m<50 → TunedBM, değilse HASHq) | 5.0% | 5.6% | 7.63× | 563.06× (cal-55) | 28.92× |
| Her zaman HorspoolSearch | 7.8% | 8.3% | 9.18× | 948.67× (cal-59) | 44.59× |
| Her zaman TunedBoyerMooreSearch | 0.6% | 0.6% | 9.61× | 644.17× (cal-59) | 32.54× |
| Her zaman BoyerMooreSearch | 0.6% | 1.7% | 10.77× | 697.24× (cal-59) | 45.84× |
| Her zaman ShiftOrSearch | 2.8% | 3.3% | 18.18× | 2108.68× (cal-119) | 72.55× |
| Her zaman SuffixArraySearch | 0.0% | 0.0% | 21.63× | 653.42× (cal-116) | 17.59× |
| Her zaman FmIndexSearch | 0.0% | 0.0% | 24.66× | 750.63× (cal-116) | 18.56× |
| Her zaman KmpSearch | 1.7% | 3.3% | 29.06× | 2688.22× (cal-59) | 139.58× |
| Her zaman NaiveSearch | 0.0% | 2.2% | 38.25× | 3011.06× (cal-59) | 173.32× |
