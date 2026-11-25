// ExactMatch molekülü: aynı görevi (text.pattern-match.exact) yapan atomlar arasından
// girdinin şekline göre en ucuz olacağı tahmin edileni seçer.
//
// Seçim yöntemi: maliyet modeli (algoritma seçimi problemi, Rice 1976; ölçümlerden öğrenilen
// çalışma süresi tahmini, Hutter vd. 2014). Her atom `selection.features(shape)` ile beklenen iş
// miktarlarını (ör. kayma sayısı, ön işleme hücresi) hesaplar; molekül bunları kalibrasyonla
// bulunan katsayılarla çarpıp toplar (tahmini saniye) ve en küçüğünü seçer.
// Molekülün kodunda hiçbir atom adı geçmez: atomlar kayıt defterinden (registry) okunur.

import { TASK, validateParams } from '../atomic/ExactSearchAtom.js';
import { registry as defaultRegistry } from '../registry.js';
import { computeShape } from '../shape.js';
import { coefficientsFor, loadCalibration } from '../calibration.js';

export class ExactMatch {
  static manifest = {
    name: 'ExactMatch', version: '0.1.0', kind: 'molecule', task: TASK,
    title: 'Exact match (shape-aware selector)',
    references: ['Rice 1976', 'Hutter et al. 2014'],
  };

  /**
   * @param {object} params
   * @param {string[]} params.patterns
   * @param {boolean} [params.ignoreCase=false]
   * @param {string}  [params.strategy='auto']  'auto' veya kayıtlı bir atom adı
   * @param {Registry} [params.registry]        varsayılan: global kayıt defteri
   * @param {object|null} [params.calibration]  varsayılan: src/calibration.json
   */
  constructor(params = {}) {
    const { patterns, ignoreCase } = validateParams(params);
    const strategy = params.strategy ?? 'auto';
    this.registry = params.registry ?? defaultRegistry;
    this.calibration = params.calibration === undefined ? loadCalibration() : params.calibration;
    if (typeof strategy !== 'string') throw new TypeError('strategy bir dizgi olmalı');
    if (strategy !== 'auto' && !this.registry.has(strategy)) {
      throw new RangeError(
        `Bilinmeyen strateji "${strategy}". Geçerli seçenekler: auto, ${this.registry.names().join(', ')}`,
      );
    }
    this.params = { patterns, ignoreCase };
    this.strategy = strategy;
    this.atom = null;
    this.record = { requested: strategy, selected: null, shape: null, estimates: [], why: 'henüz karar verilmedi' };
  }

  /** Bütün atomların tahmini maliyetleri (artan sırada; uygulanamayanlar sonda). */
  estimate(shape) {
    const rows = [];
    for (const A of this.registry.list()) {
      const name = A.manifest.name;
      const sel = A.selection;
      let applicable = true;
      if (typeof sel.applicable === 'function') {
        const a = sel.applicable(shape);
        applicable = a === true ? true : typeof a === 'string' && a ? a : 'uygulanamaz';
      }
      const { coefficients, source } = coefficientsFor(A, this.calibration);
      if (applicable !== true) {
        rows.push({ atom: name, applicable, cost: null, features: null, coefficients, source });
        continue;
      }
      const features = sel.features(shape);
      let cost = 0;
      for (const [f, v] of Object.entries(features)) {
        const c = coefficients[f];
        if (typeof c !== 'number') throw new Error(`${name}: '${f}' özelliği için katsayı yok`);
        cost += c * v;
      }
      rows.push({ atom: name, applicable: true, cost, features: roundObj(features), coefficients, source });
    }
    rows.sort((a, b) => {
      if (a.cost === null) return b.cost === null ? 0 : 1;
      if (b.cost === null) return -1;
      return a.cost - b.cost;
    });
    return rows;
  }

  /** Akıştaki ilk belgeye bakarak atomu seçer ve record'u doldurur. */
  decide(firstDoc) {
    const shape = computeShape(firstDoc ?? { id: '', text: '' }, this.params);
    const estimates = this.estimate(shape);
    let selected;
    let why;
    const fmt = (s) => (s < 1e-3 ? `${(s * 1e6).toFixed(1)} µs` : `${(s * 1e3).toFixed(3)} ms`);
    const shapeTxt = `n=${shape.n}, σ=${shape.sigma} (σ_eff=${shape.sigmaEff}), k=${shape.k}, m=${shape.mMin}..${shape.mMax} (ort. ${shape.mAvg})`;
    if (this.strategy === 'auto') {
      const ok = estimates.filter((e) => e.applicable === true);
      if (ok.length === 0) throw new Error('Bu girdi için uygulanabilir atom yok');
      selected = ok[0].atom;
      const second = ok[1];
      why = `auto: ${shapeTxt}. En düşük tahmini maliyet ${selected} (${fmt(ok[0].cost)})` +
        (second ? `; ikinci ${second.atom} (${fmt(second.cost)}, ×${(second.cost / ok[0].cost).toFixed(2)}).` : '.');
      const skipped = estimates.filter((e) => e.applicable !== true);
      if (skipped.length) why += ` Uygulanamaz: ${skipped.map((e) => `${e.atom} (${e.applicable})`).join('; ')}.`;
    } else {
      selected = this.strategy;
      const mine = estimates.find((e) => e.atom === selected);
      const best = estimates.find((e) => e.applicable === true);
      why = `strateji kullanıcı tarafından zorlandı: ${selected}. ${shapeTxt}.`;
      if (mine?.cost != null && best) why += ` Tahmini maliyet ${fmt(mine.cost)}; model ${best.atom} (${fmt(best.cost)}) seçerdi.`;
    }
    this.record = { requested: this.strategy, selected, shape, estimates, why };
    this.atom = new (this.registry.get(selected))(this.params);
    return this.record;
  }

  /** Corpus.Document akışını işler; bütün akış için aynı atom kullanılır. */
  *run(docs) {
    let first = true;
    for (const doc of docs) {
      if (first) {
        this.decide(doc);
        first = false;
      }
      yield* this.atom.process(doc);
    }
    if (first) this.record = { ...this.record, why: 'akış boş: karar verilmedi' };
  }
}

function roundObj(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = Number.isFinite(v) ? Number(v.toPrecision(6)) : v;
  return r;
}
