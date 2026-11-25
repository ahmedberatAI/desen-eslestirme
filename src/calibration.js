// Kalibrasyon katsayıları: `npm run calibrate` ölçümlerden src/calibration.json dosyasını üretir.
// Dosya yoksa veya bir atom dosyada yoksa atomun selection.defaults değerleri kullanılır.

import { readFileSync } from 'node:fs';

const FILE = new URL('./calibration.json', import.meta.url);

let cached;

export function loadCalibration() {
  if (cached !== undefined) return cached;
  try {
    cached = JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    cached = null;
  }
  return cached;
}

/** Bir atomun katsayıları: kalibrasyon dosyası > selection.defaults. */
export function coefficientsFor(AtomClass, calibration = loadCalibration()) {
  const name = AtomClass.manifest.name;
  const fitted = calibration?.atoms?.[name]?.coefficients;
  if (fitted) return { coefficients: { ...AtomClass.selection.defaults, ...fitted }, source: 'calibration' };
  return { coefficients: { ...AtomClass.selection.defaults }, source: 'defaults' };
}

export const CALIBRATION_FILE = FILE;
