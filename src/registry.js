// Kayıt defteri (registry): text.pattern-match.exact görevini yapan atomlar.
// Yeni bir atom eklemek için yalnızca `registry.register(YeniAtom)` çağrılır; molekül
// kayıt defterini gezerek karar verir, kendi kodunda hiçbir atom adı geçmez.

import { TASK } from './atomic/ExactSearchAtom.js';
import { NaiveSearch } from './atomic/NaiveSearch.js';
import { BoyerMooreSearch } from './atomic/BoyerMooreSearch.js';
import { HorspoolSearch } from './atomic/HorspoolSearch.js';
import { ShiftOrSearch } from './atomic/ShiftOrSearch.js';
import { TunedBoyerMooreSearch } from './atomic/TunedBoyerMooreSearch.js';
import { HashQSearch } from './atomic/HashQSearch.js';
import { KmpSearch } from './atomic/KmpSearch.js';
import { RabinKarpSearch } from './atomic/RabinKarpSearch.js';
import { AhoCorasickSearch } from './atomic/AhoCorasickSearch.js';
import { WuManberSearch } from './atomic/WuManberSearch.js';
import { SuffixArraySearch } from './atomic/SuffixArraySearch.js';
import { FmIndexSearch } from './atomic/FmIndexSearch.js';

export class Registry {
  #atoms = new Map();

  constructor(task = TASK) {
    this.task = task;
  }

  /** Bir atom sınıfını kaydeder; sözleşmeye uymayan sınıfları reddeder. */
  register(AtomClass) {
    const mf = AtomClass?.manifest;
    if (!mf || typeof mf.name !== 'string') throw new TypeError('atomun static manifest.name alanı yok');
    if (mf.kind !== 'atom') throw new TypeError(`${mf.name}: manifest.kind 'atom' olmalı`);
    if (mf.task !== this.task) throw new TypeError(`${mf.name}: görev ${mf.task}, beklenen ${this.task}`);
    const sel = AtomClass.selection;
    if (!sel || typeof sel.features !== 'function' || typeof sel.defaults !== 'object') {
      throw new TypeError(`${mf.name}: static selection { features, defaults } gerekli`);
    }
    if (typeof AtomClass.prototype.process !== 'function') throw new TypeError(`${mf.name}: process() yok`);
    this.#atoms.set(mf.name, AtomClass);
    return this;
  }

  unregister(name) {
    return this.#atoms.delete(name);
  }

  has(name) {
    return this.#atoms.has(name);
  }

  get(name) {
    return this.#atoms.get(name);
  }

  names() {
    return [...this.#atoms.keys()];
  }

  list() {
    return [...this.#atoms.values()];
  }

  /** Bağımsız bir kopya (testlerde global kayıt defterini kirletmemek için). */
  clone() {
    const r = new Registry(this.task);
    for (const A of this.list()) r.register(A);
    return r;
  }
}

export const BUILTIN_ATOMS = [
  NaiveSearch,
  BoyerMooreSearch,
  HorspoolSearch,
  ShiftOrSearch,
  TunedBoyerMooreSearch,
  HashQSearch,
  KmpSearch,
  RabinKarpSearch,
  AhoCorasickSearch,
  WuManberSearch,
  SuffixArraySearch,
  FmIndexSearch,
];

/** Varsayılan (global) kayıt defteri. */
export const registry = new Registry();
for (const A of BUILTIN_ATOMS) registry.register(A);
