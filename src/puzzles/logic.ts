/**
 * The four mechanisms you work with your judgment.
 *
 * Nothing in this file can be brute-forced and nothing in it is a quiz. Each
 * one is an apparatus that answers a question honestly the moment the question
 * is put to it properly: a card drawer that will sort itself if you can name
 * the object rather than the words, a light table that tells you where a ship
 * actually was, a ruled form that will not agree however many times you cast
 * it, and a Board that strikes anything you cannot hold up to a window.
 *
 *   puz-postmasters-register   The Machine That Cannot Lie — two registers, one book
 *   puz-forty-seven-cards      The Forty-Seven Cards   — sorting frame, collation
 *   puz-reconciliation         The Third Column        — three books, one form
 *   puz-board-of-dissolution   The Board of Dissolution — eight links, cited
 *
 * A fifth, `chartLoftLogicVariant`, is a complete take on the Chart Loft that
 * the sensory batch ended up owning; it is kept compiled and unregistered.
 *
 * Four rules hold across all four.
 *
 * 1. THE APPARATUS IS THE ARGUMENT. Every control is a physical fitting — a
 *    dial, a lever, a key, a pair of dividers — built out of the shared
 *    primitives in `puzzle-host` so the detent weight and the keyboard
 *    contract are the same here as everywhere else in the game.
 * 2. THE CHECK IS CONTINUOUS wherever the fiction allows it. A sorting frame
 *    knows the instant its three dials isolate the right set. The exceptions
 *    are the deliberate physical acts the drama wants weight on: carrying a
 *    page forward, casting a column, reading a link out loud to a Board.
 * 3. NOTHING IS SIGNALLED BY HUE ALONE. A drawn card is also lifted and
 *    ticked; a registered overlay is also clipped and captioned; a struck link
 *    is also ruled through and stamped with the word.
 * 4. NO DEAD ENDS. A player who never recovered an exhibit can still read the
 *    link and hear it struck. Being wrong is always available, always legible,
 *    and always survivable.
 */

import type { PuzzleContext, PuzzleModule } from '@/engine/types';
import {
  makeDial,
  makeDraggable,
  makeRotatable,
  makeSlider,
  registerPuzzle,
  type Control,
  type FeedbackFn,
} from '@/ui/puzzle-host';

import '@/styles/puzzles-logic.css';

// ===========================================================================
// Shared kit
//
// Deliberately duplicated from the other puzzle batches rather than imported
// across them: a mechanism in this file must not stop compiling because a
// convenience in somebody else's file was renamed.
// ===========================================================================

type Cleanable = { destroy(): void };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Builds an element without four lines of property assignment. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** A div with children, for the two dozen places that want one. */
function box(className: string, ...kids: (Node | string)[]): HTMLDivElement {
  const d = h('div', className);
  d.append(...kids);
  return d;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className = '',
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  if (className) node.setAttribute('class', className);
  return node;
}

function attrs<T extends Element>(node: T, map: Record<string, string | number>): T {
  for (const [k, v] of Object.entries(map)) node.setAttribute(k, String(v));
  return node;
}

/** A button that looks like a struck brass key rather than a form control. */
function key(label: string, cls = ''): HTMLButtonElement {
  const b = h('button', `lg-key ${cls}`.trim());
  b.type = 'button';
  b.append(h('span', 'lg-key-face', label));
  return b;
}

/** Small engraved caption. Every fitting on these benches is named. */
const cap = (text: string, cls = '') => h('span', `lg-cap ${cls}`.trim(), text);

/** A cast or printed instruction plate — the thing that saves you guessing. */
function plate(heading: string, lines: string[], cls = ''): HTMLElement {
  const el = h('div', `lg-plate ${cls}`.trim());
  el.appendChild(h('p', 'lg-plate-head', heading));
  const list = h('ul', 'lg-plate-list');
  for (const line of lines) list.appendChild(h('li', 'lg-plate-line', line));
  el.appendChild(list);
  return el;
}

/**
 * Everything one mounted mechanism has to give back. A single leaked rAF loop
 * becomes a stutter three hours later that nobody can trace, so nothing is
 * created here that the rig is not holding the other end of.
 */
class Rig {
  private parts: Cleanable[] = [];
  private ac = new AbortController();
  private frames = new Set<number>();
  private timers = new Set<number>();
  private observers: ResizeObserver[] = [];
  private dead = false;

  get signal(): AbortSignal {
    return this.ac.signal;
  }

  get closed(): boolean {
    return this.dead;
  }

  keep<T extends Cleanable>(part: T): T {
    this.parts.push(part);
    return part;
  }

  watch(el: Element, fn: () => void) {
    const ro = new ResizeObserver(() => {
      if (!this.dead) fn();
    });
    ro.observe(el);
    this.observers.push(ro);
  }

  /** A rAF loop that stops when `fn` returns false, and always on teardown. */
  loop(fn: (dtMs: number) => void | false) {
    let last = performance.now();
    let id = 0;
    const step = (now: number) => {
      this.frames.delete(id);
      if (this.dead) return;
      const dt = Math.min(64, now - last);
      last = now;
      if (fn(dt) === false) return;
      id = requestAnimationFrame(step);
      this.frames.add(id);
    };
    id = requestAnimationFrame(step);
    this.frames.add(id);
  }

  after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.ac.abort();
    for (const id of this.frames) cancelAnimationFrame(id);
    for (const id of this.timers) clearTimeout(id);
    for (const ro of this.observers) ro.disconnect();
    for (const part of this.parts) {
      try {
        part.destroy();
      } catch (err) {
        console.error('[logic] a fitting threw during teardown', err);
      }
    }
    this.frames.clear();
    this.timers.clear();
    this.observers.length = 0;
    this.parts.length = 0;
  }
}

// -- persisted scratch state -------------------------------------------------
//
// `ctx.state` is a plain bag off the save file and may hold anything a previous
// version wrote, or nothing. Every read degrades to "start of the puzzle".

const readNum = (bag: Record<string, unknown>, k: string, fallback: number): number => {
  const v = bag[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

const readBool = (bag: Record<string, unknown>, k: string): boolean => bag[k] === true;

const readStrings = (bag: Record<string, unknown>, k: string): string[] => {
  const v = bag[k];
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
};

const readMap = (bag: Record<string, unknown>, k: string): Record<string, unknown> => {
  const v = bag[k];
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
};

// -- deterministic dressing --------------------------------------------------

/**
 * Sixty thousand index cards cannot be authored by hand, and they must not be
 * different on the second visit — a drawer that reshuffles itself is a drawer
 * the player cannot learn. Seeded, therefore, and identical for ever.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -- the stage rail ----------------------------------------------------------

/**
 * Multi-stage apparatus gets a numbered rail, so the player always knows how
 * much of the job is left. It is a readout, not a navigation control: you
 * cannot click stage three, you can only earn it.
 */
class Rail {
  readonly el = h('ol', 'lg-rail');
  onGo?: (index: number) => void;
  private steps: HTMLElement[] = [];
  private panels: HTMLElement[] = [];
  private at = -1;

  constructor(names: string[]) {
    this.el.setAttribute('aria-label', 'Stages');
    names.forEach((name, i) => {
      const step = h('li', 'lg-rail-step');
      step.append(h('span', 'lg-rail-numeral', ROMAN[i] ?? String(i + 1)));
      step.append(h('span', 'lg-rail-name', name));
      this.steps.push(step);
      this.el.appendChild(step);
    });
  }

  add(panel: HTMLElement) {
    panel.classList.add('lg-stage');
    panel.tabIndex = -1;
    panel.hidden = true;
    this.panels.push(panel);
  }

  get index() {
    return this.at;
  }

  go(i: number, focus = false) {
    if (i === this.at) return;
    this.at = i;
    this.panels.forEach((p, n) => {
      p.hidden = n !== i;
    });
    this.steps.forEach((s, n) => {
      s.classList.toggle('is-live', n === i);
      s.classList.toggle('is-done', n < i);
      if (n === i) s.setAttribute('aria-current', 'step');
      else s.removeAttribute('aria-current');
    });
    this.onGo?.(i);
    if (focus) this.panels[i]?.focus({ preventScroll: true });
  }
}

/** Wraps a mechanism's root so every module has the same outer furniture. */
function bench(root: HTMLElement, kind: string): HTMLElement {
  const el = h('div', `lg-root ${kind}`);
  root.appendChild(el);
  return el;
}

// -- digit wheels ------------------------------------------------------------

interface WheelsOptions {
  label: string;
  digits: number;
  value?: number;
  /** Legend engraved to the left of the barrels, e.g. "£". */
  unit?: string;
  feedback?: FeedbackFn;
  onChange?(value: number): void;
}

/**
 * A row of numbered barrels in a brass carrier — the counter off a franking
 * meter, borrowed for anything the player has to *state* rather than choose.
 *
 * A text input would be quicker and would also be a web form; these are
 * spinbuttons with real detents, so entering a figure has the same weight as
 * setting a dial, and the same keyboard contract.
 */
function makeWheels(opts: WheelsOptions): Control<number> {
  const digits = Math.max(1, Math.floor(opts.digits));
  const cap10 = 10 ** digits;
  const el = h('div', 'lg-wheels');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', opts.label);
  if (opts.unit) el.appendChild(h('span', 'lg-wheels-unit', opts.unit));

  const barrels: HTMLElement[] = [];
  const ac = new AbortController();
  const { signal } = ac;
  let value = clamp(Math.round(opts.value ?? 0), 0, cap10 - 1);
  let cursor = 0;

  const carrier = h('div', 'lg-wheels-carrier');
  el.appendChild(carrier);

  const digitAt = (i: number) => Math.floor(value / 10 ** (digits - 1 - i)) % 10;

  const paint = () => {
    barrels.forEach((b, i) => {
      const d = digitAt(i);
      b.style.setProperty('--digit', String(d));
      b.setAttribute('aria-valuenow', String(d));
      b.setAttribute('aria-valuetext', `${d}, place ${digits - i}`);
      const strip = b.querySelector('.lg-wheel-strip');
      if (strip) (strip as HTMLElement).style.setProperty('--digit', String(d));
    });
  };

  const bump = (i: number, by: number) => {
    const place = 10 ** (digits - 1 - i);
    const d = digitAt(i);
    const next = (d + by + 10) % 10;
    value = clamp(value + (next - d) * place, 0, cap10 - 1);
    paint();
    opts.feedback?.('tick');
    opts.onChange?.(value);
  };

  const focusBarrel = (i: number) => {
    cursor = clamp(i, 0, digits - 1);
    barrels.forEach((b, n) => (b.tabIndex = n === cursor ? 0 : -1));
    barrels[cursor].focus({ preventScroll: true });
  };

  for (let i = 0; i < digits; i++) {
    const barrel = h('div', 'lg-wheel');
    attrs(barrel, {
      role: 'spinbutton',
      'aria-valuemin': '0',
      'aria-valuemax': '9',
      'aria-label': `${opts.label}, place ${digits - i}`,
    });
    barrel.tabIndex = i === 0 ? 0 : -1;
    const strip = h('div', 'lg-wheel-strip');
    for (let d = 0; d < 10; d++) strip.appendChild(h('span', 'lg-wheel-digit', String(d)));
    barrel.append(strip, h('span', 'lg-wheel-glass'));

    barrel.addEventListener(
      'pointerdown',
      (ev: PointerEvent) => {
        if (ev.button !== 0 && ev.pointerType === 'mouse') return;
        ev.preventDefault();
        focusBarrel(i);
        const r = barrel.getBoundingClientRect();
        bump(i, ev.clientY < r.top + r.height / 2 ? 1 : -1);
      },
      { signal },
    );

    barrel.addEventListener(
      'keydown',
      (ev: KeyboardEvent) => {
        if (ev.key === 'ArrowUp') bump(i, 1);
        else if (ev.key === 'ArrowDown') bump(i, -1);
        else if (ev.key === 'ArrowRight') focusBarrel(i + 1);
        else if (ev.key === 'ArrowLeft') focusBarrel(i - 1);
        else if (/^[0-9]$/.test(ev.key)) {
          const place = 10 ** (digits - 1 - i);
          value = clamp(value + (Number(ev.key) - digitAt(i)) * place, 0, cap10 - 1);
          paint();
          opts.feedback?.('tick');
          opts.onChange?.(value);
          if (i < digits - 1) focusBarrel(i + 1);
        } else return;
        ev.preventDefault();
        ev.stopPropagation();
      },
      { signal },
    );

    barrels.push(barrel);
    carrier.appendChild(barrel);
  }

  paint();

  return {
    el,
    get: () => value,
    set: (v, silent) => {
      value = clamp(Math.round(v), 0, cap10 - 1);
      paint();
      if (!silent) opts.onChange?.(value);
    },
    destroy: () => {
      ac.abort();
      el.remove();
    },
  };
}

// -- old money ---------------------------------------------------------------

/** Pence to "£463 18s 4d" — the only currency this archive has ever known. */
function lsd(pence: number): string {
  const neg = pence < 0;
  const p = Math.abs(Math.round(pence));
  const pounds = Math.floor(p / 240);
  const shillings = Math.floor((p % 240) / 12);
  const d = p % 12;
  const body = `£${pounds.toLocaleString('en-GB')} ${shillings}s ${d}d`;
  return neg ? `(${body})` : body;
}

// ===========================================================================
// puz-forty-seven-cards — "The Forty-Seven Cards"
// The Rolls Room, drawers 214–216, Act II.
//
// The trick of the whole puzzle is in Wren's first hint: sort by the object,
// not the words. The subject lines on these cards are impeccable. The stock
// they are typed on was not manufactured until March 1987, the ribbon is
// nylon, and the machine stands four feet from Ottoline Verge's chair — and
// none of those three facts is anything anybody chose to write down.
// ===========================================================================

type Stock = 'laid' | 'wove';
type Ribbon = 'silk' | 'nylon';
type Face = 'imperial' | 'underwood' | 'olivetti' | 'remington' | 'prewar';

interface IndexCard {
  acc: string;
  subject: string;
  stock: Stock;
  ribbon: Ribbon;
  face: Face;
}

const STOCK_NAME: Record<Stock, string> = {
  laid: 'Buff ribbed laid · maker’s edge stamp',
  wove: 'White smooth wove · no stamp',
};

const RIBBON_NAME: Record<Ribbon, string> = {
  silk: 'Purple silk · fibrous halo to every stroke',
  nylon: 'Black nylon · edges sharp as a printed rule',
};

const FACE_NAME: Record<Face, string> = {
  imperial: 'Imperial 66 · Warden’s Office',
  underwood: 'Underwood 5 · Rolls Room',
  olivetti: 'Olivetti Lettera 32 · Registry',
  remington: 'Remington Noiseless · Accounts',
  prewar: 'Unidentified · pre-war original',
};

const FACE_TELL: Record<Face, string> = {
  imperial: 'Counter of the a filled solid with ink and wax. Comma printing four tenths high.',
  underwood: 'Lower-case e riding three tenths of a millimetre above the baseline. Wandering 3.',
  olivetti: 'Grey doubling off a slack ribbon vibrator. Chipped l.',
  remington: 'Heavy g off a bent typebar. Capitals dropping two tenths.',
  prewar: 'No injury anywhere on it. This type is older than the drawer it lives in.',
};

const FACE_SHORT: Record<Face, string> = {
  imperial: 'IMP',
  underwood: 'UND',
  olivetti: 'OLI',
  remington: 'REM',
  prewar: 'PRE',
};

/** Boxes 4 and 17: the two shelf lists the Registry counter would release. */
const COLLATED: { acc: string; subject: string; held: boolean }[] = [
  { acc: '14/B/4/01', subject: 'OIL AND STORES, NINE BELLS, 1970', held: true },
  { acc: '14/B/4/02', subject: 'OIL AND STORES, NINE BELLS, 1971', held: true },
  { acc: '14/B/4/03', subject: 'OIL AND STORES, NINE BELLS, 1972', held: true },
  { acc: '14/B/4/04', subject: 'OIL AND STORES, NINE BELLS, 1973', held: true },
  { acc: '14/B/4/05', subject: 'STORES RETURN, BRANNOCK DEPOT, 1973', held: true },
  { acc: '14/B/4/06', subject: 'OIL AND STORES, CADRAN POINT, 1974', held: true },
  { acc: '14/B/4/07', subject: 'OIL AND STORES, NINE BELLS, 1974', held: false },
  { acc: '14/B/17/01', subject: 'LAMP SUPERINTENDENT’S REPORT, 12.5.74', held: true },
  { acc: '14/B/17/02', subject: 'LAMP SUPERINTENDENT’S REPORT, 15.8.74', held: false },
  { acc: '14/B/17/03', subject: 'LAMP SUPERINTENDENT’S REPORT, 4.12.74', held: true },
  { acc: '14/B/17/04', subject: 'REQUISITION R.736, LAMP GLASSES', held: true },
  { acc: '14/B/17/05', subject: 'REQUISITION R.741', held: false },
  { acc: '14/B/17/06', subject: 'REQUISITION R.744, PAINT AND WHITE LEAD', held: true },
  { acc: '14/B/17/07', subject: 'REQUISITION R.745, COTTON WICK', held: true },
  { acc: '14/B/17/08', subject: 'REQUISITION R.746, LAMP GLASSES', held: true },
  { acc: '14/B/17/09', subject: 'REQUISITION R.747, ROPE AND TACKLE', held: true },
  { acc: '14/B/17/10', subject: 'CORRESPONDENCE, VAPORISER PARTS, 1974', held: true },
  { acc: '14/B/17/11', subject: 'REQUISITION R.748', held: false },
  { acc: '14/B/17/12', subject: 'REQUISITION R.750, BOAT VARNISH', held: true },
  { acc: '14/B/17/13', subject: 'REQUISITION R.751, PARAFFIN, DEPOT USE', held: true },
  { acc: '14/B/17/14', subject: 'NOTICE TO MARINERS 74/117, FILE COPY', held: true },
  { acc: '14/B/17/15', subject: 'NOTICE TO MARINERS 74/118, FILE COPY', held: true },
  { acc: '14/B/17/16', subject: 'REQUISITION R.755', held: false },
  { acc: '14/B/17/17', subject: 'NOTICE TO MARINERS 74/120, FILE COPY', held: true },
  { acc: '14/B/17/18', subject: 'DISTRIBUTION LIST, SCHEDULE D', held: true },
  { acc: '14/B/17/19', subject: 'DESPATCH DOCKET, NOTICES TO MARINERS, 16.8.74', held: false },
  { acc: '14/B/17/20', subject: 'DESPATCH DOCKET, NOTICES TO MARINERS, 30.8.74', held: true },
  { acc: '14/B/17/21', subject: 'CORRESPONDENCE, ROSSPORT COASTGUARD, 1974', held: true },
  { acc: '14/B/17/22', subject: 'MEMORANDUM, WARDEN’S OFFICE TO CASHIER, 4.7.74', held: true },
  { acc: '14/B/17/23', subject: 'MEMORANDUM, WARDEN’S OFFICE TO CASHIER, 6.11.74', held: false },
];

/** The seventeen retyped cards outside the two requisitioned shelf lists. */
const OUTLIERS: { acc: string; subject: string }[] = [
  { acc: '14/B/2/04', subject: 'ESTABLISHMENT, KEEPERS AND ASSISTANTS, 1974' },
  { acc: '14/B/2/09', subject: 'RELIEF ROSTER, NINE BELLS, 1974' },
  { acc: '14/B/2/11', subject: 'WAGE SHEETS, NINE BELLS, JULY–DEC 1974' },
  { acc: '14/B/2/17', subject: 'DEFERMENT OF RELIEF KEEPER, 1974' },
  { acc: '14/B/6/02', subject: 'LIGHT DUES, BRANNOCK STATION, 1974' },
  { acc: '14/B/6/05', subject: 'LIGHT DUES, RETURNS AND ARREARS, 1974' },
  { acc: '14/B/8/01', subject: 'BOATMEN, CASUAL ENGAGEMENTS, 1974' },
  { acc: '14/B/9/03', subject: 'OPTIC AND MACHINERY, NINE BELLS, 1966–1974' },
  { acc: '14/B/9/07', subject: 'VAPORISER No. 2, MAINTENANCE, 1968–1974' },
  { acc: '14/B/9/12', subject: 'LANTERN GLAZING, SURVEY, 1972' },
  { acc: '14/B/11/02', subject: 'CORRESPONDENCE, MINISTRY OF TRANSPORT, 1974' },
  { acc: '14/B/11/08', subject: 'QUINQUENNIAL REVIEW, 1974, ACKNOWLEDGEMENT' },
  { acc: '14/B/13/01', subject: 'CASUALTY, S.S. PELAGIA, PRESS CUTTINGS' },
  { acc: '14/B/13/04', subject: 'ROSSPORT INQUIRY 1975, CORRESPONDENCE' },
  { acc: '14/B/15/06', subject: 'INSURANCE, THIRD PARTY, 1974' },
  { acc: '14/B/19/02', subject: 'STATIONERY AND SUNDRIES, 1974' },
  { acc: '14/B/21/05', subject: 'DEPOT LAUNCH KESTREL, LOG, 1974' },
];

const FILLER_SUBJECTS = [
  'PILOTAGE CERTIFICATES, RENEWALS',
  'BUOYAGE, IVORY SOUND, INSPECTION',
  'FOG SIGNAL, ST BRIDE’S, TRIALS',
  'HARBOUR DUES, ROSSPORT, RETURNS',
  'KEEPERS’ SUPERANNUATION, SCHEDULE',
  'MOORINGS, DEPOT, SURVEY',
  'BRANNOCK HEAD, FABRIC REPAIRS',
  'LAUNCH ENGINES, OVERHAUL',
  'SIGNAL LAMPS, ISSUE AND RETURN',
  'CHARTS, CORRECTIONS RECEIVED',
  'PROVISIONS, ROCK STATIONS',
  'MEDICAL ATTENDANCE, KEEPERS',
  'BOAT SLIP, CONCRETE, ESTIMATE',
  'WRECK REMOVAL, CORRESPONDENCE',
  'TIDE GAUGE, MAINTENANCE',
  'LEAVE AND RELIEFS, SCHEDULE',
  'TELEPHONE, TRUNK ACCOUNTS',
  'FIRE APPLIANCES, INSPECTION',
  'STORES LEDGER, DEPOT',
  'CLOTHING ISSUES, KEEPERS',
  'PAINT AND WHITE LEAD, STOCK',
  'ROPE AND CORDAGE, STOCK',
  'ADMIRALTY NOTICES, RECEIPTS',
  'LIGHTHOUSE VISITORS, PERMITS',
];

const FILLER_SERIES = ['1/A', '2/C', '3/D', '9/E', '11/F', '14/B/1', '14/B/3', '14/B/5', '14/B/12'];

/**
 * The drawer, built once and always identical.
 *
 * The counts are the puzzle. Wove alone draws fifty-three, nylon alone
 * fifty-nine, the Underwood alone sixty-one; only all three together draw
 * exactly forty-seven, which is why the sorting frame has three dials and not
 * one, and why a player who guesses at a single attribute gets a number that
 * is nearly right and therefore useless.
 */
function buildDrawer(): IndexCard[] {
  const cards: IndexCard[] = [];
  const push = (acc: string, subject: string, stock: Stock, ribbon: Ribbon, face: Face) =>
    cards.push({ acc, subject, stock, ribbon, face });

  // The forty-seven: white wove, black nylon, Underwood 5.
  for (const c of COLLATED) push(c.acc, c.subject, 'wove', 'nylon', 'underwood');
  for (const c of OUTLIERS) push(c.acc, c.subject, 'wove', 'nylon', 'underwood');

  const r = rng(0x4b7cd1);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  const used = new Set(cards.map((c) => c.acc));
  const freshAcc = (series: string) => {
    for (let n = 0; n < 400; n++) {
      const acc = `${series}/${String(Math.floor(r() * 60) + 1).padStart(2, '0')}/${String(
        Math.floor(r() * 30) + 1,
      ).padStart(2, '0')}`;
      if (!used.has(acc)) {
        used.add(acc);
        return acc;
      }
    }
    return `${series}/99/${used.size}`;
  };
  const filler = (stock: Stock, ribbon: Ribbon, face: Face, n: number) => {
    for (let i = 0; i < n; i++) {
      const series = pick(FILLER_SERIES);
      push(freshAcc(series), `${pick(FILLER_SUBJECTS)}, ${1928 + Math.floor(r() * 50)}`, stock, ribbon, face);
    }
  };

  // The near-misses, each of which breaks exactly one of the three tests.
  filler('wove', 'nylon', 'olivetti', 2); // right paper, right ribbon, wrong machine
  filler('wove', 'silk', 'underwood', 4); // right paper, right machine, older ribbon
  filler('laid', 'nylon', 'underwood', 10); // right ribbon and machine, honest stock

  // And a hundred and seventeen cards that are simply what an index looks like.
  filler('laid', 'silk', 'prewar', 44);
  filler('laid', 'silk', 'imperial', 26);
  filler('laid', 'silk', 'olivetti', 24);
  filler('laid', 'silk', 'remington', 23);

  // Shuffled once, deterministically: the forty-seven are scattered through
  // three drawers exactly as they would be, and the player who spots two of
  // them together has spotted a coincidence, not a pattern.
  const s = rng(0x91f3a2);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(s() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function fortySevenCards(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'lg-cards');
      const deck = buildDrawer();
      const TARGET = new Set(
        deck.filter((c) => c.stock === 'wove' && c.ribbon === 'nylon' && c.face === 'underwood').map((c) => c.acc),
      );

      const rail = new Rail(['The drawers', 'Card and paper']);

      // -- Stage I: the survey ------------------------------------------------

      const survey = h('div', 'fc-survey');
      rail.add(survey);

      const drawerBox = h('div', 'fc-drawer');
      drawerBox.append(
        h('p', 'fc-drawer-mark', 'DRAWERS 214 – 216 · SERIES 14/B · CONDITION SURVEY'),
      );
      const rod = h('span', 'fc-drawer-rod');
      rod.setAttribute('aria-hidden', 'true');
      const grid = h('div', 'fc-grid');
      attrs(grid, { role: 'group', 'aria-label': 'Index cards, drawers 214 to 216' });
      drawerBox.append(rod, grid);

      const tiles: HTMLButtonElement[] = [];
      let cursor = 0;
      let lifted = 0;

      const loupe = h('div', 'fc-loupe');
      loupe.setAttribute('aria-live', 'polite');

      const paintLoupe = () => {
        const card = deck[lifted];
        loupe.textContent = '';
        const sheet = h('div', 'fc-loupe-card');
        sheet.dataset.stock = card.stock;
        sheet.append(h('p', 'fc-loupe-acc', card.acc));
        const subject = h('p', `fc-loupe-subject is-${card.face}`, card.subject);
        subject.dataset.ribbon = card.ribbon;
        sheet.append(subject);
        /* A rule is a rule. This used to be a literal run of em dashes typed in
           IBM Plex Mono, which stops at whatever fraction of the card width the
           mono advance happens to reach and sits on the baseline grid, so it
           read as a line of broken text rather than as a division. */
        sheet.append(h('p', 'fc-loupe-rule'));
        sheet.append(
          h('p', 'fc-loupe-body', 'Cross-refer: shelf list, box contents sheet. Cond. good.'),
        );
        loupe.append(sheet);

        const read = h('dl', 'fc-read');
        /**
         * One signal vocabulary, not three.
         *
         * The rows used to carry a small amber triangle, an amber diamond and a
         * bold amber three-letter badge — the first two read as debug glyphs,
         * and nothing tied them to each other. Every row now gets the same
         * three-letter mono badge, which is also the abbreviation stamped on
         * the sorting-frame plate and cut into the dial legends, so the loupe,
         * the plate and the dials all speak one shorthand.
         */
        const row = (term: string, badge: string, value: string, note?: string) => {
          const dt = h('dt', 'fc-read-term', term);
          const dd = h('dd', 'fc-read-value');
          dd.append(h('span', 'fc-read-mark', badge), h('span', 'fc-read-text', value));
          if (note) dd.append(h('span', 'fc-read-note', note));
          read.append(dt, dd);
        };
        row('Stock', card.stock === 'wove' ? 'WOV' : 'LAI', STOCK_NAME[card.stock]);
        row('Ribbon', card.ribbon === 'nylon' ? 'NYL' : 'SLK', RIBBON_NAME[card.ribbon]);
        /* The datum and the forensic observation are two registers and were
           being run together into one 110-character line with an em dash. The
           observation is a subordinate line under the datum it belongs to. */
        row('Type', FACE_SHORT[card.face], FACE_NAME[card.face], FACE_TELL[card.face]);
        loupe.append(read);
      };

      const liftCard = (i: number, quiet = false) => {
        lifted = clamp(i, 0, deck.length - 1);
        tiles.forEach((t, n) => t.classList.toggle('is-lifted', n === lifted));
        paintLoupe();
        if (!quiet) ctx.feedback('click');
      };

      const focusTile = (i: number) => {
        cursor = clamp(i, 0, tiles.length - 1);
        tiles.forEach((t, n) => (t.tabIndex = n === cursor ? 0 : -1));
        tiles[cursor].focus({ preventScroll: true });
      };

      const COLS = 12;

      deck.forEach((card, i) => {
        const tile = h('button', 'fc-card');
        tile.type = 'button';
        tile.tabIndex = i === 0 ? 0 : -1;
        tile.dataset.stock = card.stock;
        // `aria-pressed`, not `aria-selected`: "drawn off by the frame" is a
        // state of the card, and a screen reader should say so on every one of
        // the forty-seven without the player having to hunt for a tray.
        attrs(tile, { 'aria-pressed': 'false', 'aria-label': `${card.acc}. ${card.subject}` });
        tile.append(h('span', 'fc-card-acc', card.acc), h('span', 'fc-card-tick'));
        tile.addEventListener('click', () => {
          focusTile(i);
          liftCard(i);
        });
        tile.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            let next: number | null = null;
            if (ev.key === 'ArrowRight') next = i + 1;
            else if (ev.key === 'ArrowLeft') next = i - 1;
            else if (ev.key === 'ArrowDown') next = i + COLS;
            else if (ev.key === 'ArrowUp') next = i - COLS;
            else if (ev.key === 'Home') next = 0;
            else if (ev.key === 'End') next = tiles.length - 1;
            else return;
            ev.preventDefault();
            ev.stopPropagation();
            focusTile(next);
            liftCard(cursor, true);
          },
          { signal: rig.signal },
        );
        tiles.push(tile);
        grid.appendChild(tile);
      });

      // -- the sorting frame --------------------------------------------------

      const STOCKS: (Stock | null)[] = [null, 'laid', 'wove'];
      const RIBBONS: (Ribbon | null)[] = [null, 'silk', 'nylon'];
      const FACES: (Face | null)[] = [null, 'imperial', 'underwood', 'olivetti', 'remington', 'prewar'];

      let iStock = clamp(readNum(ctx.state, 'stock', 0), 0, 2);
      let iRibbon = clamp(readNum(ctx.state, 'ribbon', 0), 0, 2);
      let iFace = clamp(readNum(ctx.state, 'face', 0), 0, 5);

      const trayCount = h('span', 'fc-tray-count', '0');
      const trayStack = h('span', 'fc-tray-stack');
      trayStack.setAttribute('aria-hidden', 'true');
      const trayNote = h('p', 'fc-tray-note', 'No criterion set. The frame passes everything.');
      const tray = h('div', 'fc-tray');
      tray.append(
        cap('DRAWN OFF', 'is-tray'),
        trayStack,
        trayCount,
        cap('cards', 'is-unit'),
        trayNote,
      );

      let stageOneDone = readBool(ctx.state, 'sorted');

      /** The frame is run continuously; there is no "sort" button to press. */
      const runFrame = (announce: boolean) => {
        const st = STOCKS[iStock];
        const rb = RIBBONS[iRibbon];
        const fc = FACES[iFace];
        let drawn = 0;
        let exact = true;
        deck.forEach((card, n) => {
          const hit =
            (st === null || card.stock === st) &&
            (rb === null || card.ribbon === rb) &&
            (fc === null || card.face === fc);
          if (hit) drawn++;
          if (hit !== TARGET.has(card.acc)) exact = false;
          tiles[n].classList.toggle('is-drawn', hit);
          tiles[n].setAttribute('aria-pressed', hit ? 'true' : 'false');
        });
        trayCount.textContent = String(drawn);
        tray.classList.toggle('is-exact', exact);
        const anySet = st !== null || rb !== null || fc !== null;
        trayNote.textContent = !anySet
          ? 'No criterion set. The frame passes everything.'
          : exact
            ? 'Forty-seven. All three tests, and not one card that answers two of them.'
            : drawn === 0
              ? 'Nothing in three drawers answers to that.'
              : `${drawn} drawn on ${[st && 'stock', rb && 'ribbon', fc && 'type'].filter(Boolean).join(', ')}.`;

        if (announce && exact && !stageOneDone) {
          stageOneDone = true;
          ctx.state.sorted = true;
          ctx.save();
          ctx.feedback('good');
          ctx.note(
            'Forty-seven cards. White wove, black nylon, and an Underwood that stands four feet from Ottoline Verge’s chair.',
          );
          rig.after(reduced() ? 90 : 1400, () => rail.go(1, true));
        } else if (announce && anySet) {
          ctx.note(
            drawn === 47
              ? 'Forty-seven — but not the same forty-seven. Two of these came off the wrong machine.'
              : `${drawn} drawn. Near is not a set.`,
          );
        }
      };

      const dialFor = (
        label: string,
        labels: string[],
        value: number,
        onSet: (v: number) => void,
      ): Control<number> =>
        rig.keep(
          makeDial({
            label,
            steps: labels.length,
            labels,
            value,
            wrap: true,
            size: 'clamp(4.4rem, 10cqw, 6.4rem)',
            feedback: ctx.feedback,
            onChange: (v, committed) => {
              onSet(v);
              runFrame(committed);
              if (committed) {
                ctx.state.stock = iStock;
                ctx.state.ribbon = iRibbon;
                ctx.state.face = iFace;
                ctx.save();
              }
            },
          }),
        );

      const stockDial = dialFor('Sorting frame — stock', ['ANY', 'LAID', 'WOVE'], iStock, (v) => (iStock = v));
      const ribbonDial = dialFor('Sorting frame — ribbon', ['ANY', 'SILK', 'NYL'], iRibbon, (v) => (iRibbon = v));
      const faceDial = dialFor(
        'Sorting frame — typeface',
        ['ANY', 'IMP', 'UND', 'OLI', 'REM', 'PRE'],
        iFace,
        (v) => (iFace = v),
      );

      const dials = h('div', 'fc-dials');
      const well = (title: string, ctl: Control<number>) => {
        const w = h('div', 'fc-dial-well');
        w.append(cap(title), ctl.el);
        return w;
      };
      dials.append(
        well('Stock', stockDial),
        well('Ribbon', ribbonDial),
        well('Type', faceDial),
      );

      const frame = h('div', 'fc-frame');
      frame.append(
        plate('SORTING FRAME · CONSERVANCY PATTERN 4', [
          'Set each dial to a physical attribute, or to ANY.',
          'IMP Imperial 66 · UND Underwood 5 · OLI Olivetti · REM Remington · PRE pre-war',
          'The frame draws off every card answering all three.',
        ]),
        dials,
        tray,
      );

      const side = h('div', 'fc-side');
      side.append(h('div', 'fc-loupe-well', ''), frame);
      side.querySelector('.fc-loupe-well')!.append(cap('4× LOUPE'), loupe);

      const surveyBody = h('div', 'fc-body');
      surveyBody.append(drawerBox, side);
      survey.append(surveyBody);

      // -- Stage II: card and paper ------------------------------------------

      const collate = h('div', 'fc-collate');
      rail.add(collate);

      const shelf = COLLATED.filter((c) => c.held);
      let ci = clamp(readNum(ctx.state, 'ci', 0), 0, COLLATED.length);
      let si = clamp(readNum(ctx.state, 'si', 0), 0, shelf.length);
      const aside = readStrings(ctx.state, 'aside').filter((a) => COLLATED.some((c) => c.acc === a));

      const cardCol = h('ol', 'fc-col is-cards');
      const shelfCol = h('ol', 'fc-col is-shelf');
      const wantRack = h('ul', 'fc-want');
      wantRack.setAttribute('aria-label', 'Want-list');

      const agreed = key('AGREED · ADVANCE BOTH', 'is-advance');
      const noPaper = key('NO PAPER · SET ASIDE', 'is-aside');

      const renderColumn = (
        list: HTMLElement,
        entries: { acc: string; subject: string }[],
        at: number,
        struckBefore: boolean,
      ) => {
        list.textContent = '';
        // Three lines above, three below: the line under examination sits at
        // the brass reading edge in the middle, where a finger would hold it.
        for (let n = at - 3; n <= at + 3; n++) {
          const li = h('li', 'fc-line');
          if (n < 0 || n >= entries.length) {
            li.classList.add('is-void');
            li.append(h('span', 'fc-line-acc', n < 0 ? '· · ·' : '— end —'));
            list.appendChild(li);
            continue;
          }
          const e = entries[n];
          li.classList.toggle('is-current', n === at);
          li.classList.toggle('is-struck', struckBefore && n < at);
          li.classList.toggle('is-set-aside', aside.includes(e.acc));
          li.append(h('span', 'fc-line-acc', e.acc), h('span', 'fc-line-subject', e.subject));
          list.appendChild(li);
        }
      };

      const paintWant = () => {
        wantRack.textContent = '';
        for (const acc of aside) {
          const entry = COLLATED.find((c) => c.acc === acc)!;
          const li = h('li', 'fc-want-slip');
          li.append(h('span', 'fc-want-acc', entry.acc), h('span', 'fc-want-subject', entry.subject));
          wantRack.appendChild(li);
        }
        if (!aside.length) {
          const li = h('li', 'fc-want-slip is-empty');
          li.append(h('span', 'fc-want-subject', 'Nothing set aside yet.'));
          wantRack.appendChild(li);
        }
      };

      let collationDone = false;

      const paintCollation = () => {
        const done = ci >= COLLATED.length;
        renderColumn(cardCol, COLLATED, ci, true);
        renderColumn(shelfCol, shelf, si, true);
        paintWant();
        agreed.disabled = done;
        noPaper.disabled = done;
        collate.classList.toggle('is-done', done);
        if (done && !collationDone) {
          collationDone = true;
          ctx.feedback('good');
          ctx.note(
            'Seven accession numbers that exist as cards and do not exist as paper. That is not an error. That is an event.',
          );
          rig.after(reduced() ? 120 : 1800, () => ctx.solve());
        }
      };

      const refuse = (line: string) => {
        ctx.feedback('bad');
        collate.classList.remove('is-refused');
        void collate.offsetWidth;
        collate.classList.add('is-refused');
        ctx.note(line);
      };

      const persistCollation = () => {
        ctx.state.ci = ci;
        ctx.state.si = si;
        ctx.state.aside = [...aside];
        ctx.save();
      };

      agreed.addEventListener(
        'click',
        () => {
          if (ci >= COLLATED.length) return;
          const card = COLLATED[ci];
          if (si < shelf.length && shelf[si].acc === card.acc) {
            ci++;
            si++;
            ctx.feedback('tick');
            persistCollation();
            paintCollation();
            if (ci < COLLATED.length && ci % 8 === 0) {
              ctx.note(`${ci} of thirty collated. ${aside.length} standing.`);
            }
          } else {
            refuse('Those two numbers are not the same number. Do not carry a line you have not read.');
          }
        },
        { signal: rig.signal },
      );

      noPaper.addEventListener(
        'click',
        () => {
          if (ci >= COLLATED.length) return;
          const card = COLLATED[ci];
          if (si < shelf.length && shelf[si].acc === card.acc) {
            refuse('The paper is there. It is on the shelf list under your hand.');
            return;
          }
          aside.push(card.acc);
          ci++;
          ctx.feedback('click');
          persistCollation();
          paintCollation();
          ctx.note(
            aside.length === 1
              ? 'One. Oil and Stores, Nine Bells, 1974. A card with nothing behind it.'
              : `${aside.length} set aside, and every one of them 1974.`,
          );
        },
        { signal: rig.signal },
      );

      const gutter = h('div', 'fc-gutter');
      gutter.append(h('span', 'fc-reading-line'));

      const cols = h('div', 'fc-columns');
      const colBox = (title: string, sub: string, list: HTMLElement) => {
        const box = h('div', 'fc-colbox');
        box.append(h('p', 'fc-colbox-head', title), h('p', 'fc-colbox-sub', sub), list);
        return box;
      };
      cols.append(
        colBox('CARDS', 'Drawers 214–216, the forty-seven, in accession order', cardCol),
        gutter,
        colBox('THE HOLDING', 'Shelf list and box contents, boxes 14/B/4 and 14/B/17', shelfCol),
      );

      collate.append(
        plate('COLLATION', [
          'Read the two lines standing at the brass. If they agree, carry both forward.',
          'If the card has no line on the shelf list, the paper does not exist. Set the card aside.',
          'Only boxes 4 and 17 were released at the counter; the other seventeen cards keep.',
        ]),
        cols,
        box('fc-keys', agreed, noPaper),
        h('p', 'fc-want-head', 'WANT-LIST'),
        wantRack,
      );

      // -- assembly -----------------------------------------------------------

      const stageHolder = h('div', 'lg-stages');
      stageHolder.append(survey, collate);
      el.append(rail.el, stageHolder);

      rail.onGo = (i) => {
        el.dataset.stage = String(i);
        if (i === 1) paintCollation();
      };

      liftCard(0, true);
      runFrame(false);
      paintCollation();
      rail.go(stageOneDone ? 1 : 0);

      ctx.note(
        stageOneDone
          ? 'Forty-seven cards on the bench, and two shelf lists from the counter. Collate them.'
          : 'A hundred and eighty cards, all of them impeccable. Sort by the object, not the words.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-chart-loft — "Three Flashes"
// The Rossport call box, then the Chart Loft light table. Act III.
//
// Two instruments, and both of them measure the same thing: how long. A
// stopwatch turns a truthful woman's memory into a light's characteristic,
// and three trig marks turn three sheets of tracing paper into a position.
// Neither of them has an opinion about Emrys Tain.
// ===========================================================================

/** Chart units. One unit is five yards, which makes the scale bar honest. */
const YARDS_PER_UNIT = 5;
const VB_W = 1000;
const VB_H = 640;
/** Registration tolerance, in chart units — about a pencil's width at scale. */
const REG_TOL = 10;

interface LightEntry {
  id: string;
  name: string;
  character: string;
  detail: string;
  /** Flashes per group and period in seconds, for the match. */
  group: number;
  period: number;
}

const LIGHT_LIST: LightEntry[][] = [
  [
    {
      id: 'nine-bells',
      name: 'NINE BELLS',
      character: 'Fl(3) W 20s',
      detail: 'Granite tower on the rock, 34 m. 18 M. Established 1861. Unwatched since 1974.',
      group: 3,
      period: 20,
    },
    {
      id: 'cadran-point',
      name: 'CADRAN POINT',
      character: 'Fl(3) W 15s',
      detail: 'White tower, 21 m. 16 M. Nine miles SSE of the Nine Bells. Established 1911.',
      group: 3,
      period: 15,
    },
    {
      id: 'st-brides',
      name: 'ST BRIDE’S LEDGE',
      character: 'Fl(2) W 10s',
      detail: 'Metal framework tower on the ledge, 12 m. 9 M.',
      group: 2,
      period: 10,
    },
  ],
  [
    {
      id: 'sowens',
      name: 'SOWENS',
      character: 'Fl(3) W 10s',
      detail: 'Beacon, black with two red bands, 9 m. 7 M. Marks the north edge of the shoal.',
      group: 3,
      period: 10,
    },
    {
      id: 'rossport-pier',
      name: 'ROSSPORT PIER HEAD',
      character: 'Fl G 5s',
      detail: 'Green column at the pier head, 6 m. 4 M.',
      group: 1,
      period: 5,
    },
    {
      id: 'ivory-bank',
      name: 'IVORY BANK, W. CARDINAL',
      character: 'Q(9) W 15s',
      detail: 'Pillar buoy, yellow-black-yellow. Marks the western limit of the bank.',
      group: 9,
      period: 15,
    },
  ],
];

interface LayerSpec {
  key: string;
  short: string;
  title: string;
  sub: string;
  /** The transform that lays this sheet on the base, and therefore the answer. */
  rot: number;
  scale: number;
  tx: number;
  ty: number;
}

const LAYERS: LayerSpec[] = [
  {
    key: 'a',
    short: '1948',
    title: 'ADMIRALTY SURVEY 1948',
    sub: 'Carries the Inquiry’s reconstructed track, drawn on it in 1975',
    rot: -3.5,
    scale: 1.035,
    tx: 26,
    ty: -18,
  },
  {
    key: 'b',
    short: '1974',
    title: 'BUOYAGE REVISION 1974',
    sub: 'The water as it was buoyed on the night, and the fairway a pilot steers',
    rot: 2.5,
    scale: 0.965,
    tx: -34,
    ty: 22,
  },
  {
    key: 'c',
    short: '1975',
    title: 'FINDING OF THE COURT, 1975',
    sub: 'The position at which the Court found the Pelagia to have struck',
    rot: 5,
    scale: 1.02,
    tx: 18,
    ty: 30,
  },
];

/** Base positions of the three marks every surveyor put on every sheet. */
const TRIG = [
  { name: 'Brannock trig pillar', x: 140, y: 118 },
  { name: 'St Bride’s tower', x: 886, y: 96 },
  { name: 'Sowens beacon', x: 520, y: 516 },
];

/** Where the Court says she struck, and where the registered sheets put her. */
const CROSS_FINDING = { x: 560, y: 402 };
const CROSS_TRACK = { x: 560 + 340 / YARDS_PER_UNIT, y: 402 };

const COASTLINE =
  'M0,0 H448 C430,54 392,84 330,106 C268,128 214,120 166,148 C118,176 66,192 0,200 Z';
const EAST_SHORE = 'M1000,0 V172 C946,158 906,132 884,100 C864,70 884,32 862,0 Z';

/** Rotate-scale-translate a chart point about the sheet centre. */
function place(
  p: { x: number; y: number },
  rotDeg: number,
  scale: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  const a = (rotDeg * Math.PI) / 180;
  const dx = (p.x - cx) * scale;
  const dy = (p.y - cy) * scale;
  return {
    x: cx + dx * Math.cos(a) - dy * Math.sin(a) + tx,
    y: cy + dx * Math.sin(a) + dy * Math.cos(a) + ty,
  };
}

/** The inverse: where a mark must sit on the sheet to land on the base. */
function unplace(
  p: { x: number; y: number },
  rotDeg: number,
  scale: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  const a = (-rotDeg * Math.PI) / 180;
  const dx = p.x - tx - cx;
  const dy = p.y - ty - cy;
  return {
    x: cx + (dx * Math.cos(a) - dy * Math.sin(a)) / scale,
    y: cy + (dx * Math.sin(a) + dy * Math.cos(a)) / scale,
  };
}

function chartLine(d: string, cls: string): SVGPathElement {
  const p = svg('path', cls);
  attrs(p, { d, fill: 'none' });
  return p;
}

function trigGlyph(x: number, y: number, cls = ''): SVGGElement {
  const g = svg('g', `cl-trig ${cls}`.trim());
  attrs(g, { transform: `translate(${x} ${y})` });
  const ring = svg('circle', 'cl-trig-ring');
  attrs(ring, { r: 11, cx: 0, cy: 0, fill: 'none' });
  const v = svg('path', 'cl-trig-cross');
  attrs(v, { d: 'M0,-17 V17 M-17,0 H17' });
  g.append(ring, v);
  return g;
}

/**
 * Retained but not registered — the sensory batch owns `puz-chart-loft`,
 * because the puzzle's primary verb is audio-rhythm timing rather than map
 * registration. Exported so this alternate take stays compiled and reachable
 * if the design ever swings back toward the navigation reading.
 */
export function chartLoftLogicVariant(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'lg-chart');
      const rail = new Rail(['The call box', 'The light table']);

      // =====================================================================
      // Stage I — the call box at Rossport
      // =====================================================================

      const stageA = h('div', 'cl-callbox');
      rail.add(stageA);

      const FLASHES = [0, 2000, 4000];
      const PERIOD = 15000;
      const FLASH_MS = 200;

      let listening = false;
      let phase = 0;
      let watchMs = 0;
      let watchRunning = false;
      const laps: number[] = [];
      let lightId = typeof ctx.state.lightId === 'string' ? (ctx.state.lightId as string) : '';

      const lamp = h('div', 'cl-lamp');
      lamp.setAttribute('aria-hidden', 'true');
      lamp.append(h('span', 'cl-lamp-glass'), h('span', 'cl-lamp-halo'));

      const listenKey = key('RECEIVER TO THE EAR', 'is-listen');
      listenKey.setAttribute('aria-pressed', 'false');

      const watchFace = h('div', 'cl-watch');
      watchFace.setAttribute('aria-hidden', 'true');
      const sweep = h('span', 'cl-watch-sweep');
      const dialFace = h('span', 'cl-watch-face');
      for (let i = 0; i < 60; i++) {
        const t = h('span', 'cl-watch-tick');
        t.classList.toggle('is-major', i % 5 === 0);
        t.style.setProperty('--tick-angle', `${i * 6}deg`);
        dialFace.appendChild(t);
      }
      watchFace.append(dialFace, sweep, h('span', 'cl-watch-boss'));

      const watchRead = h('p', 'cl-watch-read', '0.0 s');
      watchRead.setAttribute('role', 'status');

      const lapKey = key('LAP', 'is-lap');
      const resetKey = key('RETURN TO ZERO', 'is-reset');

      const lapList = h('ol', 'cl-laps');
      lapList.setAttribute('aria-label', 'Recorded flashes');

      const chit = h('div', 'cl-chit');
      chit.setAttribute('aria-roledescription', 'measured characteristic');
      const chitText = h('span', 'cl-chit-text', 'not yet timed');
      chit.append(cap('MEASURED'), chitText);

      /** Group count and period, derived from whatever laps the player took. */
      const derive = (): { group: number; period: number } | null => {
        if (laps.length < 4) return null;
        const groups: number[][] = [[laps[0]]];
        for (let i = 1; i < laps.length; i++) {
          if (laps[i] - laps[i - 1] > 7000) groups.push([laps[i]]);
          else groups[groups.length - 1].push(laps[i]);
        }
        if (groups.length < 2) return null;
        return {
          group: groups[0].length,
          period: (groups[1][0] - groups[0][0]) / 1000,
        };
      };

      /** True when the measurement is clean enough to lay against the List. */
      const measured = (): { group: number; period: number; clean: boolean } | null => {
        const d = derive();
        if (!d) return null;
        const whole = Math.round(d.period);
        const clean = Math.abs(d.period - whole) <= 1.2 && whole > 0;
        return { group: d.group, period: clean ? whole : d.period, clean };
      };

      const paintChit = () => {
        const m = measured();
        if (!m) {
          chitText.textContent = laps.length ? `${laps.length} flashes timed — keep counting` : 'not yet timed';
          chit.dataset.state = 'empty';
          return;
        }
        chit.dataset.state = m.clean ? 'clean' : 'rough';
        chitText.textContent = m.clean
          ? `Fl(${m.group}) W ${m.period}s`
          : `Fl(${m.group}) W ${m.period.toFixed(1)}s`;
      };

      const paintLaps = () => {
        lapList.textContent = '';
        laps.forEach((t, i) => {
          const li = h('li', 'cl-lap');
          li.append(
            h('span', 'cl-lap-n', String(i + 1)),
            h('span', 'cl-lap-t', `${(t / 1000).toFixed(1)} s`),
            h('span', 'cl-lap-d', i ? `+${((t - laps[i - 1]) / 1000).toFixed(1)}` : '—'),
          );
          lapList.appendChild(li);
        });
        paintChit();
      };

      let flashOn = false;
      rig.loop((dt) => {
        if (listening) {
          phase = (phase + dt) % PERIOD;
          const on = FLASHES.some((f) => phase >= f && phase < f + FLASH_MS);
          if (on !== flashOn) {
            flashOn = on;
            lamp.classList.toggle('is-on', on);
            if (on) ctx.feedback('tick');
          }
        }
        if (watchRunning) {
          watchMs += dt;
          sweep.style.setProperty('--sweep', `${((watchMs / 1000) % 60) * 6}deg`);
          watchRead.textContent = `${(watchMs / 1000).toFixed(1)} s`;
        }
      });

      listenKey.addEventListener(
        'click',
        () => {
          listening = !listening;
          listenKey.setAttribute('aria-pressed', String(listening));
          listenKey.classList.toggle('is-on', listening);
          listenKey.querySelector('.lg-key-face')!.textContent = listening
            ? 'LISTENING'
            : 'RECEIVER TO THE EAR';
          if (listening) {
            phase = PERIOD - 400;
            watchRunning = true;
            ctx.feedback('click');
            ctx.note('She taps it on the kitchen table against her kitchen clock. Count the seconds.');
          } else {
            watchRunning = false;
            lamp.classList.remove('is-on');
            flashOn = false;
            ctx.feedback('tick');
          }
        },
        { signal: rig.signal },
      );

      lapKey.addEventListener(
        'click',
        () => {
          if (!watchRunning) {
            ctx.feedback('bad');
            ctx.note('The watch is not running. Put the receiver to your ear first.');
            return;
          }
          laps.push(watchMs);
          ctx.feedback('click');
          paintLaps();
          const m = measured();
          if (m) {
            ctx.note(
              m.clean
                ? `Fl(${m.group}) W ${m.period}s. Now find it in the List.`
                : `Fl(${m.group}), and something like ${m.period.toFixed(1)} seconds. Take it again; a light does not vary.`,
            );
          }
        },
        { signal: rig.signal },
      );

      resetKey.addEventListener(
        'click',
        () => {
          laps.length = 0;
          watchMs = 0;
          watchRead.textContent = '0.0 s';
          sweep.style.setProperty('--sweep', '0deg');
          ctx.feedback('tick');
          paintLaps();
        },
        { signal: rig.signal },
      );

      // -- the Admiralty List -------------------------------------------------

      let page = 0;
      const listBody = h('div', 'cl-list-body');
      const pageRead = h('span', 'cl-list-page', '');
      const entryButtons: HTMLButtonElement[] = [];

      const answer = (entry: LightEntry) => {
        const m = measured();
        if (!m || !m.clean) {
          ctx.feedback('bad');
          ctx.note('Nothing to lay against it yet. Three flashes is not a light; three flashes and a period is.');
          return;
        }
        if (entry.id === 'cadran-point' && entry.group === m.group && entry.period === m.period) {
          lightId = entry.id;
          ctx.state.lightId = lightId;
          ctx.save();
          ctx.feedback('good');
          ctx.note(
            'Cadran Point. Nine miles south-south-east, and it has flashed three times in fifteen seconds since 1911.',
          );
          rig.after(reduced() ? 100 : 1500, () => {
            listening = false;
            watchRunning = false;
            rail.go(1, true);
          });
          return;
        }
        ctx.feedback('bad');
        ctx.note(
          entry.id === 'nine-bells'
            ? 'Twenty seconds. She counted fifteen, twice, on a kitchen clock, and she has never once been wrong.'
            : `${entry.name} is ${entry.character}. That is not what she counted, and a light does not vary.`,
        );
      };

      const paintList = () => {
        listBody.textContent = '';
        entryButtons.length = 0;
        for (const entry of LIGHT_LIST[page]) {
          const row = h('button', 'cl-entry');
          row.type = 'button';
          row.dataset.entry = entry.id;
          row.append(
            h('span', 'cl-entry-name', entry.name),
            h('span', 'cl-entry-char', entry.character),
            h('span', 'cl-entry-detail', entry.detail),
          );
          row.setAttribute('aria-label', `${entry.name}, ${entry.character}. Lay the measurement against this entry.`);
          row.addEventListener('click', () => answer(entry), { signal: rig.signal });
          entryButtons.push(row);
          listBody.appendChild(row);
        }
        pageRead.textContent = `IVORY SOUND — page ${page + 1} of ${LIGHT_LIST.length}`;
      };

      const prevPage = key('◀', 'is-page');
      const nextPage = key('▶', 'is-page');
      prevPage.setAttribute('aria-label', 'Previous page of the List of Lights');
      nextPage.setAttribute('aria-label', 'Next page of the List of Lights');
      prevPage.addEventListener(
        'click',
        () => {
          page = (page + LIGHT_LIST.length - 1) % LIGHT_LIST.length;
          ctx.feedback('tick');
          paintList();
        },
        { signal: rig.signal },
      );
      nextPage.addEventListener(
        'click',
        () => {
          page = (page + 1) % LIGHT_LIST.length;
          ctx.feedback('tick');
          paintList();
        },
        { signal: rig.signal },
      );

      const listBook = h('div', 'cl-list');
      const listHead = h('div', 'cl-list-head');
      listHead.append(
        h('p', 'cl-list-title', 'ADMIRALTY LIST OF LIGHTS 1974'),
        pageRead,
        prevPage,
        nextPage,
      );
      listBook.append(listHead, listBody);

      // The chit can be dragged onto an entry, or the entry can simply be
      // clicked — the same act, two hands, and the keyboard gets the second.
      rig.keep(
        makeDraggable(chit, {
          label: 'Measured characteristic',
          bounds: stageA,
          feedback: ctx.feedback,
          onDrop: (p) => {
            // A press that never travelled is not a drop.
            if (Math.abs(p.x) < 5 && Math.abs(p.y) < 5) return;
            const r = chit.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const hit = entryButtons.find((b) => {
              const q = b.getBoundingClientRect();
              return cx >= q.left && cx <= q.right && cy >= q.top && cy <= q.bottom;
            });
            if (!hit) return;
            const entry = LIGHT_LIST[page].find((e) => e.id === hit.dataset.entry);
            if (entry) answer(entry);
          },
        }),
      );

      const watchWell = h('div', 'cl-watch-well');
      watchWell.append(cap('STOPWATCH'), watchFace, watchRead, lapKey, resetKey);

      const phoneWell = h('div', 'cl-phone');
      phoneWell.append(
        cap('ROSSPORT CALL BOX · WOLVERHAMPTON 4471'),
        lamp,
        h('p', 'cl-phone-line', '‘Three, there was. Three, and then nothing for a good long while, and then three again.’'),
        listenKey,
      );

      const stageATop = h('div', 'cl-a-top');
      stageATop.append(phoneWell, watchWell, box('cl-lap-well', cap('FLASHES TIMED'), lapList, chit));

      stageA.append(
        plate('THE CHARACTERISTIC OF A LIGHT', [
          'Time the first flash of a group, each flash after it, and the first flash of the next group.',
          'Fl(n) is the count. The period is the time from group to group.',
          'Then lay the measurement against the List of Lights.',
        ]),
        stageATop,
        listBook,
      );

      // =====================================================================
      // Stage II — the light table
      // =====================================================================

      const stageB = h('div', 'cl-table-stage');
      rail.add(stageB);

      const table = h('div', 'cl-table');
      table.setAttribute('aria-label', 'Light table, chart of Ivory Sound');

      // -- the base sheet -----------------------------------------------------
      const base = svg('svg', 'cl-sheet is-base');
      attrs(base, { viewBox: `0 0 ${VB_W} ${VB_H}`, 'aria-hidden': 'true' });
      const sea = svg('rect', 'cl-sea');
      attrs(sea, { x: 0, y: 0, width: VB_W, height: VB_H });
      base.append(sea);
      base.append(attrs(chartLine(COASTLINE, 'cl-land'), { fill: 'currentColor' }));
      base.append(attrs(chartLine(EAST_SHORE, 'cl-land'), { fill: 'currentColor' }));
      const shoal = chartLine(
        'M566,392 C620,368 700,376 736,412 C770,446 748,492 692,502 C630,514 570,492 552,452 C540,424 546,402 566,392 Z',
        'cl-shoal',
      );
      base.append(shoal);
      const shoalLabel = svg('text', 'cl-chart-label');
      attrs(shoalLabel, { x: 640, y: 448 });
      shoalLabel.textContent = 'SOWENS SHOAL';
      base.append(shoalLabel);
      {
        const r = rng(0x5eed11);
        for (let i = 0; i < 46; i++) {
          const x = 40 + r() * (VB_W - 80);
          const y = 210 + r() * (VB_H - 250);
          const t = svg('text', 'cl-sounding');
          attrs(t, { x, y });
          t.textContent = String(4 + Math.floor(r() * 34));
          base.append(t);
        }
      }
      for (const mark of TRIG) {
        base.append(trigGlyph(mark.x, mark.y, 'is-base'));
        const t = svg('text', 'cl-chart-label is-trig');
        attrs(t, { x: mark.x + 18, y: mark.y + 4 });
        t.textContent = mark.name;
        base.append(t);
      }
      {
        const bar = svg('g', 'cl-scalebar');
        attrs(bar, { transform: 'translate(60 596)' });
        const line = svg('path', 'cl-scalebar-line');
        attrs(line, { d: 'M0,0 H100 M0,-6 V6 M50,-4 V4 M100,-6 V6' });
        const t = svg('text', 'cl-chart-label');
        attrs(t, { x: 110, y: 5 });
        t.textContent = '500 YARDS';
        bar.append(line, t);
        base.append(bar);
      }
      table.append(base);

      // -- the three transparencies -------------------------------------------

      interface LiveLayer {
        spec: LayerSpec;
        wrap: HTMLElement;
        inner: HTMLElement;
        marks: { x: number; y: number }[];
        tx: number;
        ty: number;
        rot: number;
        scale: number;
        locked: boolean;
        residuals: number[];
      }

      const layers: LiveLayer[] = [];
      let active = 0;
      let vbPerPx = VB_W / 900;

      const saved = readMap(ctx.state, 'layers');

      for (const spec of LAYERS) {
        const wrap = h('div', `cl-layer is-${spec.key}`);
        wrap.setAttribute('aria-label', `${spec.title} — drag to move`);
        const inner = h('div', 'cl-layer-inner');
        const sheet = svg('svg', 'cl-sheet is-overlay');
        attrs(sheet, { viewBox: `0 0 ${VB_W} ${VB_H}`, 'aria-hidden': 'true' });

        const marks = TRIG.map((m) => unplace(m, spec.rot, spec.scale, spec.tx, spec.ty));

        if (spec.key === 'a') {
          const track = chartLine('M120,556 C260,506 402,452 546,414 C650,388 742,372 848,364', 'cl-track');
          sheet.append(track);
          const t = svg('text', 'cl-chart-label is-sheet');
          attrs(t, { x: 150, y: 540 });
          t.textContent = 'TRACK AS RECONSTRUCTED, COURT OF INQUIRY 1975';
          sheet.append(t);
          const inset = svg('g', 'cl-inset');
          attrs(inset, { transform: 'translate(56 232)' });
          const box = svg('rect', 'cl-inset-box');
          attrs(box, { x: 0, y: 0, width: 214, height: 122 });
          const room = svg('rect', 'cl-inset-room');
          attrs(room, { x: 108, y: 62, width: 74, height: 42 });
          const walls = chartLine('M14,26 H196 M14,26 V104 M196,26 V104 M14,104 H196', 'cl-inset-walls');
          const cap1 = svg('text', 'cl-chart-label is-sheet');
          attrs(cap1, { x: 8, y: 16 });
          cap1.textContent = 'BRANNOCK HEAD · UNDERCROFT · 1948';
          const cap2 = svg('text', 'cl-chart-label is-sheet');
          attrs(cap2, { x: 100, y: 118 });
          cap2.textContent = '20 FT × 12 FT';
          inset.append(box, walls, room, cap1, cap2);
          sheet.append(inset);
        } else if (spec.key === 'b') {
          sheet.append(chartLine('M96,592 C250,540 408,470 560,402 C664,356 760,326 872,308', 'cl-fairway'));
          const t = svg('text', 'cl-chart-label is-sheet');
          attrs(t, { x: 640, y: 322 });
          t.textContent = 'FAIRWAY, BUOYED 1974';
          sheet.append(t);
          for (const b of [
            { x: 300, y: 486 },
            { x: 452, y: 428 },
            { x: 632, y: 366 },
            { x: 780, y: 330 },
          ]) {
            const buoy = svg('path', 'cl-buoy');
            attrs(buoy, { d: `M${b.x},${b.y - 12} L${b.x + 9},${b.y + 8} L${b.x - 9},${b.y + 8} Z` });
            sheet.append(buoy);
          }
        } else {
          const x = CROSS_FINDING.x;
          const y = CROSS_FINDING.y;
          sheet.append(chartLine(`M${x - 22},${y - 22} L${x + 22},${y + 22} M${x + 22},${y - 22} L${x - 22},${y + 22}`, 'cl-finding-cross'));
          const t = svg('text', 'cl-chart-label is-sheet');
          attrs(t, { x: x + 28, y: y + 6 });
          t.textContent = 'POSITION AS FOUND, PARA. 39';
          sheet.append(t);
        }

        for (const m of marks) sheet.append(trigGlyph(m.x, m.y, `is-sheet is-${spec.key}`));

        inner.append(sheet);
        wrap.append(inner);
        table.append(wrap);

        const bag = readMap(saved, spec.key);
        layers.push({
          spec,
          wrap,
          inner,
          marks,
          tx: readNum(bag, 'tx', 0),
          ty: readNum(bag, 'ty', 0),
          rot: readNum(bag, 'rot', 0),
          scale: readNum(bag, 'sc', 1),
          locked: readBool(bag, 'locked'),
          residuals: [999, 999, 999],
        });
      }

      // -- findings overlay, revealed only once all three are registered -------

      const findings = svg('svg', 'cl-sheet is-findings');
      attrs(findings, { viewBox: `0 0 ${VB_W} ${VB_H}`, 'aria-hidden': 'true' });
      findings.append(
        chartLine(
          `M${CROSS_TRACK.x - 20},${CROSS_TRACK.y - 20} L${CROSS_TRACK.x + 20},${CROSS_TRACK.y + 20} M${CROSS_TRACK.x + 20},${CROSS_TRACK.y - 20} L${CROSS_TRACK.x - 20},${CROSS_TRACK.y + 20}`,
          'cl-track-cross',
        ),
      );
      {
        const t = svg('text', 'cl-chart-label is-finding');
        attrs(t, { x: CROSS_TRACK.x + 26, y: CROSS_TRACK.y - 12 });
        t.textContent = 'B · TRACK, REGISTERED ON THE TRIG MARKS';
        findings.append(t);
        const u = svg('text', 'cl-chart-label is-finding');
        attrs(u, { x: CROSS_FINDING.x - 250, y: CROSS_FINDING.y + 34 });
        u.textContent = 'A · POSITION AS FOUND, 1975';
        findings.append(u);
      }
      table.append(findings);

      // -- the dividers --------------------------------------------------------

      const legA = h('div', 'cl-leg is-a');
      const legB = h('div', 'cl-leg is-b');
      legA.append(h('span', 'cl-leg-point'), cap('A', 'is-leg'));
      legB.append(h('span', 'cl-leg-point'), cap('B', 'is-leg'));
      const legLine = svg('svg', 'cl-leg-line');
      attrs(legLine, { viewBox: `0 0 ${VB_W} ${VB_H}`, 'aria-hidden': 'true' });
      const legPath = chartLine('', 'cl-leg-path');
      legLine.append(legPath);
      const dividers = h('div', 'cl-dividers');
      dividers.append(legLine, legA, legB);
      table.append(dividers);

      const legPos = { a: { x: 320, y: 300 }, b: { x: 420, y: 300 } };
      const legCtl: { a: Control<{ x: number; y: number }> | null; b: Control<{ x: number; y: number }> | null } = {
        a: null,
        b: null,
      };

      const divRead = h('p', 'cl-div-read', 'Dividers: —');
      divRead.setAttribute('role', 'status');

      // -- controls ------------------------------------------------------------

      const tabs = h('div', 'cl-tabs');
      tabs.setAttribute('role', 'tablist');
      const tabButtons: HTMLButtonElement[] = [];

      const residualBox = h('div', 'cl-residuals');
      const residualRows = TRIG.map((m) => {
        const bar = h('span', 'cl-res-bar');
        bar.append(h('span', 'cl-res-fill'));
        const row = h('div', 'cl-res');
        row.append(h('span', 'cl-res-name', m.name), bar, h('span', 'cl-res-num', '—'));
        residualBox.appendChild(row);
        return row;
      });

      let rotCtl: Control<number> | null = null;
      let scaleCtl: Control<number> | null = null;
      let dragCtl: Control<{ x: number; y: number }> | null = null;

      const knob = h('div', 'cl-knob');
      knob.append(h('span', 'cl-knob-mark'), h('span', 'cl-knob-knurl'));
      const knobWell = h('div', 'cl-knob-well');
      knobWell.append(cap('ROTATION'), knob);
      const knobRead = h('span', 'cl-knob-read', '0.0°');
      knobWell.append(knobRead);

      let reading1 = readBool(ctx.state, 'reading1');
      let reading2 = readBool(ctx.state, 'reading2');
      const carry1 = key('CARRY THE OFFSET TO THE CASEBOOK', 'is-carry');
      const carry2 = key('CARRY THE CHAMBER TO THE CASEBOOK', 'is-carry');
      const chamberHit = h('button', 'cl-chamber-hit');
      chamberHit.type = 'button';
      chamberHit.setAttribute(
        'aria-label',
        'Chamber under the north end of the undercroft, 1948 sheet',
      );
      table.append(chamberHit);

      const applyLayer = (L: LiveLayer) => {
        L.wrap.style.setProperty('--drag-x', `${L.tx / vbPerPx}px`);
        L.wrap.style.setProperty('--drag-y', `${L.ty / vbPerPx}px`);
        L.inner.style.setProperty('--rot', `${L.rot}deg`);
        L.inner.style.setProperty('--sc', String(L.scale));
      };

      const measureTable = () => {
        const r = table.getBoundingClientRect();
        if (r.width > 0) vbPerPx = VB_W / r.width;
      };

      /** Puts the legs back where the chart says they are, after a resize. */
      const syncLegs = () => {
        legCtl.a?.set({ x: legPos.a.x / vbPerPx, y: legPos.a.y / vbPerPx }, true);
        legCtl.b?.set({ x: legPos.b.x / vbPerPx, y: legPos.b.y / vbPerPx }, true);
      };

      const paintDividers = () => {
        attrs(legPath, { d: `M${legPos.a.x},${legPos.a.y} L${legPos.b.x},${legPos.b.y}` });
        const dist = Math.hypot(legPos.b.x - legPos.a.x, legPos.b.y - legPos.a.y) * YARDS_PER_UNIT;
        divRead.textContent = `Dividers: ${Math.round(dist / 10) * 10} yards`;
        const near = (p: { x: number; y: number }, q: { x: number; y: number }) =>
          Math.hypot(p.x - q.x, p.y - q.y) < 22;
        const spanned =
          (near(legPos.a, CROSS_FINDING) && near(legPos.b, CROSS_TRACK)) ||
          (near(legPos.b, CROSS_FINDING) && near(legPos.a, CROSS_TRACK));
        dividers.classList.toggle('is-spanned', spanned);
        carry1.disabled = !spanned || reading1;
      };

      const allRegistered = () => layers.every((L) => L.locked);

      const checkFinish = () => {
        if (reading1 && reading2) {
          ctx.feedback('good');
          ctx.note(
            'Three hundred and forty yards east of the finding, and a room under the undercroft that stops existing in 1975.',
          );
          rig.after(reduced() ? 120 : 1700, () => ctx.solve());
        }
      };

      const persistLayers = () => {
        ctx.state.layers = Object.fromEntries(
          layers.map((L) => [L.spec.key, { tx: L.tx, ty: L.ty, rot: L.rot, sc: L.scale, locked: L.locked }]),
        );
        ctx.save();
      };

      const scoreLayer = (L: LiveLayer, announce: boolean) => {
        L.residuals = L.marks.map((m, i) => {
          const w = place(m, L.rot, L.scale, L.tx, L.ty);
          return Math.hypot(w.x - TRIG[i].x, w.y - TRIG[i].y);
        });
        const ok = L.residuals.every((d) => d <= REG_TOL);
        if (ok && !L.locked) {
          L.locked = true;
          L.wrap.classList.add('is-registered');
          ctx.feedback('good');
          persistLayers();
          if (announce) {
            const left = layers.filter((x) => !x.locked).length;
            ctx.note(
              left === 0
                ? 'Three sheets of the same water, registered on the same three marks, and they do not agree.'
                : `${L.spec.title} clipped down. ${left} sheet${left === 1 ? '' : 's'} still floating.`,
            );
          }
          if (allRegistered()) {
            table.classList.add('is-registered-all');
            chamberHit.hidden = false;
            dividers.hidden = false;
          }
        } else if (!ok && L.locked) {
          L.locked = false;
          L.wrap.classList.remove('is-registered');
          table.classList.remove('is-registered-all');
        }
        return ok;
      };

      const paintResiduals = () => {
        const L = layers[active];
        residualRows.forEach((row, i) => {
          const d = L.residuals[i];
          const fill = row.querySelector<HTMLElement>('.cl-res-fill')!;
          fill.style.setProperty('--fill', String(clamp(1 - d / 120, 0, 1)));
          row.classList.toggle('is-in', d <= REG_TOL);
          row.querySelector('.cl-res-num')!.textContent = `${d.toFixed(0)}`;
        });
        residualBox.classList.toggle('is-registered', L.locked);
      };

      const rebuildControls = () => {
        rotCtl?.destroy();
        scaleCtl?.destroy();
        dragCtl?.destroy();
        const L = layers[active];

        rotCtl = makeRotatable(knob, {
          angle: L.rot,
          detent: 0.5,
          min: -14,
          max: 14,
          step: 0.5,
          label: `${L.spec.title} — rotation`,
          feedback: ctx.feedback,
          onChange: (deg) => {
            L.rot = deg;
            knobRead.textContent = `${deg.toFixed(1)}°`;
            applyLayer(L);
            scoreLayer(L, true);
            paintResiduals();
          },
          onCommit: () => persistLayers(),
        });

        scaleCtl = makeSlider({
          label: `${L.spec.title} — scale`,
          min: 0.9,
          max: 1.1,
          step: 0.005,
          value: L.scale,
          length: 'clamp(8rem, 22cqw, 15rem)',
          format: (v) => `× ${v.toFixed(3)}`,
          feedback: ctx.feedback,
          onChange: (v, committed) => {
            L.scale = v;
            applyLayer(L);
            scoreLayer(L, true);
            paintResiduals();
            if (committed) persistLayers();
          },
        });

        dragCtl = makeDraggable(L.wrap, {
          label: `${L.spec.title} — position`,
          bounds: null,
          grid: 1,
          step: 1,
          position: { x: L.tx / vbPerPx, y: L.ty / vbPerPx },
          feedback: ctx.feedback,
          onMove: (p) => {
            L.tx = p.x * vbPerPx;
            L.ty = p.y * vbPerPx;
            L.inner.style.setProperty('--rot', `${L.rot}deg`);
            scoreLayer(L, true);
            paintResiduals();
          },
          onDrop: () => persistLayers(),
        });

        scaleWell.textContent = '';
        scaleWell.append(cap('SCALE'), scaleCtl.el);
        knobRead.textContent = `${L.rot.toFixed(1)}°`;
        layers.forEach((x, i) => {
          x.wrap.classList.toggle('is-active', i === active);
          x.wrap.style.setProperty('--layer-z', String(i === active ? 6 : 3));
          x.wrap.tabIndex = i === active ? 0 : -1;
          // The outgoing draggable strips its own translation on teardown, so
          // every sheet has its position restated after any rebuild.
          applyLayer(x);
        });
        paintResiduals();
      };

      const scaleWell = h('div', 'cl-scale-well');

      LAYERS.forEach((spec, i) => {
        const tab = h('button', 'cl-tab');
        tab.type = 'button';
        attrs(tab, { role: 'tab', 'aria-selected': String(i === 0) });
        tab.append(h('span', 'cl-tab-short', spec.short), h('span', 'cl-tab-title', spec.sub));
        tab.addEventListener(
          'click',
          () => {
            active = i;
            tabButtons.forEach((b, n) => b.setAttribute('aria-selected', String(n === i)));
            ctx.feedback('click');
            rebuildControls();
          },
          { signal: rig.signal },
        );
        tabButtons.push(tab);
        tabs.appendChild(tab);
      });

      // Dividers: pointer-dragged, keyboard-nudged, same as anything else here.
      for (const [name, leg] of [
        ['a', legA],
        ['b', legB],
      ] as const) {
        legCtl[name] = rig.keep(
          makeDraggable(leg, {
            label: `Dividers, leg ${name.toUpperCase()}`,
            grid: 1,
            step: 2,
            position: { x: legPos[name].x / vbPerPx, y: legPos[name].y / vbPerPx },
            feedback: ctx.feedback,
            onMove: (p) => {
              legPos[name] = { x: p.x * vbPerPx, y: p.y * vbPerPx };
              paintDividers();
            },
          }),
        );
      }

      carry1.addEventListener(
        'click',
        () => {
          if (reading1) return;
          reading1 = true;
          ctx.state.reading1 = true;
          ctx.save();
          ctx.feedback('good');
          carry1.disabled = true;
          carry1.querySelector('.lg-key-face')!.textContent = 'OFFSET RECORDED · 340 YARDS EAST';
          ctx.note('Three hundred and forty yards east of the finding, and dead on the line a pilot would steer.');
          checkFinish();
        },
        { signal: rig.signal },
      );

      chamberHit.addEventListener(
        'click',
        () => {
          if (reading2) return;
          ctx.feedback('click');
          chamberHit.classList.add('is-found');
          carry2.hidden = false;
          ctx.note('Twenty feet by twelve, under the north end of the undercroft, on the 1948 sheet and no sheet after it.');
        },
        { signal: rig.signal },
      );

      carry2.addEventListener(
        'click',
        () => {
          if (reading2) return;
          reading2 = true;
          ctx.state.reading2 = true;
          ctx.save();
          ctx.feedback('good');
          carry2.disabled = true;
          carry2.querySelector('.lg-key-face')!.textContent = 'CHAMBER RECORDED · 20 FT × 12 FT';
          checkFinish();
        },
        { signal: rig.signal },
      );

      const controls = box(
        'cl-controls',
        tabs,
        box('cl-knobs', knobWell, scaleWell),
        cap('RESIDUAL AT EACH MARK, IN CHART UNITS'),
        residualBox,
        divRead,
        carry1,
        carry2,
      );

      stageB.append(
        plate('REGISTRATION', [
          'Three sheets, three marks: Brannock trig pillar, St Bride’s tower, Sowens beacon.',
          'Move, turn and scale each sheet until all three residuals fall inside ten units.',
          'Register on the marks the surveyor put there. Never on the coastline.',
        ]),
        box('cl-table-row', table),
        controls,
      );

      // -- assembly ------------------------------------------------------------

      const stageHolder = h('div', 'lg-stages');
      stageHolder.append(stageA, stageB);
      el.append(rail.el, stageHolder);

      rail.onGo = (i) => {
        el.dataset.stage = String(i);
        if (i === 1) {
          measureTable();
          for (const L of layers) {
            applyLayer(L);
            scoreLayer(L, false);
          }
          table.classList.toggle('is-registered-all', allRegistered());
          chamberHit.hidden = !allRegistered();
          dividers.hidden = !allRegistered();
          syncLegs();
          paintDividers();
          rebuildControls();
        }
      };

      rig.watch(table, () => {
        measureTable();
        for (const L of layers) applyLayer(L);
        syncLegs();
        paintDividers();
      });

      chamberHit.hidden = true;
      dividers.hidden = true;
      carry2.hidden = true;
      carry1.disabled = true;
      if (reading1) {
        carry1.querySelector('.lg-key-face')!.textContent = 'OFFSET RECORDED · 340 YARDS EAST';
      }
      if (reading2) {
        carry2.hidden = false;
        carry2.disabled = true;
        carry2.querySelector('.lg-key-face')!.textContent = 'CHAMBER RECORDED · 20 FT × 12 FT';
      }

      paintLaps();
      paintList();
      rail.go(lightId ? 1 : 0);

      ctx.note(
        lightId
          ? 'Three surveys of the same water on one light table. Register them on the marks.'
          : 'A call box at Rossport, and a woman in Wolverhampton who has never once been wrong.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-reconciliation — "The Third Column"
// Pike's kitchen table at Cardew, one in the morning. Act III.
//
// Three books that have never been in the same room. Nobody did anything
// wrong: the Cashier collected the dues, the Accountant paid the wages, the
// Storekeeper issued the oil, and each of them did their own job correctly
// for seventy-one days. The apparatus is a ruled form, and the form has no
// opinion in it whatsoever.
// ===========================================================================

interface WeekRow {
  short: string;
  long: string;
  dues: number;
  vessels: number;
  wages: number;
  /** Gallons, or null where the Oil Requisition Book simply stops. */
  oil: number | null;
  /** The wage sheet's marginal note: relief deferred, wages to continue. */
  cont: boolean;
}

const WEEK_LABELS: [string, string][] = [
  ['30 Jun', '30 June 1974'],
  ['7 Jul', '7 July 1974'],
  ['14 Jul', '14 July 1974'],
  ['21 Jul', '21 July 1974'],
  ['28 Jul', '28 July 1974'],
  ['4 Aug', '4 August 1974'],
  ['11 Aug', '11 August 1974'],
  ['18 Aug', '18 August 1974'],
  ['25 Aug', '25 August 1974'],
  ['1 Sep', '1 September 1974'],
  ['8 Sep', '8 September 1974'],
  ['15 Sep', '15 September 1974'],
  ['22 Sep', '22 September 1974'],
  ['29 Sep', '29 September 1974'],
  ['6 Oct', '6 October 1974'],
  ['13 Oct', '13 October 1974'],
  ['20 Oct', '20 October 1974'],
  ['27 Oct', '27 October 1974'],
  ['3 Nov', '3 November 1974'],
  ['10 Nov', '10 November 1974'],
  ['17 Nov', '17 November 1974'],
  ['24 Nov', '24 November 1974'],
  ['1 Dec', '1 December 1974'],
  ['8 Dec', '8 December 1974'],
  ['15 Dec', '15 December 1974'],
  ['22 Dec', '22 December 1974'],
  ['29 Dec', '29 December 1974'],
];

/** Weekly keeper's wage: £18 4s 0d. Eleven of these is £200 4s 0d. */
const WAGE_PENCE = 4368;

/** The ten complete dues weeks, 1 September to 3 November: £4,180 4s 0d. */
const DUES_TEN = [111340, 100260, 107880, 92600, 120540, 98500, 83200, 102760, 89100, 97068];
const VESSELS_TEN = [131, 118, 127, 109, 142, 116, 98, 121, 105, 115];
const DUES_BEFORE = [104880, 98760, 112400, 95640, 108920, 101340, 99480, 115260, 106800];
const DUES_AFTER = [93120, 88640, 79920, 84360, 76840, 71280, 68940, 73560];
const VESSELS_BEFORE = [124, 116, 133, 112, 129, 119, 117, 136, 126];
const VESSELS_AFTER = [110, 104, 94, 99, 90, 84, 81, 86];
const OIL_GALLONS = [240, 190, 220, 200, 260, 210, 230, 180, 220];

/** Rows 9 to 18 inclusive are the ten weeks the finding turns on. */
const TEN_FROM = 9;
const TEN_TO = 18;

const WEEKS: WeekRow[] = WEEK_LABELS.map(([short, long], i) => ({
  short,
  long,
  dues: i < 9 ? DUES_BEFORE[i] : i <= TEN_TO ? DUES_TEN[i - TEN_FROM] : DUES_AFTER[i - 19],
  vessels: i < 9 ? VESSELS_BEFORE[i] : i <= TEN_TO ? VESSELS_TEN[i - TEN_FROM] : VESSELS_AFTER[i - 19],
  wages: WAGE_PENCE,
  oil: i < 9 ? OIL_GALLONS[i] : null,
  cont: i >= 9 && i <= 19,
}));

const PAGES: { label: string; from: number; to: number }[] = [
  { label: 'JUNE – JULY', from: 0, to: 4 },
  { label: 'AUGUST', from: 5, to: 8 },
  { label: 'SEPTEMBER', from: 9, to: 13 },
  { label: 'OCTOBER', from: 14, to: 17 },
  { label: 'NOVEMBER', from: 18, to: 21 },
  { label: 'DECEMBER', from: 22, to: 26 },
];

type BookId = 'dues' | 'wages' | 'oil';

const BOOKS: { id: BookId; title: string; kept: string; column: string }[] = [
  {
    id: 'dues',
    title: 'LIGHT DUES LEDGER',
    kept: 'Cashier’s Office · Miss Charnock · every week without exception',
    column: 'DUES COLLECTED',
  },
  {
    id: 'wages',
    title: 'KEEPER’S WAGE SHEETS',
    kept: 'Accounts · counter-signed weekly',
    column: 'WAGES PAID',
  },
  {
    id: 'oil',
    title: 'OIL REQUISITION BOOK · NINE BELLS 1966–1980',
    kept: 'Depot store · issued against requisition',
    column: 'OIL DRAWN',
  },
];

function reconciliation(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'lg-recon');
      const rail = new Rail(['The kitchen table', 'The Post Room']);

      // -- restored state -----------------------------------------------------
      const savedCarried = readMap(ctx.state, 'carried');
      const carried: Record<BookId, number> = {
        dues: clamp(readNum(savedCarried, 'dues', 0), 0, PAGES.length),
        wages: clamp(readNum(savedCarried, 'wages', 0), 0, PAGES.length),
        oil: clamp(readNum(savedCarried, 'oil', 0), 0, PAGES.length),
      };
      const nilStruck = new Set<number>(
        readStrings(ctx.state, 'nil')
          .map((s) => Number(s))
          .filter((n) => Number.isInteger(n) && n >= 9 && n <= 26),
      );
      const cast = new Set<string>(readStrings(ctx.state, 'cast'));

      // -- the form -----------------------------------------------------------

      const form = h('div', 'rc-form');
      const formHead = h('div', 'rc-row is-head');
      formHead.append(
        h('span', 'rc-cell is-week', 'WEEK ENDING'),
        h('span', 'rc-cell is-dues', 'DUES COLLECTED'),
        h('span', 'rc-cell is-wages', 'WAGES PAID'),
        h('span', 'rc-cell is-oil', 'OIL DRAWN'),
        h('span', 'rc-cell is-diff', 'DIFFERENCE'),
      );
      const formBody = h('div', 'rc-body');
      formBody.setAttribute('role', 'table');
      formBody.setAttribute('aria-label', 'Conservancy reconciliation form, twenty-seven weeks');

      interface RowEls {
        row: HTMLElement;
        dues: HTMLElement;
        wages: HTMLElement;
        oil: HTMLButtonElement;
        diff: HTMLElement;
      }

      const rowEls: RowEls[] = WEEKS.map((w, i) => {
        const row = h('div', 'rc-row');
        row.dataset.week = String(i);
        if (i === TEN_TO) row.classList.add('is-wreck');
        const week = h('span', 'rc-cell is-week');
        week.append(h('span', 'rc-week-n', String(i + 1)), h('span', 'rc-week-d', w.short));
        const dues = h('span', 'rc-cell is-dues');
        const wages = h('span', 'rc-cell is-wages');
        const oil = h('button', 'rc-cell is-oil');
        oil.type = 'button';
        const diff = h('span', 'rc-cell is-diff');
        row.append(week, dues, wages, oil, diff);
        formBody.appendChild(row);
        return { row, dues, wages, oil, diff };
      });

      const duesCast = key('CAST', 'is-cast');
      const wagesCast = key('CAST', 'is-cast');
      const oilCast = key('CAST', 'is-cast');
      const diffCast = key('CAST', 'is-cast');
      const foot = h('div', 'rc-row is-foot');
      foot.append(
        h('span', 'rc-cell is-week', 'CAST'),
        box('rc-cell is-dues', duesCast),
        box('rc-cell is-wages', wagesCast),
        box('rc-cell is-oil', oilCast),
        box('rc-cell is-diff', diffCast),
      );
      const totalsPlate = box('rc-totals-well', cap('CAST'));
      form.append(formHead, formBody, foot, totalsPlate);

      // -- the totals plate ----------------------------------------------------

      const totals = h('dl', 'rc-totals');
      totalsPlate.appendChild(totals);
      const totalRow = (term: string, value: string) => {
        const dt = h('dt', 'rc-total-term', term);
        const dd = h('dd', 'rc-total-value', value);
        totals.append(dt, dd);
      };

      const sum = (pick: (w: WeekRow, i: number) => number, from = 0, to = WEEKS.length - 1) => {
        let t = 0;
        for (let i = from; i <= to; i++) t += pick(WEEKS[i], i);
        return t;
      };

      const paintTotals = () => {
        totals.textContent = '';
        if (cast.has('dues')) {
          totalRow('Dues, twenty-seven weeks', lsd(sum((w) => w.dues)));
          totalRow('Dues, ten weeks 1 Sep – 3 Nov', lsd(sum((w) => w.dues, TEN_FROM, TEN_TO)));
          totalRow(
            'Vessels charged, those ten weeks',
            sum((w) => w.vessels, TEN_FROM, TEN_TO).toLocaleString('en-GB'),
          );
        }
        if (cast.has('wages')) {
          totalRow('Wages, twenty-seven weeks', lsd(sum((w) => w.wages)));
          totalRow(
            'Wages, weeks marked “wages to continue”',
            lsd(sum((w) => (w.cont ? w.wages : 0))),
          );
        }
        if (cast.has('oil')) {
          totalRow('Oil drawn, twenty-seven weeks', `${sum((w) => w.oil ?? 0)} gallons`);
          totalRow('Last entry in the book', '24 August 1974 · R.749 · 220 galls');
        }
        if (cast.has('diff')) {
          totalRow(
            'Difference, weeks with no oil, to 3 Nov',
            lsd(sum((w, i) => (w.oil === null && i <= TEN_TO ? w.dues : 0))),
          );
          totalRow('Difference, all weeks with no oil', lsd(sum((w) => (w.oil === null ? w.dues : 0))));
        }
        if (!totals.childElementCount) {
          totalRow('Nothing cast yet', 'Cast it week by week. Do not skip to the end.');
        }
      };

      // -- painting the form ---------------------------------------------------

      const duesDone = () => carried.dues >= PAGES.length;
      const wagesDone = () => carried.wages >= PAGES.length;
      const oilPageCarried = (i: number) => {
        const p = PAGES.findIndex((pg) => i >= pg.from && i <= pg.to);
        return carried.oil > p;
      };
      const oilDone = () =>
        carried.oil >= PAGES.length && WEEKS.every((w, i) => w.oil !== null || nilStruck.has(i));

      const paintForm = () => {
        WEEKS.forEach((w, i) => {
          const r = rowEls[i];
          const hasDues = carried.dues > PAGES.findIndex((pg) => i >= pg.from && i <= pg.to);
          const hasWages = carried.wages > PAGES.findIndex((pg) => i >= pg.from && i <= pg.to);
          r.dues.textContent = hasDues ? lsd(w.dues) : '';
          r.dues.classList.toggle('is-written', hasDues);
          if (hasDues) r.dues.append(h('span', 'rc-sub', `${w.vessels} vsl`));
          r.wages.textContent = hasWages ? lsd(w.wages) : '';
          r.wages.classList.toggle('is-written', hasWages);
          if (hasWages && w.cont) r.wages.append(h('span', 'rc-sub', 'to continue'));

          const written = w.oil !== null && oilPageCarried(i);
          const struck = w.oil === null && nilStruck.has(i);
          r.oil.textContent = written ? `${w.oil} galls` : struck ? 'nil' : '';
          r.oil.classList.toggle('is-written', written);
          r.oil.classList.toggle('is-nil', struck);
          const strikeable = w.oil === null && oilPageCarried(i) && !struck;
          r.oil.disabled = !strikeable;
          r.oil.classList.toggle('is-strikeable', strikeable);
          r.oil.setAttribute(
            'aria-label',
            written
              ? `Oil drawn, week ending ${w.long}: ${w.oil} gallons`
              : struck
                ? `Oil, week ending ${w.long}: struck nil`
                : strikeable
                  ? `Strike nil: no oil drawn in the week ending ${w.long}`
                  : `Oil, week ending ${w.long}: not yet carried forward`,
          );

          const settled = hasDues && hasWages && (written || struck);
          r.diff.textContent = settled ? (struck ? lsd(w.dues) : '—') : '';
          r.diff.classList.toggle('is-written', settled);
          r.diff.classList.toggle('is-adverse', settled && struck);
          r.row.classList.toggle('is-settled', settled);
        });

        duesCast.disabled = !duesDone() || cast.has('dues');
        wagesCast.disabled = !wagesDone() || cast.has('wages');
        oilCast.disabled = !oilDone() || cast.has('oil');
        diffCast.disabled =
          !(duesDone() && wagesDone() && oilDone()) || cast.has('diff');
        for (const [id, k] of [
          ['dues', duesCast],
          ['wages', wagesCast],
          ['oil', oilCast],
          ['diff', diffCast],
        ] as const) {
          k.classList.toggle('is-done', cast.has(id));
          k.querySelector('.lg-key-face')!.textContent = cast.has(id) ? 'CAST ✓' : 'CAST';
        }
        paintTotals();
        paintFindingGate();
      };

      // -- the three books ------------------------------------------------------

      let openBook: BookId = 'dues';
      let openPage = 0;

      const bookTabs = h('div', 'rc-book-tabs');
      bookTabs.setAttribute('role', 'tablist');
      const bookTabEls: HTMLButtonElement[] = [];
      const bookBody = h('div', 'rc-book-body');
      const bookHead = h('p', 'rc-book-title', '');
      const bookKept = h('p', 'rc-book-kept', '');
      const pageRead = h('span', 'rc-page-read', '');
      const carryKey = key('CARRY THIS PAGE FORWARD', 'is-carry');
      const prevKey = key('◀', 'is-page');
      const nextKey = key('▶', 'is-page');
      prevKey.setAttribute('aria-label', 'Previous page');
      nextKey.setAttribute('aria-label', 'Next page');

      const paintBook = () => {
        const book = BOOKS.find((b) => b.id === openBook)!;
        bookHead.textContent = book.title;
        bookKept.textContent = book.kept;
        const page = PAGES[openPage];
        pageRead.textContent = `${page.label} · page ${openPage + 1} of ${PAGES.length}`;
        bookBody.textContent = '';

        const lines: HTMLElement[] = [];
        for (let i = page.from; i <= page.to; i++) {
          const w = WEEKS[i];
          if (openBook === 'oil' && w.oil === null) continue;
          const line = h('div', 'rc-line');
          line.append(h('span', 'rc-line-date', w.long));
          if (openBook === 'dues') {
            line.append(
              h('span', 'rc-line-val', lsd(w.dues)),
              h('span', 'rc-line-note', `${w.vessels} vessels charged`),
            );
          } else if (openBook === 'wages') {
            line.append(
              h('span', 'rc-line-val', lsd(w.wages)),
              h('span', 'rc-line-note', w.cont ? 'relief deferred — wages to continue' : 'keeper, one week'),
            );
          } else {
            line.append(
              h('span', 'rc-line-val', `${w.oil} galls`),
              h('span', 'rc-line-note', i === 8 ? 'R.749 — 24.8.74 — issued to the relief boat' : 'against requisition'),
            );
          }
          lines.push(line);
          bookBody.appendChild(line);
        }
        if (!lines.length) {
          const empty = h('p', 'rc-empty');
          empty.textContent =
            'No entries on this page. The book is ruled, dated and blank, in a hand that never missed a week for eight years.';
          bookBody.appendChild(empty);
        }

        const done = carried[openBook] > openPage;
        carryKey.disabled = done;
        carryKey.querySelector('.lg-key-face')!.textContent = done
          ? 'CARRIED FORWARD ✓'
          : 'CARRY THIS PAGE FORWARD';
        bookTabEls.forEach((t, n) => {
          t.setAttribute('aria-selected', String(BOOKS[n].id === openBook));
          t.classList.toggle('is-open', BOOKS[n].id === openBook);
        });
      };

      BOOKS.forEach((b) => {
        const tab = h('button', 'rc-book-tab');
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.append(h('span', 'rc-book-tab-name', b.column));
        tab.addEventListener(
          'click',
          () => {
            openBook = b.id;
            openPage = clamp(carried[b.id], 0, PAGES.length - 1);
            ctx.feedback('click');
            paintBook();
          },
          { signal: rig.signal },
        );
        bookTabEls.push(tab);
        bookTabs.appendChild(tab);
      });

      prevKey.addEventListener(
        'click',
        () => {
          openPage = (openPage + PAGES.length - 1) % PAGES.length;
          ctx.feedback('tick');
          paintBook();
        },
        { signal: rig.signal },
      );
      nextKey.addEventListener(
        'click',
        () => {
          openPage = (openPage + 1) % PAGES.length;
          ctx.feedback('tick');
          paintBook();
        },
        { signal: rig.signal },
      );

      const persist = () => {
        ctx.state.carried = { ...carried };
        ctx.state.nil = [...nilStruck].map(String);
        ctx.state.cast = [...cast];
        ctx.save();
      };

      carryKey.addEventListener(
        'click',
        () => {
          if (carried[openBook] > openPage) return;
          if (openPage !== carried[openBook]) {
            ctx.feedback('bad');
            ctx.note('Cast it week by week. Do not skip to the end — the end is where you make things up.');
            return;
          }
          carried[openBook] = openPage + 1;
          ctx.feedback('click');
          persist();
          paintBook();
          paintForm();
          const page = PAGES[openPage];
          for (let i = page.from; i <= page.to; i++) {
            const r = rowEls[i];
            r.row.classList.remove('is-inked');
            void r.row.offsetWidth;
            r.row.style.setProperty('--ink-delay', `${(i - page.from) * 70}ms`);
            r.row.classList.add('is-inked');
          }
          // The page lever always turns the leaf for you: the discipline this
          // exercise enforces is *order*, and a book that stalls on the page
          // you have just finished is a fiddle, not a discipline.
          const firstBlankOil = openBook === 'oil' && carried.oil === 3;
          if (carried[openBook] < PAGES.length) openPage = carried[openBook];
          paintBook();
          if (firstBlankOil) {
            ctx.note('September, and the Oil Requisition Book is ruled, dated and empty. Strike the column nil and go on.');
          } else if (carried[openBook] >= PAGES.length) {
            ctx.note(`${BOOKS.find((b) => b.id === openBook)!.column} carried, all twenty-seven weeks.`);
          }
        },
        { signal: rig.signal },
      );

      rowEls.forEach((r, i) => {
        r.oil.addEventListener(
          'click',
          () => {
            if (WEEKS[i].oil !== null || nilStruck.has(i)) return;
            nilStruck.add(i);
            ctx.feedback('tick');
            persist();
            paintForm();
            const n = nilStruck.size;
            if (n === 1) ctx.note('Nil. The first week in eight years that nothing was drawn for that rock.');
            else if (n % 6 === 0) ctx.note(`${n} weeks struck nil, and the dues column has not missed one of them.`);
            else if (n === 18) ctx.note('Eighteen weeks. Not one gallon, and not one week without dues.');
          },
          { signal: rig.signal },
        );
      });

      const castKey = (id: string, k: HTMLButtonElement, line: string) => {
        k.addEventListener(
          'click',
          () => {
            if (cast.has(id)) return;
            cast.add(id);
            ctx.feedback('click');
            persist();
            paintForm();
            ctx.note(line);
          },
          { signal: rig.signal },
        );
      };
      castKey('dues', duesCast, 'Dues collected every week, without one exception, for twenty-seven weeks.');
      castKey('wages', wagesCast, 'Wages paid every week, and eleven of them marked “to continue”.');
      castKey('oil', oilCast, 'Oil drawn on the twenty-fourth of August 1974 and never again.');
      castKey(
        'diff',
        diffCast,
        'And there it is, cast in my own hand, and it is not going to agree however many times I do it.',
      );

      // -- the finding line ------------------------------------------------------

      const fPounds = rig.keep(
        makeWheels({ label: 'Dues charged — pounds', digits: 4, unit: '£', feedback: ctx.feedback }),
      );
      const fShillings = rig.keep(
        makeWheels({ label: 'Dues charged — shillings', digits: 2, unit: 's', feedback: ctx.feedback }),
      );
      const fPence = rig.keep(
        makeWheels({ label: 'Dues charged — pence', digits: 2, unit: 'd', feedback: ctx.feedback }),
      );
      const fVessels = rig.keep(
        makeWheels({ label: 'Vessels charged', digits: 4, feedback: ctx.feedback }),
      );
      const fDays = rig.keep(makeWheels({ label: 'Days dark', digits: 2, feedback: ctx.feedback }));
      const wPounds = rig.keep(
        makeWheels({ label: 'Wages paid — pounds', digits: 3, unit: '£', feedback: ctx.feedback }),
      );
      const wShillings = rig.keep(
        makeWheels({ label: 'Wages paid — shillings', digits: 2, unit: 's', feedback: ctx.feedback }),
      );
      const wPence = rig.keep(
        makeWheels({ label: 'Wages paid — pence', digits: 2, unit: 'd', feedback: ctx.feedback }),
      );

      const signKey = key('SIGN THE FINDING', 'is-sign');
      const findingBox = h('div', 'rc-finding');

      const fieldRow = (label: string, ...parts: HTMLElement[]) => {
        const r = h('div', 'rc-field');
        r.append(h('span', 'rc-field-label', label), box('rc-field-wheels', ...parts));
        return r;
      };

      findingBox.append(
        h('p', 'rc-finding-head', 'FINDING'),
        h(
          'p',
          'rc-finding-lede',
          'Between the twenty-fourth of August and the third of November 1974 the Nine Bells beacon exhibited no light. In that period this Authority —',
        ),
        fieldRow('charged, in light dues', fPounds.el, fShillings.el, fPence.el),
        fieldRow('to this number of vessels', fVessels.el),
        fieldRow('over this number of days', fDays.el),
        fieldRow('and paid, in wages to an absent keeper', wPounds.el, wShillings.el, wPence.el),
        signKey,
      );

      const paintFindingGate = () => {
        const ready = cast.has('dues') && cast.has('wages') && cast.has('oil') && cast.has('diff');
        findingBox.classList.toggle('is-ready', ready);
        signKey.disabled = !ready;
      };

      signKey.addEventListener(
        'click',
        () => {
          const wrong: string[] = [];
          if (fPounds.get() !== 4180 || fShillings.get() !== 4 || fPence.get() !== 0)
            wrong.push('the dues');
          if (fVessels.get() !== 1182) wrong.push('the vessels');
          if (fDays.get() !== 71) wrong.push('the days');
          if (wPounds.get() !== 200 || wShillings.get() !== 4 || wPence.get() !== 0)
            wrong.push('the wages');
          if (wrong.length) {
            ctx.feedback('bad');
            ctx.note(
              `Not yet: ${wrong.join(', ')}. Read it off the cast. The form has no opinion and neither may I.`,
            );
            return;
          }
          ctx.feedback('good');
          ctx.state.finding = true;
          ctx.save();
          ctx.note('Four thousand one hundred and eighty pounds four shillings, for a light that was not burning.');
          rig.after(reduced() ? 120 : 1900, () => rail.go(1, true));
        },
        { signal: rig.signal },
      );

      // -- Stage II: the Post Room coda --------------------------------------

      const coda = h('div', 'rc-coda');

      const impressions = rig.keep(
        makeWheels({ label: 'Impressions actually struck', digits: 3, feedback: ctx.feedback }),
      );
      const codaKey = key('ENTER IN THE CASEBOOK', 'is-sign');

      codaKey.addEventListener(
        'click',
        () => {
          const v = impressions.get();
          if (v === 214) {
            ctx.feedback('bad');
            ctx.note('That is what the docket says. The meter is not a docket; it counts impressions.');
            return;
          }
          if (v !== 213) {
            ctx.feedback('bad');
            ctx.note('Eight hundred and fifty-two pence, at fourpence the impression. Do the division again.');
            return;
          }
          ctx.feedback('good');
          ctx.state.coda = true;
          ctx.save();
          ctx.note('Two hundred and thirteen. One envelope was not franked and was not posted, and it was the one addressed to the rock.');
          rig.after(reduced() ? 140 : 2000, () => ctx.solve());
        },
        { signal: rig.signal },
      );

      coda.append(
        plate('THE POST ROOM, AFTERWARDS', [
          'Despatch docket, 16 August 1974, foot: “214 @ 4d — £3 11s 4d”.',
          'Meter card book, same date: descending register fell £3 11s 0d.',
          'The distribution list, Schedule D, names two hundred and fourteen addressees.',
        ]),
        box(
          'rc-coda-sums',
          box('rc-sum', cap('THE DOCKET SAYS'), h('p', 'rc-sum-val', '£3 11s 4d'), h('p', 'rc-sum-sub', '852 pence')),
          box('rc-sum', cap('THE METER FELL BY'), h('p', 'rc-sum-val', '£3 11s 0d'), h('p', 'rc-sum-sub', '848 pence')),
          box('rc-sum', cap('THE RATE'), h('p', 'rc-sum-val', '4d'), h('p', 'rc-sum-sub', 'the fourpenny die')),
        ),
        box(
          'rc-coda-entry',
          h('p', 'rc-field-label', 'Impressions actually struck on 16 August 1974'),
          impressions.el,
          codaKey,
        ),
      );

      // -- assembly -------------------------------------------------------------

      const bookPanel = h('div', 'rc-books');
      const bookFoot = h('div', 'rc-book-foot');
      bookFoot.append(prevKey, pageRead, nextKey);
      bookPanel.append(bookTabs, bookHead, bookKept, bookBody, bookFoot, carryKey);

      const tableStage = h('div', 'rc-stage');
      rail.add(tableStage);
      rail.add(coda);
      tableStage.append(
        plate('CONSERVANCY RECONCILIATION · FORM 14', [
          'Carry each book forward a page at a time, in order. The form casts nothing you have not read.',
          'Where a book has no entry, the column must be struck nil. A blank is not a figure.',
          'Then cast the columns and write the finding in the words the form gives you.',
        ]),
        box('rc-table', bookPanel, form, findingBox),
      );

      const stageHolder = h('div', 'lg-stages');
      stageHolder.append(tableStage, coda);
      el.append(rail.el, stageHolder);
      rail.onGo = (i) => {
        el.dataset.stage = String(i);
      };

      paintBook();
      paintForm();
      openPage = clamp(carried.dues, 0, PAGES.length - 1);
      paintBook();
      rail.go(readBool(ctx.state, 'finding') ? 1 : 0);

      ctx.note(
        readBool(ctx.state, 'finding')
          ? 'The despatch docket of the sixteenth of August, and a meter that counts impressions.'
          : 'Three books that have never been on the same table. Cast it week by week.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-board-of-dissolution — "The Board of Dissolution"
// The Board Room, Pilotage House, 14:00, 3 November 1998. Act V.
//
// The masterpiece is not the interface, it is the rule: an assertion supported
// by a document in the appraiser's possession stands unless the document is
// impeached, and an assertion supported by what you were told stands until the
// first question. Every exhibit chip on this board is a thing the player
// physically recovered. What they never found is not here, and its absence is
// the score.
// ===========================================================================

interface Exhibit {
  clue: string;
  name: string;
  acc: string;
}

/** Everything that can reach the table, with the mark it is docketed under. */
const EXHIBITS: Exhibit[] = [
  { clue: 'clue-slip-r982211', name: 'Requisition slip R98/2211', acc: 'X.1' },
  { clue: 'clue-gallery-timeswitch', name: 'Gallery time-switch counter', acc: 'X.2' },
  { clue: 'clue-visitors-book', name: 'Visitors’ Book, 14.9.98', acc: 'X.3' },
  { clue: 'clue-ferry-booking-book', name: 'Rossport ferry booking book', acc: 'X.4' },
  { clue: 'clue-site-diary-rail', name: 'Site diary, items 41 and 63', acc: 'X.5' },
  { clue: 'clue-accident-report', name: 'Accident report, 14.9.98', acc: 'X.6' },
  { clue: 'clue-spectacles', name: 'Sallow’s spectacles', acc: 'X.7' },
  { clue: 'clue-dust-jar-6', name: 'Dust jar 6 v. coroner’s exhibit 4', acc: 'X.8' },
  { clue: 'clue-incinerator-damper', name: 'Site diary, item 41: the damper', acc: 'X.9' },
  { clue: 'clue-reprax-1998', name: 'Duplicating book, 14.9.98', acc: 'X.10' },
  { clue: 'clue-box17-relabel', name: 'Box 17, relabelled', acc: 'X.11' },
  { clue: 'clue-a-curve-applied', name: 'The Imperial 66 ‘a’-occlusion curve', acc: 'X.12' },
  { clue: 'clue-chart-overlays', name: 'Three registered surveys', acc: 'X.13' },
  { clue: 'clue-sallow-1975-transcript', name: 'Sallow’s evidence, 1975, day 9', acc: 'X.14' },
  { clue: 'clue-issued-register', name: 'Register of Notices Issued, 1974', acc: 'X.15' },
  { clue: 'clue-board-working-file', name: 'The Warden’s working file', acc: 'X.16' },
  { clue: 'clue-w-o-89-2', name: 'Memorandum W/O 89/2', acc: 'X.17' },
  { clue: 'clue-index-gap', name: 'Forty-seven retyped cards', acc: 'X.18' },
  { clue: 'clue-docket-fold', name: 'The Ministry fold and the squared tag', acc: 'X.19' },
  { clue: 'clue-iveson-request-slip', name: 'DS Iveson’s file request slip', acc: 'X.20' },
  { clue: 'clue-ribbon-spool', name: 'Ribbon spool, September 1998', acc: 'X.21' },
  { clue: 'clue-typewriter-specimens', name: 'Four specimen albums', acc: 'X.22' },
  { clue: 'clue-scorched-carbon', name: 'Scorched carbon of 74/119', acc: 'X.23' },
  { clue: 'clue-pp-sort', name: 'The p.p. sort: 41 and 7', acc: 'X.24' },
  { clue: 'clue-order-book-offsets', name: 'Mirror offsets, razored Order Book', acc: 'X.25' },
  { clue: 'clue-pp-specimen-bundle', name: 'The Warden’s specimen bundle, 1974', acc: 'X.26' },
  { clue: 'clue-charter-art9', name: 'Charter of 1811, Article 9', acc: 'X.27' },
  { clue: 'clue-pp-taught', name: 'The requisition-slip lesson', acc: 'X.28' },
  { clue: 'clue-substituted-slips', name: 'Requisition stubs 2271–2302', acc: 'X.29' },
  { clue: 'clue-nurse-ledger', name: 'Nurse Kilbride’s visit ledger', acc: 'X.30' },
  { clue: 'clue-locum-mileage', name: 'Dr Munn’s locum mileage claims', acc: 'X.31' },
  { clue: 'clue-inquiry-rejects', name: 'Persons considered and not called', acc: 'X.32' },
  { clue: 'clue-liabilities-item14', name: 'Liabilities schedule, item 14', acc: 'X.33' },
  { clue: 'clue-reconciliation', name: 'The reconciliation, 1974', acc: 'X.34' },
  { clue: 'clue-bank-refusal', name: 'Naismith’s Bank letter, 15.8.74', acc: 'X.35' },
  { clue: 'clue-ministry-review', name: 'Quinquennial review notice', acc: 'X.36' },
  { clue: 'clue-switchboard-log', name: 'Night plug-log, 3.11.74', acc: 'X.37' },
  { clue: 'clue-gpo-account', name: 'GPO itemised trunk account', acc: 'X.38' },
  { clue: 'clue-marigraph-drum', name: 'Marigraph drum 1974/44', acc: 'X.39' },
  { clue: 'clue-deakin-letter', name: 'The Deakin letter (adverse report)', acc: 'X.40' },
  { clue: 'clue-petty-cash-voucher', name: 'Petty cash travel voucher, 4.11.74', acc: 'X.41' },
  { clue: 'clue-keepers-log', name: 'Nine Bells keeper’s log', acc: 'X.42' },
  { clue: 'clue-kestrel-mandate', name: 'The Kestrel Bequest', acc: 'X.43' },
  { clue: 'clue-franking-shortfall', name: 'The franking shortfall of 16.8.74', acc: 'X.44' },
];

const EXHIBIT_BY_CLUE = new Map(EXHIBITS.map((e) => [e.clue, e]));

interface Counter {
  text: string;
  options: string[];
  correct: string;
  reply: string;
  fail: string;
}

interface LinkSpec {
  id: string;
  title: string;
  assertion: string;
  /** The first is decisive: without it the link is struck, whatever else is cited. */
  slots: { want: string; hint: string }[];
  counters: Counter[];
}

const LINKS: LinkSpec[] = [
  {
    id: 'presence',
    title: 'PRESENCE',
    assertion:
      'That on the morning of 14 September 1998 the Warden of this Authority was at the registry counter, and therefore behind the timelock, and therefore on the gallery stair.',
    slots: [
      { want: 'clue-slip-r982211', hint: 'a requisition, timed, and initialled by somebody' },
      { want: 'clue-gallery-timeswitch', hint: 'light burned in a bay that has no daylight' },
      { want: 'clue-visitors-book', hint: 'who else was in the building' },
    ],
    counters: [
      {
        text: '“The initials on that slip are as likely to be the Keeper of the Rolls as the Warden — and the Warden was at the Board Room the whole of that morning with a quantity surveyor.”',
        options: ['clue-ferry-booking-book', 'clue-petty-cash-voucher', 'clue-keepers-log'],
        correct: 'clue-ferry-booking-book',
        reply:
          '‘H. PIKE, out 08:15, return 17:40. He was nine miles off this headland for the whole of the relevant period — and Dr Sandbach’s site diary puts the quantity surveyor on the fifteenth. There is exactly one set of initials left in that column.’',
        fail: 'Mr Pargeter writes something down, and does not look up. The Board Room morning is not answered.',
      },
    ],
  },
  {
    id: 'means',
    title: 'MEANS AND OPPORTUNITY',
    assertion:
      'That the gallery rail he went over was recorded as defective on 2 September, and was made good the following morning, out of programme, with no order number and no invoice, at the Warden’s personal instruction.',
    slots: [
      { want: 'clue-site-diary-rail', hint: 'a defect recorded, and a repair not billed' },
      { want: 'clue-accident-report', hint: 'what this Authority wrote down at the time' },
      { want: 'clue-spectacles', hint: 'a small object that was not where a fall would put it' },
    ],
    counters: [
      {
        text: '“A routine repair. A loose baluster is made good; that is what a works programme is for, and it is what a Warden is for.”',
        options: ['clue-dust-jar-6', 'clue-box17-relabel', 'clue-incinerator-damper'],
        correct: 'clue-dust-jar-6',
        reply:
          '‘French chalk, beeswax and a salt bloom, occurring together in exactly one room in this building. He was not at the 14/B shelving where his box came from. He was in the dead corner behind the map presses, which has no sightline from anywhere.’',
        fail: 'Captain Dunnet asks, mildly, whether a man usually falls from the part of a rail he is not standing at. Nobody answers him.',
      },
    ],
  },
  {
    id: 'guilt',
    title: 'CONSCIOUSNESS OF GUILT',
    assertion:
      'That on the day of the death forty-one impressions were run on a machine booked for twelve, and that box 17 went out at 09:10 against a slip with no return entry.',
    slots: [
      { want: 'clue-reprax-1998', hint: 'a counter that disagrees with its own book' },
      { want: 'clue-box17-relabel', hint: 'a box that came home wearing a new name' },
      { want: 'clue-a-curve-applied', hint: 'which machine typed the new name, and when' },
    ],
    counters: [
      {
        text: '“Concealment of what, Miss Adare? A shipping casualty judicially determined twenty-three years ago, in a finding nobody has ever sought to disturb.”',
        options: ['clue-chart-overlays', 'clue-sallow-1975-transcript', 'clue-issued-register'],
        correct: 'clue-chart-overlays',
        reply:
          '‘Of a finding that is wrong by three hundred and forty yards, sir, registered on the surveyor’s own trig marks and not on the coastline. That is what was in box 17, and that is what twenty-nine impressions were made of.’',
        fail: 'Struck through in the minute: an assertion of concealment with nothing said about what was concealed.',
      },
    ],
  },
  {
    id: 'identity',
    title: 'IDENTITY',
    assertion:
      'That the twenty-six copies in the Warden’s Board working file were foliated, indexed and docketed by the same hand that made them.',
    slots: [
      { want: 'clue-board-working-file', hint: 'twenty-six copies of a box that has been weeded' },
      { want: 'clue-w-o-89-2', hint: 'the reboxing that was signed in daylight' },
      { want: 'clue-index-gap', hint: 'an index that was retyped thirteen years late' },
    ],
    counters: [
      {
        text: '“Chain of custody. Half of these exhibits were carried out of a locked strongroom by the appraiser herself, at night, in a flood.”',
        options: ['clue-docket-fold', 'clue-iveson-request-slip', 'clue-visitors-book'],
        correct: 'clue-docket-fold',
        reply:
          '‘Endorsed on the outside third, upside down to the tag. Whitehall, 1958. One hand in this building does that, and no thief on earth can impose a habit like that on another person’s file.’',
        fail: 'Mr Pargeter suggests that a document is only as good as the hands it has passed through, and asks that the suggestion be minuted.',
      },
    ],
  },
  {
    id: 'knowledge',
    title: 'PRIOR KNOWLEDGE',
    assertion:
      'That two days before he died, the Warden knew what Cormac Sallow intended to send, and asked him in writing not to send it.',
    slots: [
      { want: 'clue-ribbon-spool', hint: 'a serial record with no reason to lie about order' },
      { want: 'clue-accident-report', hint: 'what physically follows it on the same fabric' },
    ],
    counters: [
      {
        text: '“A ribbon is a rag. Anybody may type a sentence on any day and wind it on, and you cannot tell me when.”',
        options: ['clue-a-curve-applied', 'clue-typewriter-specimens', 'clue-scorched-carbon'],
        correct: 'clue-a-curve-applied',
        reply:
          '‘The counter of the a fills at very nearly a straight line, sir, and I have it plotted from dated specimens from 1961 to this year. That striking sits at full occlusion. September 1998, on the Imperial 66 in the Warden’s Office.’',
        fail: 'The date of the striking is not established, and Mr Pargeter says so twice, slowly, for the minute.',
      },
    ],
  },
  {
    id: 'signature',
    title: 'SIGNATURE',
    assertion:
      'That every document signed A. FERRIER between 11 August and 3 November 1974 carries, in 2H pencil two millimetres high, the notation per procurationem — forty-one of them, from four custodies that have never spoken to one another.',
    slots: [
      { want: 'clue-pp-sort', hint: 'forty-eight signatures, sorted by the object' },
      { want: 'clue-pp-specimen-bundle', hint: 'the nine handed over as a courtesy in the first half-hour' },
      { want: 'clue-substituted-slips', hint: 'stubs that show the same hand at the counter' },
    ],
    counters: [
      {
        text: '“Per procurationem is lawful, ordinary, and expressly permitted by Standing Order 4. You have no forgery, and without a forgery you have no case.”',
        options: ['clue-charter-art9', 'clue-pp-taught', 'clue-inquiry-rejects'],
        correct: 'clue-charter-art9',
        reply:
          '‘I have never said it was forged, sir. Article 9 of the Charter of 1811 reserves the office to a man of full age. The clause that would not let her sign her own name is the clause that left the Inquiry with no name to call.’',
        fail: 'It is agreed on all sides that nothing was forged, which Mr Pargeter appears to find sufficient.',
      },
    ],
  },
  {
    id: 'hand',
    title: 'THE HAND HAS A NAME',
    assertion:
      'That Absalom Ferrier could not hold a pen after 11 August 1974, and that the Authority of the ninety-nine days was therefore one person, unnamed in every record this Authority keeps.',
    slots: [
      { want: 'clue-nurse-ledger', hint: 'somebody who wrote down his condition for no reason but her rounds' },
      { want: 'clue-locum-mileage', hint: 'somebody who wanted his petrol money' },
      { want: 'clue-inquiry-rejects', hint: 'the list of persons the 1975 Inquiry considered and did not call' },
    ],
    counters: [
      {
        text: '“Then name your officer. On what evidence does a Board of this kingdom name a person whom no record of this Authority has ever named in a hundred and eighty-seven years?”',
        options: ['clue-liabilities-item14', 'clue-charter-art9', 'clue-visitors-book'],
        correct: 'clue-liabilities-item14',
        reply:
          '‘Item 14 of the schedule of outstanding liabilities. Superannuation arrears. FERRIER-KYNE, S. Reckonable service asserted from 1959 — signed in her own name, in her own claim, and cleared off the schedule by me in my first hour on this headland.’',
        fail: 'The officer of the ninety-nine days is recorded as a person whose identity is not established by these papers.',
      },
    ],
  },
  {
    id: 'motive',
    title: 'MOTIVE AND PREDICATE',
    assertion:
      'That the Nine Bells was dark for want of a vaporiser this Authority could not pay for; that it charged one thousand one hundred and eighty-two vessels for the light regardless; and that the concealment of that is why a man died in this building twenty-four years later.',
    slots: [
      { want: 'clue-reconciliation', hint: 'three books that had never been on one table' },
      { want: 'clue-bank-refusal', hint: 'motive, in a bank manager’s handwriting' },
      { want: 'clue-ministry-review', hint: 'and the reason nobody could be told' },
    ],
    counters: [
      {
        text: '“The Rossport finding of 1975 carries a statutory presumption of correctness. This Board cannot go behind it on a lady’s arithmetic.”',
        options: ['clue-marigraph-drum', 'clue-inquiry-rejects', 'clue-deakin-letter'],
        correct: 'clue-marigraph-drum',
        reply:
          '‘Then go behind it on a machine’s handwriting, sir. Drum 1974/44: one metre four above prediction at 23:04, which is four metres two over the Sowens. The Inquiry assumed two metres eight at paragraph forty-four, and I started that instrument in front of myself before I read a word of it.’',
        fail: 'The presumption of correctness is not displaced, and the 1975 finding sits in the room like a piece of furniture.',
      },
      {
        text: '“And your telephone log is this Authority’s own book, kept by this Authority’s own clerk, and produced by this Authority’s own appraiser. Their own book is their word for it.”',
        options: ['clue-gpo-account', 'clue-switchboard-log', 'clue-petty-cash-voucher'],
        correct: 'clue-gpo-account',
        reply:
          '‘Then take somebody else’s. “3.11.74 — CARDEW — 22.41 — 4 min — 1s 9d.” The Post Office kept that for money, and nobody in this building had a vote about a line of it.’',
        fail: 'A self-serving record, says Mr Pargeter, and writes the words down himself.',
      },
    ],
  },
];

interface Clause {
  id: string;
  text: string;
  ok: boolean;
  /** Iveson's answer when this clause is the one that will not hold. */
  objection?: string;
}

const REFERRAL: { heading: string; options: Clause[] }[] = [
  {
    heading: 'THE ACT',
    options: [
      { id: 'a1', text: 'a grab at the arm, and a fall from a rail', ok: true },
      {
        id: 'a2',
        text: 'a deliberate push, with intent to kill',
        ok: false,
        objection: 'Intent to kill. On what document? Write murder and a barrister takes it off me in a morning.',
      },
      {
        id: 'a3',
        text: 'a fall, unwitnessed and unexplained',
        ok: false,
        objection: 'Unexplained? You’ve just spent four hours explaining it. Don’t hand me less than you’ve got.',
      },
    ],
  },
  {
    heading: 'THE RAIL',
    options: [
      {
        id: 'b1',
        text: 'from a rail recorded as defective, and repaired off the programme the next morning',
        ok: true,
      },
      {
        id: 'b2',
        text: 'from a rail deliberately loosened beforehand',
        ok: false,
        objection: 'Loosened by whom, and where does the paper say so? Item 41 says a baluster was loose on the second. That’s all it says.',
      },
    ],
  },
  {
    heading: 'WHAT FOLLOWED',
    options: [
      {
        id: 'c1',
        text: 'and everything after it: the copies, the relabelled box, the report typed at ten to five',
        ok: true,
      },
      {
        id: 'c2',
        text: 'and a conspiracy among the officers of this Authority',
        ok: false,
        objection: 'A conspiracy needs two. You’ve proved one, and you’ve proved she did it on her own for twenty-four years.',
      },
    ],
  },
  {
    heading: 'AND, SEPARATELY',
    options: [
      {
        id: 'd1',
        text: 'the offences of 1974, as they appear on the paper',
        ok: true,
      },
      {
        id: 'd2',
        text: 'the murder of the thirty-one persons lost in the Pelagia',
        ok: false,
        objection: 'Thirty-one counts of murder off a tide gauge and an oil book. No. Charge what the paper carries and it sticks.',
      },
    ],
  },
];

function boardOfDissolution(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'lg-board');

      const held = EXHIBITS.filter((e) => ctx.hasClue(e.clue));
      const savedSlots = readMap(ctx.state, 'slots');
      const readLinks = new Set(readStrings(ctx.state, 'read'));
      const savedAnswers = readMap(ctx.state, 'answers');

      /** linkId -> one entry per slot, holding a clue id or null. */
      const placed = new Map<string, (string | null)[]>();
      for (const link of LINKS) {
        const from = readStrings(savedSlots, link.id);
        placed.set(
          link.id,
          link.slots.map((_, i) => {
            const v = from[i] ?? '';
            return v && EXHIBIT_BY_CLUE.has(v) && ctx.hasClue(v) ? v : null;
          }),
        );
      }
      /** linkId -> per-counter chosen option, '' for "said nothing". */
      const answers = new Map<string, (string | null)[]>();
      for (const link of LINKS) {
        const from = readStrings(savedAnswers, link.id);
        answers.set(
          link.id,
          link.counters.map((_, i) => (typeof from[i] === 'string' ? from[i] : null)),
        );
      }

      let inHand: string | null = null;

      const persist = () => {
        ctx.state.slots = Object.fromEntries(
          [...placed].map(([k, v]) => [k, v.map((x) => x ?? '')]),
        );
        ctx.state.read = [...readLinks];
        ctx.state.answers = Object.fromEntries(
          [...answers].map(([k, v]) => [k, v.map((x) => x ?? '')]),
        );
        ctx.save();
      };

      const usedClues = () => {
        const s = new Set<string>();
        for (const list of placed.values()) for (const c of list) if (c) s.add(c);
        return s;
      };

      // -- the bench ----------------------------------------------------------

      const benchRow = box(
        'bd-bench',
        box('bd-member', h('p', 'bd-member-name', 'MRS ELLARY VOSS'), cap('in the chair')),
        box('bd-member', h('p', 'bd-member-name', 'CAPTAIN DUNNET'), cap('assessor')),
        box('bd-member is-ministry', h('p', 'bd-member-name', 'MR PARGETER'), cap('for the Ministry')),
        box('bd-member is-side', h('p', 'bd-member-name', 'S. FERRIER-KYNE'), cap('taking her own minutes')),
      );

      const tally = h('p', 'bd-tally');
      tally.setAttribute('role', 'status');

      // -- the exhibit drawer --------------------------------------------------

      const drawer = h('div', 'bd-drawer');
      drawer.setAttribute('role', 'list');
      drawer.setAttribute('aria-label', 'The casebook drawer');
      const chipEls = new Map<string, HTMLButtonElement>();

      const paintDrawer = () => {
        const used = usedClues();
        for (const [clue, chip] of chipEls) {
          const isUsed = used.has(clue);
          chip.classList.toggle('is-spent', isUsed);
          chip.classList.toggle('is-in-hand', inHand === clue);
          chip.setAttribute('aria-pressed', String(inHand === clue));
          chip.disabled = isUsed;
        }
        drawer.classList.toggle('is-holding', inHand !== null);
      };

      const takeChip = (clue: string) => {
        inHand = inHand === clue ? null : clue;
        ctx.feedback('click');
        paintDrawer();
        paintLinks();
      };

      // -- the eight links -----------------------------------------------------

      const linksBox = h('div', 'bd-links');
      interface LinkEls {
        row: HTMLElement;
        slots: HTMLButtonElement[];
        readKey: HTMLButtonElement;
        stamp: HTMLElement;
        counterBox: HTMLElement;
      }
      const linkEls = new Map<string, LinkEls>();

      const verdictOf = (link: LinkSpec): 'open' | 'struck' | 'partial' | 'stands' => {
        if (!readLinks.has(link.id)) return 'open';
        const cited = placed.get(link.id)!;
        if (!cited.includes(link.slots[0].want)) return 'struck';
        const ans = answers.get(link.id)!;
        return link.counters.every((c, i) => ans[i] === c.correct) ? 'stands' : 'partial';
      };

      const standing = () => LINKS.filter((l) => verdictOf(l) !== 'open' && verdictOf(l) !== 'struck').length;
      const allRead = () => LINKS.every((l) => readLinks.has(l.id));
      /**
       * Every rebuttal that was actually *put* has been dealt with.
       *
       * A struck link is never rebutted — Pargeter does not trouble to answer
       * an assertion that has already gone — so its counters stay unanswered
       * for ever. Requiring them would lock the referral shut behind a door
       * that cannot open, and a player who recovered nothing would reach the
       * last five minutes of the game and find no way through it.
       */
      const allAnswered = () =>
        LINKS.every(
          (l) => verdictOf(l) === 'struck' || answers.get(l.id)!.every((a) => a !== null),
        );

      const paintTally = () => {
        const read = LINKS.filter((l) => readLinks.has(l.id)).length;
        const stands = standing();
        tally.textContent = read
          ? `${read} of eight read. ${stands} standing, ${read - stands} struck.`
          : 'Eight links. Nothing on this table that I was told, and nothing I cannot hold up to a window.';
      };

      const placeInSlot = (link: LinkSpec, index: number) => {
        if (readLinks.has(link.id)) {
          ctx.feedback('bad');
          ctx.note('The link has been read. There is no undo in a Board Room.');
          return;
        }
        const list = placed.get(link.id)!;
        if (list[index]) {
          // Taking it back out is free, right up until it is read aloud.
          list[index] = null;
          ctx.feedback('tick');
        } else if (inHand) {
          list[index] = inHand;
          inHand = null;
          ctx.feedback('click');
        } else {
          ctx.feedback('bad');
          ctx.note('Take an exhibit out of the drawer first.');
          return;
        }
        persist();
        paintDrawer();
        paintLinks();
      };

      const readLink = (link: LinkSpec) => {
        if (readLinks.has(link.id)) return;
        readLinks.add(link.id);
        persist();
        const v = verdictOf(link);
        if (v === 'struck') {
          ctx.feedback('bad');
          ctx.note('— On what document, Miss Adare? — Then it is struck, and the transcript will print with the gap in it.');
        } else {
          ctx.feedback('good');
          ctx.note('Read, and cited. Mr Pargeter has something to say about it.');
        }
        paintLinks();
        paintTally();
      };

      const answerCounter = (link: LinkSpec, ci: number, choice: string | null) => {
        const ans = answers.get(link.id)!;
        if (ans[ci] !== null) return;
        ans[ci] = choice ?? '';
        persist();
        const c = link.counters[ci];
        if (choice === c.correct) {
          ctx.feedback('good');
          ctx.note(c.reply);
        } else {
          ctx.feedback('bad');
          ctx.note(choice === null ? `Nothing said. ${c.fail}` : c.fail);
        }
        paintLinks();
        paintTally();
      };

      const paintCounters = (link: LinkSpec, host: HTMLElement) => {
        host.textContent = '';
        if (!readLinks.has(link.id) || verdictOf(link) === 'struck') {
          host.hidden = true;
          return;
        }
        host.hidden = false;
        const ans = answers.get(link.id)!;
        link.counters.forEach((c, ci) => {
          const card = h('div', 'bd-counter');
          card.append(h('p', 'bd-counter-who', 'MR PARGETER'), h('p', 'bd-counter-text', c.text));
          if (ans[ci] === null) {
            const shortlist = h('div', 'bd-shortlist');
            for (const opt of c.options) {
              const ex = EXHIBIT_BY_CLUE.get(opt)!;
              const b = h('button', 'bd-answer');
              b.type = 'button';
              const have = ctx.hasClue(opt);
              b.disabled = !have;
              b.classList.toggle('is-absent', !have);
              b.append(
                h('span', 'bd-answer-acc', have ? ex.acc : '—'),
                h('span', 'bd-answer-name', have ? ex.name : `${ex.name} — never recovered`),
              );
              b.addEventListener('click', () => answerCounter(link, ci, opt), { signal: rig.signal });
              shortlist.appendChild(b);
            }
            const quiet = h('button', 'bd-answer is-quiet');
            quiet.type = 'button';
            quiet.append(h('span', 'bd-answer-acc', '—'), h('span', 'bd-answer-name', 'Say nothing'));
            quiet.addEventListener('click', () => answerCounter(link, ci, null), { signal: rig.signal });
            shortlist.appendChild(quiet);
            card.appendChild(shortlist);
          } else {
            const good = ans[ci] === c.correct;
            const said = h('p', `bd-counter-answer ${good ? 'is-good' : 'is-bad'}`);
            said.append(
              h('span', 'bd-counter-mark', good ? '✓' : '✗'),
              h('span', 'bd-counter-said', good ? c.reply : c.fail),
            );
            card.appendChild(said);
          }
          host.appendChild(card);
        });
      };

      const paintLinks = () => {
        for (const link of LINKS) {
          const els = linkEls.get(link.id)!;
          const list = placed.get(link.id)!;
          const v = verdictOf(link);
          els.row.dataset.verdict = v;
          els.slots.forEach((slot, i) => {
            const clue = list[i];
            slot.textContent = '';
            if (clue) {
              const ex = EXHIBIT_BY_CLUE.get(clue)!;
              slot.append(h('span', 'bd-slot-acc', ex.acc), h('span', 'bd-slot-name', ex.name));
              slot.classList.add('is-filled');
              slot.setAttribute('aria-label', `Citation: ${ex.name}. ${readLinks.has(link.id) ? 'Read; locked.' : 'Click to take it back.'}`);
            } else {
              slot.append(
                h('span', 'bd-slot-acc', '—'),
                h('span', 'bd-slot-name', link.slots[i].hint),
              );
              slot.classList.remove('is-filled');
              slot.setAttribute(
                'aria-label',
                `Empty citation slot: ${link.slots[i].hint}. ${inHand ? 'Click to cite the exhibit in hand.' : 'Take an exhibit from the drawer first.'}`,
              );
            }
            slot.classList.toggle('is-target', inHand !== null && !clue && !readLinks.has(link.id));
            slot.disabled = readLinks.has(link.id) && !clue;
          });
          els.readKey.disabled = readLinks.has(link.id);
          els.readKey.querySelector('.lg-key-face')!.textContent = readLinks.has(link.id)
            ? 'READ'
            : 'READ THE LINK';
          els.stamp.textContent =
            v === 'open' ? '' : v === 'struck' ? 'STRUCK' : v === 'partial' ? 'STANDS · REBUTTAL NOT ANSWERED' : 'STANDS';
          paintCounters(link, els.counterBox);
        }
        paintReferralGate();
      };

      LINKS.forEach((link, n) => {
        const row = h('section', 'bd-link');
        row.dataset.link = link.id;
        const head = box(
          'bd-link-head',
          h('span', 'bd-link-numeral', ROMAN[n] ?? String(n + 1)),
          h('h3', 'bd-link-title', link.title),
        );
        const stamp = h('span', 'bd-stamp');
        head.appendChild(stamp);
        const assertion = h('p', 'bd-assertion', link.assertion);
        const slotRow = h('div', 'bd-slots');
        const slots = link.slots.map((_, i) => {
          const s = h('button', 'bd-slot');
          s.type = 'button';
          s.dataset.link = link.id;
          s.dataset.slot = String(i);
          s.addEventListener('click', () => placeInSlot(link, i), { signal: rig.signal });
          slotRow.appendChild(s);
          return s;
        });
        const readKey = key('READ THE LINK', 'is-read');
        readKey.addEventListener('click', () => readLink(link), { signal: rig.signal });
        const counterBox = h('div', 'bd-counters');
        row.append(head, assertion, slotRow, readKey, counterBox);
        linksBox.appendChild(row);
        linkEls.set(link.id, { row, slots, readKey, stamp, counterBox });
      });

      // Chips: a drawer of docketed exhibits, liftable by click or by drag.
      for (const ex of held) {
        const chip = h('button', 'bd-chip');
        chip.type = 'button';
        chip.setAttribute('role', 'listitem');
        chip.append(h('span', 'bd-chip-acc', ex.acc), h('span', 'bd-chip-name', ex.name));
        chip.addEventListener('click', () => takeChip(ex.clue), { signal: rig.signal });
        chipEls.set(ex.clue, chip);
        drawer.appendChild(chip);

        const ctl = rig.keep(
          makeDraggable(chip, {
            label: `${ex.name}, exhibit ${ex.acc}`,
            feedback: ctx.feedback,
            onDrop: (p) => {
              const r = chip.getBoundingClientRect();
              const cx = r.left + r.width / 2;
              const cy = r.top + r.height / 2;
              ctl.set({ x: 0, y: 0 }, true);
              // A press that never travelled is a *click*, and the click
              // handler owns it. Without this, tapping a chip would also
              // "drop" it on whatever the drawer happens to be sitting over.
              if (Math.abs(p.x) < 5 && Math.abs(p.y) < 5) return;
              // elementFromPoint rather than rectangle arithmetic, so a slot
              // scrolled under the sticky drawer cannot be hit through it.
              chip.style.visibility = 'hidden';
              const under = document.elementFromPoint(cx, cy);
              chip.style.removeProperty('visibility');
              const slot = under?.closest<HTMLElement>('.bd-slot');
              const linkId = slot?.dataset.link;
              const index = Number(slot?.dataset.slot ?? -1);
              if (!linkId || !Number.isInteger(index) || index < 0) return;
              const link = LINKS.find((l) => l.id === linkId);
              if (!link || readLinks.has(link.id) || placed.get(link.id)![index]) return;
              inHand = ex.clue;
              placeInSlot(link, index);
            },
          }),
        );
      }

      if (!held.length) {
        const empty = h('p', 'bd-drawer-empty');
        empty.textContent =
          'The drawer is empty. Everything in it had to be carried out of that building by hand.';
        drawer.appendChild(empty);
      }

      // -- the referral ---------------------------------------------------------

      const referral = h('section', 'bd-referral');
      const chosen = new Map<string, string>();
      const savedClauses = readStrings(ctx.state, 'clauses');
      REFERRAL.forEach((group, gi) => {
        const pick = savedClauses[gi];
        if (pick && group.options.some((o) => o.id === pick)) chosen.set(group.heading, pick);
      });

      const sendKey = key('SIGN AND SEND TO DS IVESON', 'is-send');
      const clauseEls: HTMLButtonElement[] = [];

      const paintReferralGate = () => {
        const ready = allRead() && allAnswered();
        referral.classList.toggle('is-ready', ready);
        referral.setAttribute('aria-disabled', String(!ready));
        for (const b of clauseEls) b.disabled = !ready;
        sendKey.disabled = !ready || chosen.size < REFERRAL.length;
      };

      REFERRAL.forEach((group, gi) => {
        const g = h('div', 'bd-clause-group');
        g.append(h('p', 'bd-clause-head', group.heading));
        for (const opt of group.options) {
          const b = h('button', 'bd-clause');
          b.type = 'button';
          b.append(h('span', 'bd-clause-text', opt.text));
          b.addEventListener(
            'click',
            () => {
              chosen.set(group.heading, opt.id);
              ctx.state.clauses = REFERRAL.map((grp) => chosen.get(grp.heading) ?? '');
              ctx.save();
              ctx.feedback('tick');
              clauseEls.forEach((x) => {
                const own = REFERRAL.find((grp) => grp.options.some((o) => o.id === x.dataset.clause));
                x.classList.toggle(
                  'is-chosen',
                  own ? chosen.get(own.heading) === x.dataset.clause : false,
                );
              });
              paintReferralGate();
            },
            { signal: rig.signal },
          );
          b.dataset.clause = opt.id;
          b.classList.toggle('is-chosen', chosen.get(group.heading) === opt.id);
          clauseEls.push(b);
          g.appendChild(b);
        }
        referral.appendChild(gi === 0 ? box('bd-clause-lede', h('p', 'bd-clause-intro', 'Referral to DS Iveson, Rossport CID. Word it to what the paper carries.'), g) : g);
      });

      sendKey.addEventListener(
        'click',
        () => {
          const bad = REFERRAL.map((group) => {
            const id = chosen.get(group.heading);
            return group.options.find((o) => o.id === id);
          }).find((o) => o && !o.ok);
          if (bad) {
            ctx.feedback('bad');
            ctx.note(`Iveson, reading it back: ‘${bad.objection}’`);
            return;
          }
          ctx.feedback('good');
          const stands = standing();
          ctx.note(
            stands === LINKS.length
              ? 'Eight links, every rebuttal answered off the table, and a referral worded to the paper. ‘That,’ says Iveson, ‘is an object.’'
              : stands === 0
                ? 'Nothing stands. The referral goes anyway, worded to what the paper carries, which today is very little.'
                : `${stands} link${stands === 1 ? '' : 's'} standing, and the referral says exactly what the paper carries and not one word more.`,
          );
          rig.after(reduced() ? 160 : 2200, () => ctx.solve());
        },
        { signal: rig.signal },
      );

      referral.append(sendKey);

      // -- assembly --------------------------------------------------------------

      el.append(
        benchRow,
        plate('SECTION 41(6)', [
          'An assertion supported by a document in the appraiser’s possession stands unless the document is impeached.',
          'An assertion supported by what you were told stands until the first question.',
          'Nothing may be read twice, and there is no undo.',
        ]),
        tally,
        linksBox,
        box('bd-drawer-well', cap('THE CASEBOOK DRAWER · take an exhibit, then a slot'), drawer),
        referral,
      );

      paintDrawer();
      paintLinks();
      paintTally();
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-postmasters-register — "The Machine That Cannot Lie"
// The Post Room, Act I.
//
// A competence test Wren sets herself on her second morning, and five minutes'
// training on a machine nobody in a hundred and eighty-seven years has thought
// of as a witness. The lesson is the boring answer: a counter that disagrees
// with a book almost always has one, and the player needs to have felt that
// before 437 against 223, 213 against 214, and 41 against 12.
// ===========================================================================

/** Yesterday's close, entered on the meter card in Enid Charnock's hand. */
const METER_PREV = { descending: 18771, ascending: 412338 };
/** What the two registers read this morning, through the crank shutters. */
const METER_NOW = { descending: 18347, ascending: 412355 };
/** The die proof taken on a scrap every morning, and carried to the card. */
const TEST_STRIKE = 13;

interface PostEntry {
  to: string;
  service: string;
  pence: number;
}

const POST_BOOK: PostEntry[] = [
  { to: 'Ministry of Transport, Marine Directorate', service: 'first class', pence: 25 },
  { to: 'Naismith’s Bank, Rossport', service: 'first class', pence: 25 },
  { to: 'Mrs N. Feaver, Wolverhampton', service: 'second class', pence: 19 },
  { to: 'Rossport Harbour Board', service: 'second class', pence: 19 },
  { to: 'Corporation of Trinity House, London', service: 'second class', pence: 19 },
  { to: 'Conservancy of Records, Ilberry', service: 'first class', pence: 25 },
  { to: 'Messrs Mowbray & Slee, solicitors', service: 'recorded delivery', pence: 30 },
  { to: 'Hydrographic Office, Taunton', service: 'first class, large', pence: 39 },
  { to: 'St Bride’s Parochial Council', service: 'second class', pence: 19 },
  { to: 'Sandbach & Co., consulting engineers', service: 'first class', pence: 25 },
  { to: 'Postmaster, Cardew — redirections', service: 'second class', pence: 19 },
  { to: 'Ministry of Transport — duplicate set', service: 'first class', pence: 25 },
  { to: 'Rossport CID, DS Iveson', service: 'first class, large', pence: 26 },
  { to: 'Kestrel trustees, c/o Mowbray & Slee', service: 'first class, large', pence: 26 },
  { to: 'Lighthouse Keepers’ Benevolent Fund', service: 'first class', pence: 25 },
  { to: 'Vandeputte Shipping Agents, Antwerp', service: 'overseas', pence: 45 },
];

/** Pence to "£4.24" — this room decimalised in 1971 and never looked back. */
const dec = (p: number) => `£${(p / 100).toFixed(2)}`;

const STANDING_RULES = [
  '1. The meter shall be locked at all times and the key held by the Cashier.',
  '2. No impression shall be taken except against an entry in the post book.',
  '3. The post book shall be totalled and initialled at close of post.',
  '4. Recharges shall be entered on the meter card and nowhere else.',
  '5. The ascending register shall not be reset. It has run since 1961.',
  '6. The die is to be tested upon a scrap each morning and the impression carried to the meter card.',
  '7. Damaged impressions shall be struck through and reported.',
  '8. The Cashier’s ruling upon any of the above is final. — E. CHARNOCK',
];

const METER_CARD = [
  { line: '13.10.98 — recharge £250.00 — desc. £412.19 — asc. 411,904 — E.C.', carry: 0 },
  { line: '19.10.98 — close — desc. £201.38 — asc. 412,201 — E.C.', carry: 0 },
  { line: '20.10.98 — close — desc. £187.71 — asc. 412,338 — E.C.', carry: 0 },
  { line: '21.10.98 — die proof, test strike on scrap — 13p — E.C.', carry: TEST_STRIKE },
  { line: '21.10.98 — franking machine opened by warrant, s.41 — W.A.', carry: 0 },
];

function postmastersRegister(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'lg-post');
      const rail = new Rail(['The meter', 'The post book', 'The seventeenth']);

      let unlocked = readBool(ctx.state, 'unlocked');
      let crankProgress = readNum(ctx.state, 'crank', 0);
      let registersRead = readBook(ctx.state);
      const carried = new Set<number>(
        readStrings(ctx.state, 'carried')
          .map(Number)
          .filter((n) => Number.isInteger(n) && n >= 0 && n < POST_BOOK.length),
      );
      let cast = readBool(ctx.state, 'cast');
      let seventeenth = readBool(ctx.state, 'seventeenth');

      function readBook(bag: Record<string, unknown>): boolean {
        return bag.registersRead === true;
      }

      const persist = () => {
        ctx.state.unlocked = unlocked;
        ctx.state.crank = crankProgress;
        ctx.state.registersRead = registersRead;
        ctx.state.carried = [...carried].map(String);
        ctx.state.cast = cast;
        ctx.state.seventeenth = seventeenth;
        ctx.save();
      };

      // -- Stage I: the meter ------------------------------------------------

      const meterStage = h('div', 'pm-stage');
      rail.add(meterStage);

      const keyEl = h('div', 'pm-key');
      keyEl.append(h('span', 'pm-key-bow'), h('span', 'pm-key-bit'));
      const crankEl = h('div', 'pm-crank');
      crankEl.append(h('span', 'pm-crank-arm'), h('span', 'pm-crank-handle'));

      const windowFor = (name: string, digits: string, cls: string) => {
        const w = h('div', `pm-window ${cls}`);
        const strip = h('div', 'pm-window-digits');
        for (const d of digits) strip.append(h('span', 'pm-window-digit', d));
        w.append(cap(name), strip, h('span', 'pm-shutter'));
        return w;
      };

      const descWindow = windowFor(
        'DESCENDING · CREDIT REMAINING',
        (METER_NOW.descending / 100).toFixed(2),
        'is-desc',
      );
      const ascWindow = windowFor(
        'ASCENDING · IMPRESSIONS SINCE 1961',
        String(METER_NOW.ascending),
        'is-asc',
      );

      const descWheels = rig.keep(
        makeWheels({ label: 'Descending register, in pence', digits: 5, unit: 'p', feedback: ctx.feedback }),
      );
      const ascWheels = rig.keep(
        makeWheels({ label: 'Ascending register', digits: 6, feedback: ctx.feedback }),
      );
      const carryKey = key('CARRY BOTH TO THE CASEBOOK', 'is-sign');

      const paintMeter = () => {
        meterStage.classList.toggle('is-unlocked', unlocked);
        meterStage.classList.toggle('is-read', registersRead);
        for (const w of [descWindow, ascWindow]) {
          w.style.setProperty('--open', crankProgress.toFixed(3));
          w.classList.toggle('is-open', crankProgress > 0.92);
        }
        carryKey.disabled = registersRead || crankProgress <= 0.92;
        if (registersRead) {
          carryKey.querySelector('.lg-key-face')!.textContent = 'CARRIED · FELL £4.24 · ADVANCED 17';
        }
      };

      rig.keep(
        makeRotatable(keyEl, {
          angle: unlocked ? 90 : 0,
          detent: 90,
          min: 0,
          max: 90,
          step: 90,
          label: 'Warrant key — turn to unlock the meter',
          feedback: ctx.feedback,
          onCommit: (deg) => {
            const now = deg >= 90;
            if (now === unlocked) return;
            unlocked = now;
            persist();
            paintMeter();
            if (unlocked) {
              ctx.feedback('good');
              ctx.note('Opened by warrant under section 41, which for anybody else in this building is a General Post Office offence.');
            }
          },
        }),
      );

      let crankTotal = crankProgress * 720;
      rig.keep(
        makeRotatable(crankEl, {
          detent: 15,
          step: 30,
          label: 'Register drum crank',
          feedback: ctx.feedback,
          onChange: (deg) => {
            if (!unlocked) {
              ctx.note('Locked. The key first.');
              return;
            }
            crankTotal = Math.abs(deg);
            crankProgress = clamp(crankTotal / 720, 0, 1);
            paintMeter();
          },
          onCommit: () => {
            if (!unlocked) return;
            persist();
            if (crankProgress > 0.92) {
              ctx.note('Both windows standing open. Read them, and write down what they say and nothing else.');
            }
          },
        }),
      );

      carryKey.addEventListener(
        'click',
        () => {
          if (registersRead) return;
          if (descWheels.get() !== METER_NOW.descending || ascWheels.get() !== METER_NOW.ascending) {
            ctx.feedback('bad');
            ctx.note('That is not what the windows say. A transcription error is the one mistake this exercise exists to catch.');
            return;
          }
          registersRead = true;
          persist();
          ctx.feedback('good');
          paintMeter();
          ctx.note(
            'One hundred and eighty-three pounds forty-seven against yesterday’s one eighty-seven seventy-one. Fell £4.24, advanced seventeen.',
          );
          rig.after(reduced() ? 100 : 1500, () => rail.go(1, true));
        },
        { signal: rig.signal },
      );

      meterStage.append(
        plate('PITNEY POSTMASTER · MODEL 5000 · GPO LICENCE 4471', [
          'Turn the warrant key, then crank the drum until both register windows stand open.',
          'DESCENDING falls as credit is used. ASCENDING counts impressions and has never been reset.',
          'Read both, and enter them exactly as they read.',
        ]),
        box(
          'pm-meter',
          box('pm-meter-face', descWindow, ascWindow),
          box('pm-meter-controls', box('pm-key-well', cap('WARRANT KEY'), keyEl), box('pm-crank-well', cap('DRUM CRANK'), crankEl)),
        ),
        box(
          'pm-entry',
          box('pm-entry-row', h('span', 'pm-entry-label', 'Descending register, in pence'), descWheels.el),
          box('pm-entry-row', h('span', 'pm-entry-label', 'Ascending register'), ascWheels.el),
          carryKey,
        ),
      );

      // -- Stage II: the post book -------------------------------------------

      const bookStage = h('div', 'pm-stage');
      rail.add(bookStage);

      const entriesList = h('ol', 'pm-entries');
      entriesList.setAttribute('aria-label', 'The day’s post book, sixteen entries');
      const columnList = h('ol', 'pm-column');
      columnList.setAttribute('aria-label', 'Reconciliation column');
      const columnTotal = h('p', 'pm-column-total', '—');
      columnTotal.setAttribute('role', 'status');
      const castKey = key('CAST THE COLUMN', 'is-cast');
      /* The column follows the player into stage three: the seventeenth line
         has to be seen landing on the same sheet as the other sixteen. */
      const columnSide = box(
        'pm-book-side is-column',
        cap('RECONCILIATION COLUMN'),
        columnList,
        columnTotal,
        castKey,
      );

      const columnPence = () =>
        [...carried].reduce((t, i) => t + POST_BOOK[i].pence, 0) + (seventeenth ? TEST_STRIKE : 0);
      const columnCount = () => carried.size + (seventeenth ? 1 : 0);

      const entryButtons: HTMLButtonElement[] = [];

      const paintBook = () => {
        entryButtons.forEach((b, i) => {
          const done = carried.has(i);
          b.classList.toggle('is-carried', done);
          b.disabled = done;
          b.setAttribute(
            'aria-label',
            `${done ? 'Carried: ' : 'Carry to the reconciliation column: '}${POST_BOOK[i].to}, ${POST_BOOK[i].service}, ${POST_BOOK[i].pence} pence`,
          );
        });
        columnList.textContent = '';
        [...carried]
          .sort((a, b) => a - b)
          .forEach((i) => {
            const li = h('li', 'pm-column-line');
            li.append(
              h('span', 'pm-column-n', String(i + 1)),
              h('span', 'pm-column-to', POST_BOOK[i].to),
              h('span', 'pm-column-p', `${POST_BOOK[i].pence}p`),
            );
            columnList.appendChild(li);
          });
        if (seventeenth) {
          const li = h('li', 'pm-column-line is-seventeenth');
          li.append(
            h('span', 'pm-column-n', '17'),
            h('span', 'pm-column-to', 'Die proof, test strike on a scrap — meter card, rule 6'),
            h('span', 'pm-column-p', `${TEST_STRIKE}p`),
          );
          columnList.appendChild(li);
        }
        castKey.disabled = carried.size < POST_BOOK.length || cast;
        castKey.classList.toggle('is-done', cast);
        castKey.querySelector('.lg-key-face')!.textContent = cast ? 'CAST ✓' : 'CAST THE COLUMN';
        columnTotal.textContent = cast
          ? `${columnCount()} impressions · ${dec(columnPence())}`
          : `${carried.size} of sixteen carried`;
        columnTotal.classList.toggle('is-adverse', cast && columnPence() !== METER_PREV.descending - METER_NOW.descending);
        columnTotal.classList.toggle('is-agreed', cast && columnPence() === METER_PREV.descending - METER_NOW.descending);
      };

      POST_BOOK.forEach((entry, i) => {
        const b = h('button', 'pm-entry-line');
        b.type = 'button';
        b.append(
          h('span', 'pm-entry-n', String(i + 1)),
          h('span', 'pm-entry-to', entry.to),
          h('span', 'pm-entry-service', entry.service),
          h('span', 'pm-entry-p', `${entry.pence}p`),
        );
        b.addEventListener(
          'click',
          () => {
            if (carried.has(i)) return;
            carried.add(i);
            ctx.feedback('tick');
            persist();
            paintBook();
            if (carried.size === POST_BOOK.length) {
              ctx.note('Sixteen entries carried. Cast it, and see whether the machine agrees with the book.');
            }
          },
          { signal: rig.signal },
        );
        entryButtons.push(b);
        entriesList.appendChild(b);
      });

      castKey.addEventListener(
        'click',
        () => {
          if (cast) return;
          cast = true;
          persist();
          paintBook();
          ctx.feedback('bad');
          ctx.note(
            'Four pounds eleven against four pounds twenty-four. Sixteen entries against seventeen impressions. Thirteen pence, and one strike of the die.',
          );
          rig.after(reduced() ? 110 : 1700, () => rail.go(2, true));
        },
        { signal: rig.signal },
      );

      bookStage.append(
        plate('THE DAY’S POST BOOK · 21 OCTOBER 1998', [
          'Carry every entry into the reconciliation column. The column casts itself, in pence.',
          'Arithmetic is never the obstacle here. Transcription is.',
        ]),
        box('pm-book', box('pm-book-side', cap('POST BOOK'), entriesList), columnSide),
      );

      // -- Stage III: the seventeenth ----------------------------------------

      const findStage = h('div', 'pm-stage');
      rail.add(findStage);

      const gap = box(
        'pm-gap',
        box('pm-gap-cell', cap('THE METER SAYS'), h('p', 'pm-gap-val', dec(METER_PREV.descending - METER_NOW.descending)), h('p', 'pm-gap-sub', '17 impressions')),
        box('pm-gap-cell', cap('THE BOOK SAYS'), h('p', 'pm-gap-val', dec(411)), h('p', 'pm-gap-sub', '16 entries')),
        box('pm-gap-cell is-gap', cap('UNACCOUNTED'), h('p', 'pm-gap-val', '13p'), h('p', 'pm-gap-sub', 'one impression')),
      );

      findStage.append(
        plate('THE SEVENTEENTH IMPRESSION', [
          'A meter counts impressions, not intentions. If it says seventeen, there were seventeen.',
          'One of them was not thought worth writing in the post book. Find where it *was* written.',
        ]),
        gap,
      );

      // -- the shelf: three volumes, open in every stage ----------------------

      let openVolume = 0;
      const shelfBody = h('div', 'pm-shelf-body');
      const shelfTabs = h('div', 'pm-shelf-tabs');
      shelfTabs.setAttribute('role', 'tablist');
      const VOLUMES = ['STANDING INSTRUCTIONS', 'METER CARD BOOK', 'DISTRIBUTION LIST'];
      const shelfTabEls: HTMLButtonElement[] = [];

      const paintShelf = () => {
        shelfBody.textContent = '';
        shelfTabEls.forEach((t, i) => {
          t.setAttribute('aria-selected', String(i === openVolume));
          t.classList.toggle('is-open', i === openVolume);
        });
        if (openVolume === 0) {
          const list = h('ol', 'pm-rules');
          STANDING_RULES.forEach((r, i) => {
            const li = h('li', 'pm-rule', r);
            if (i === 5) li.classList.add('is-pinned');
            list.appendChild(li);
          });
          shelfBody.append(h('p', 'pm-shelf-title', 'POST ROOM STANDING INSTRUCTIONS'), list);
        } else if (openVolume === 1) {
          shelfBody.append(h('p', 'pm-shelf-title', 'METER CARD BOOK · GPO LICENCE 4471'));
          for (const row of METER_CARD) {
            const line = h('div', 'pm-card-line');
            line.append(h('span', 'pm-card-text', row.line));
            if (row.carry) {
              const b = key('CARRY THIS TO THE COLUMN', 'is-carry');
              b.disabled = rail.index < 2 || seventeenth;
              if (seventeenth) b.querySelector('.lg-key-face')!.textContent = 'CARRIED ✓';
              b.addEventListener(
                'click',
                () => {
                  if (seventeenth) return;
                  seventeenth = true;
                  persist();
                  ctx.feedback('good');
                  paintShelf();
                  paintBook();
                  ctx.note(
                    'Enid’s thirteen-penny test strike, taken every morning to prove the die, carried to the meter card and never to the post book. Rule 6, and a drawing-pin through it.',
                  );
                  rig.after(reduced() ? 130 : 1900, () => ctx.solve());
                },
                { signal: rig.signal },
              );
              line.appendChild(b);
            } else if (rail.index >= 2) {
              const b = key('CARRY THIS TO THE COLUMN', 'is-carry');
              b.addEventListener(
                'click',
                () => {
                  ctx.feedback('bad');
                  ctx.note('That is a recharge, or a close, or my own name. It is not an impression taken this morning.');
                },
                { signal: rig.signal },
              );
              line.appendChild(b);
            }
            shelfBody.appendChild(line);
          }
        } else {
          shelfBody.append(
            h('p', 'pm-shelf-title', 'DISTRIBUTION LIST · SCHEDULE D'),
            h(
              'p',
              'pm-shelf-note',
              'Two hundred and fourteen addressees for a general Notice to Mariners, ruled up in 1962 and amended in pencil ever since. Nothing to do with today’s post, and I have read it twice anyway, because it is the only list in this building that says how many of anything there ought to be.',
            ),
          );
        }
      };

      VOLUMES.forEach((name, i) => {
        const t = h('button', 'pm-shelf-tab');
        t.type = 'button';
        t.setAttribute('role', 'tab');
        t.append(h('span', 'pm-shelf-tab-name', name));
        t.addEventListener(
          'click',
          () => {
            openVolume = i;
            ctx.feedback('click');
            paintShelf();
          },
          { signal: rig.signal },
        );
        shelfTabEls.push(t);
        shelfTabs.appendChild(t);
      });

      // -- assembly -----------------------------------------------------------

      const stageHolder = h('div', 'lg-stages');
      stageHolder.append(meterStage, bookStage, findStage);
      el.append(rail.el, box('pm-body', stageHolder, box('pm-shelf', shelfTabs, shelfBody)));

      rail.onGo = (i) => {
        el.dataset.stage = String(i);
        if (i === 2) {
          findStage.appendChild(columnSide);
          openVolume = 0;
          paintShelf();
        }
      };

      paintMeter();
      paintBook();
      paintShelf();
      rail.go(cast ? 2 : registersRead ? 1 : 0);

      ctx.note(
        cast
          ? 'Two registers and a book. One of the three is wrong, and it will not be the registers.'
          : registersRead
            ? 'Sixteen entries in the day’s post book. Carry every one of them.'
            : 'A machine that has counted every impression taken in this building since 1961, and nobody has ever asked it anything.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================

/**
 * Registers every deduction mechanism in this batch. The integration layer
 * calls one of these per batch, so a puzzle file can be added or pulled
 * without anybody editing a central table.
 */
export function registerLogicPuzzles(): void {
  registerPuzzle('puz-forty-seven-cards', fortySevenCards);
  // 'puz-chart-loft' is registered by the sensory batch: its primary verb is
  // audio-rhythm timing, and registering it here too made the two modules
  // race for the id. `puz-postmasters-register` came here in exchange — a
  // serial-record audit is the same animal as the reconciliation, and it is
  // the exercise that teaches the player to read the later ones.
  registerPuzzle('puz-postmasters-register', postmastersRegister);
  registerPuzzle('puz-reconciliation', reconciliation);
  registerPuzzle('puz-board-of-dissolution', boardOfDissolution);
}
