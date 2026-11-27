// Tarayıcı ara katmanı: src/calibration.js `node:fs` içe aktarır. Tarayıcıda dosya sistemi yoktur;
// bu yüzden readFileSync hata fırlatır ve loadCalibration() null döner. Arayüz kalibrasyon dosyasını
// fetch ile okuyup ExactMatch'e `calibration` parametresiyle verir, yani katsayılar yine kullanılır.
export function readFileSync() {
  throw new Error('node:fs tarayıcıda yok');
}
export default { readFileSync };
