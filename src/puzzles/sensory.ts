/**
 * The optical, acoustic and forensic bench.
 *
 * Four mechanisms live in this file and they are all the same argument made
 * four different ways: *a thing can be interrogated by looking at it properly,
 * and looking properly is a procedure rather than a talent.* Wren never
 * intuits an answer in any of them. She characterises four machines before she
 * dates a single sheet; she lifts by torchlight and writes down only what she
 * heard; she runs all five steps on a letter she desperately wants to be true;
 * she counts the seconds nobody asked a nineteen-year-old to count in 1975.
 *
 *   puz-typewriter-survey       Act I    four specimen sheets, a 4x loupe and
 *                                        a defect vocabulary on a printed card
 *   puz-bottom-shelf            Act II   a failing torch, rising water, and
 *                                        forty feet of galvanised duct
 *   puz-deakin-authentication   Act III  raking light, chain lines, fibre,
 *                                        a postmark and five ribbon inks
 *   puz-chart-loft              Act III  a stopwatch on a telephone and three
 *                                        surveys registered on their trig marks
 *
 * House rules, observed throughout.
 *
 *  1. DRAGGING IS NEVER REIMPLEMENTED. Every grab, lever, knob and thumbwheel
 *     is a primitive from `puzzle-host`, so a chart layer here has the same
 *     weight in the hand as a Fresnel panel three puzzles away. Gestures the
 *     kit does not cover — a loupe tracking the pointer, a wheel-rotated
 *     transparency, a two-second hold on a box in the dark — are written once
 *     at the top of this file and shared.
 *  2. EVERY OPTICAL SIGNAL IS ALSO A SENTENCE. The loupe says in words what is
 *     under it; the fibre plate names the furnish; the registration readout
 *     gives residuals in yards. A player who cannot see the pixels can still
 *     do the whole job, because the job is judgement and the pixels are only
 *     the evidence for it.
 *  3. THE CHECK IS CONTINUOUS, except at the three places where committing an
 *     assertion *is* the move the fiction is about — filing an adverse report,
 *     signing a transcript, entering a reading in the casebook. Those are
 *     signatures, not submit buttons, and they are drawn as levers.
 *  4. NOTHING IS CARRIED BY HUE ALONE. Every state that matters has a glyph, a
 *     hatch, a notch or a word beside it, and the colour-blind pass at the
 *     bottom of the stylesheet turns those up rather than swapping the palette.
 */

import type { PuzzleContext, PuzzleModule } from '@/engine/types';
import {
  makeDraggable,
  makeSlider,
  registerPuzzle,
  type Control,
} from '@/ui/puzzle-host';

import '@/styles/puzzles-sensory.css';

// ===========================================================================
// Workshop stock — shared by all four mechanisms
// ===========================================================================

type Attrs = Record<string, string>;
type Feedback = PuzzleContext['feedback'];

/** Element builder. Saves several hundred lines of `createElement`. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
  attrs: Attrs = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The same, in the SVG namespace. */
function sv<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const COUNT_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
const wordFor = (n: number) => COUNT_WORDS[n] ?? String(n);

/**
 * Deterministic noise. A specimen sheet's ink jitter, a shelf's box order and
 * a voice's pitch drift must all be the same in this session as in the last
 * one, or a reloaded save is a different puzzle wearing the same name.
 */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 0x9e37;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x1_0000_0000;
  };
}

// -- persisted-state readers -------------------------------------------------
// `ctx.state` is a bag off a JSON save file and may hold anything a previous
// build wrote, so every read is a coercion with a default rather than a cast.

const asNum = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const asBool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d);
const asStr = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStrs = (v: unknown): string[] => asList(v).filter((x): x is string => typeof x === 'string');
const asBag = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Teardown ledger.
 *
 * A mechanism that leaks one animation frame keeps a torch battery draining
 * for the rest of the session, so every listener, timer, frame, observer,
 * audio node and primitive control is booked here on the way in and cancelled
 * in a single call on the way out.
 */
class Bin {
  private ac = new AbortController();
  private jobs: (() => void)[] = [];
  private timers = new Set<number>();

  /** Hand to every `addEventListener` so one abort takes them all. */
  get signal(): AbortSignal {
    return this.ac.signal;
  }

  /** Books a primitive control — or anything with `destroy` — for teardown. */
  own<T extends { destroy(): void }>(control: T): T {
    this.jobs.push(() => control.destroy());
    return control;
  }

  onCleanup(fn: () => void) {
    this.jobs.push(fn);
  }

  after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  /**
   * A rAF loop yielding a clamped delta in milliseconds. The clamp is
   * load-bearing: a backgrounded tab returns with a delta of thirty seconds,
   * and an unclamped integrator would drown a strongroom between two frames.
   */
  loop(fn: (dtMs: number, nowMs: number) => void) {
    let frame = 0;
    let last = performance.now();
    let live = true;
    const tick = (now: number) => {
      if (!live) return;
      fn(Math.min(64, now - last), now);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    this.jobs.push(() => {
      live = false;
      cancelAnimationFrame(frame);
    });
  }

  /** Re-runs `fn` whenever `target` changes size. Used by every light table. */
  observe(target: Element, fn: () => void) {
    const ro = new ResizeObserver(() => fn());
    ro.observe(target);
    this.jobs.push(() => ro.disconnect());
  }

  empty() {
    this.ac.abort();
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const job of this.jobs.splice(0)) {
      try {
        job();
      } catch (err) {
        console.error('[sensory] teardown step threw', err);
      }
    }
  }
}

/**
 * What is under the centre of a dragged chip.
 *
 * The chip is made transparent to hit-testing for exactly one call, because
 * otherwise every drop lands on the thing being dropped.
 */
function dropTargetUnder(chip: HTMLElement, selector: string): HTMLElement | null {
  const r = chip.getBoundingClientRect();
  const was = chip.style.pointerEvents;
  chip.style.pointerEvents = 'none';
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  chip.style.pointerEvents = was;
  return hit instanceof Element ? (hit.closest(selector) as HTMLElement | null) : null;
}

/**
 * Roving-tabindex keyboard navigation over a list of cells laid out in rows.
 *
 * Ninety type glyphs, twenty-four boxes in the dark and eleven index entries
 * are all the same problem: they must be one stop in the tab order and then
 * navigable with the arrow keys, because tabbing ninety times to reach the
 * last letter of a specimen line is not accessibility, it is a penalty.
 */
function rovingGrid(
  cells: HTMLElement[],
  rowOf: (i: number) => number,
  onFocus?: (i: number) => void,
): { focus(i: number): void; index(): number } {
  let cursor = 0;
  const put = (i: number, move: boolean) => {
    if (!cells.length) return;
    cursor = clamp(i, 0, cells.length - 1);
    cells.forEach((c, n) => (c.tabIndex = n === cursor ? 0 : -1));
    if (move) cells[cursor].focus({ preventScroll: true });
    onFocus?.(cursor);
  };

  const step = (from: number, dir: 1 | -1, sameRow: boolean) => {
    if (!sameRow) {
      // Vertical travel: nearest cell in the neighbouring row, by position.
      const row = rowOf(from) + dir;
      const target = cells.findIndex((_, i) => rowOf(i) === row);
      if (target < 0) return from;
      const inRow = cells.map((_, i) => i).filter((i) => rowOf(i) === row);
      const here = cells.map((_, i) => i).filter((i) => rowOf(i) === rowOf(from)).indexOf(from);
      return inRow[clamp(here, 0, inRow.length - 1)];
    }
    return clamp(from + dir, 0, cells.length - 1);
  };

  cells.forEach((cell, i) => {
    cell.tabIndex = i === 0 ? 0 : -1;
    cell.addEventListener('focus', () => {
      cursor = i;
      cells.forEach((c, n) => (c.tabIndex = n === i ? 0 : -1));
      onFocus?.(i);
    });
    cell.addEventListener('keydown', (ev: KeyboardEvent) => {
      let next: number | null = null;
      if (ev.key === 'ArrowRight') next = step(i, 1, true);
      else if (ev.key === 'ArrowLeft') next = step(i, -1, true);
      else if (ev.key === 'ArrowDown') next = step(i, 1, false);
      else if (ev.key === 'ArrowUp') next = step(i, -1, false);
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = cells.length - 1;
      if (next === null) return;
      ev.preventDefault();
      ev.stopPropagation();
      put(next, true);
    });
  });

  put(0, false);
  return { focus: (i: number) => put(i, true), index: () => cursor };
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

/**
 * A very small synthesiser, built for two jobs this file cannot do without: a
 * telephone tap that has to be timed to a tenth of a second, and two women
 * arguing forty feet away through galvanised duct.
 *
 * Both are synthesised rather than sampled, and not to save a download. The
 * strongroom argument has to be *nearly* intelligible — the exact edge where a
 * word arrives and the next one does not is the entire mechanic — and that
 * edge is a filter cutoff, which means it has to be a parameter rather than a
 * recording somebody once made a judgement about.
 */
class Tone {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private live = new Set<AudioScheduledSourceNode>();
  private rand = seeded(0x10ADED);

  /** Lazily opens the context. Must be reached from a real user gesture. */
  open(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    let c: AudioContext;
    try {
      c = new Ctor();
    } catch {
      // No audio device, a locked context, a browser in a mood. Every caller
      // treats null as "play it silently" rather than as a failure.
      return null;
    }
    this.ctx = c;
    const bus = c.createGain();
    bus.gain.value = 0.85;
    bus.connect(c.destination);
    this.bus = bus;

    const len = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = this.rand() * 2 - 1;
    this.noise = buf;
    return c;
  }

  /** Seconds on the audio clock — the only clock worth timing taps against. */
  now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  /**
   * A 1974 trunk line: three hundred hertz to three thousand four hundred,
   * and a peak at seventeen hundred that is most of what makes a telephone
   * sound like a telephone rather than like a small radio.
   */
  telephone(): AudioNode | null {
    const c = this.ctx;
    if (!c || !this.bus) return null;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    const peak = c.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 1720;
    peak.Q.value = 1.2;
    peak.gain.value = 7;
    hp.connect(lp);
    lp.connect(peak);
    peak.connect(this.bus);
    return hp;
  }

  /** A plain gain node hanging off the bus, for anything not on a telephone. */
  channel(gain = 1): GainNode | null {
    const c = this.ctx;
    if (!c || !this.bus) return null;
    const g = c.createGain();
    g.gain.value = gain;
    g.connect(this.bus);
    return g;
  }

  private source(buf: AudioBuffer, loop: boolean): AudioBufferSourceNode | null {
    const c = this.ctx;
    if (!c) return null;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    this.live.add(src);
    src.addEventListener('ended', () => this.live.delete(src));
    return src;
  }

  /** A fingernail on a Formica kitchen table, forty miles down a wire. */
  tap(at: number, dest: AudioNode, gain = 1): void {
    const c = this.ctx;
    if (!c || !this.noise) return;
    const src = this.source(this.noise, false);
    if (!src) return;
    src.playbackRate.value = 1.6;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500 + this.rand() * 260;
    bp.Q.value = 2.1;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.5 * gain, at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    src.connect(bp);
    bp.connect(env);
    env.connect(dest);
    src.start(at, this.rand() * 1.2);
    src.stop(at + 0.12);
  }

  /**
   * Continuous filtered noise — the sump under the strongroom floor, the duct,
   * the rain. Returns a stopper so the caller can book it for teardown.
   */
  bed(dest: AudioNode, cutoff: number, gain: number): (() => void) | null {
    const c = this.ctx;
    if (!c || !this.noise) return null;
    const src = this.source(this.noise, true);
    if (!src) return null;
    src.playbackRate.value = 0.35;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(gain, c.currentTime + 1.2);
    src.connect(lp);
    lp.connect(g);
    g.connect(dest);
    src.start();
    return () => {
      try {
        g.gain.cancelScheduledValues(c.currentTime);
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.35);
        src.stop(c.currentTime + 0.4);
      } catch {
        /* already stopped */
      }
    };
  }

  /**
   * A human being talking through a wall.
   *
   * Three parallel formant band-passes over a drifting sawtooth, an envelope
   * bumped once per syllable, and a lowpass whose cutoff *is* the
   * intelligibility: at six hundred hertz it is a voice with a shape and no
   * words in it, at three and a half thousand you can hear which word it was.
   */
  speak(
    at: number,
    dest: AudioNode,
    syllables: number[],
    opts: { f0: number; clarity: number; level?: number },
  ): number {
    const c = this.ctx;
    if (!c || !syllables.length) return at;

    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    this.live.add(osc);
    osc.addEventListener('ended', () => this.live.delete(osc));

    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, at);

    let t = at;
    osc.frequency.setValueAtTime(opts.f0, at);
    for (const d of syllables) {
      // Speech is not a monotone: each syllable lands on its own pitch, and
      // the last one in a phrase falls, which is what makes it a sentence.
      osc.frequency.linearRampToValueAtTime(opts.f0 * (0.9 + this.rand() * 0.24), t + d * 0.4);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.42 * (opts.level ?? 1), t + d * 0.3);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.94);
      t += d;
    }

    const mix = c.createGain();
    mix.gain.value = 0.9;
    const formants: [number, number, number][] = [
      [520, 6, 1],
      [1180, 8, 0.55],
      [2560, 9, 0.28],
    ];
    for (const [f, q, g] of formants) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const lvl = c.createGain();
      lvl.gain.value = g;
      amp.connect(bp);
      bp.connect(lvl);
      lvl.connect(mix);
    }

    const veil = c.createBiquadFilter();
    veil.type = 'lowpass';
    veil.frequency.value = lerp(560, 3600, clamp(opts.clarity, 0, 1));
    veil.Q.value = 0.6;
    mix.connect(veil);
    veil.connect(dest);

    osc.connect(amp);
    osc.start(at);
    osc.stop(t + 0.06);
    return t;
  }

  /** Silences everything in flight. Called on every unmount, unconditionally. */
  stopAll(): void {
    for (const src of [...this.live]) {
      try {
        src.stop();
      } catch {
        /* already stopped, or never started */
      }
    }
    this.live.clear();
  }

  close(): void {
    this.stopAll();
    const c = this.ctx;
    this.ctx = null;
    this.bus = null;
    this.noise = null;
    if (c) void c.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// The reference books
// ---------------------------------------------------------------------------

interface RefEntry {
  id: string;
  head: string;
  body: string;
  /** Right-hand column: the dated fact the whole lookup exists to deliver. */
  tail?: string;
}

interface RefPage {
  id: string;
  tab: string;
  head: string;
  entries: RefEntry[];
  foot?: string;
}

interface RefBook {
  el: HTMLElement;
  open(pageId: string): void;
  destroy(): void;
}

/**
 * A bound, thumb-indexed reference book with real lookup in it.
 *
 * Three of this file's findings are only findings because somebody went and
 * looked them up: a paper stock, a sorting office, a light characteristic. The
 * book therefore has to be a book — pages, tabs, a gutter, entries you have to
 * find among entries you do not want — and not a dropdown, because a dropdown
 * would be the game telling the player which fact matters.
 */
function makeRefBook(opts: {
  label: string;
  pages: RefPage[];
  feedback?: Feedback;
  onPick?(entry: RefEntry, page: RefPage): void;
}): RefBook {
  const el = h('div', 'sx-book', '', { role: 'group', 'aria-label': opts.label });
  const tabs = h('div', 'sx-book-tabs', '', { role: 'tablist', 'aria-label': `${opts.label}: thumb index` });
  const leaf = h('div', 'sx-book-leaf');
  const head = h('p', 'sx-book-head');
  const list = h('ul', 'sx-book-list');
  const foot = h('p', 'sx-book-foot');
  leaf.append(head, list, foot);

  const spine = h('span', 'sx-book-spine', '', { 'aria-hidden': 'true' });
  el.append(spine, tabs, leaf);

  let current = opts.pages[0]?.id ?? '';
  const tabEls = new Map<string, HTMLButtonElement>();

  const draw = () => {
    const page = opts.pages.find((p) => p.id === current) ?? opts.pages[0];
    if (!page) return;
    head.textContent = page.head;
    foot.textContent = page.foot ?? '';
    foot.hidden = !page.foot;
    list.textContent = '';
    for (const entry of page.entries) {
      const row = h('li', 'sx-book-row');
      const inner = opts.onPick
        ? h('button', 'sx-book-entry', '', { type: 'button', 'data-entry': entry.id })
        : h('div', 'sx-book-entry', '', { 'data-entry': entry.id });
      inner.append(
        h('span', 'sx-book-term', entry.head),
        h('span', 'sx-book-gloss', entry.body),
        h('span', 'sx-book-tail', entry.tail ?? ''),
      );
      if (inner instanceof HTMLButtonElement) {
        inner.addEventListener('click', () => {
          opts.feedback?.('click');
          opts.onPick?.(entry, page);
        });
      }
      row.appendChild(inner);
      list.appendChild(row);
    }
    for (const [id, btn] of tabEls) {
      const on = id === current;
      btn.setAttribute('aria-selected', String(on));
      btn.classList.toggle('is-open', on);
    }
  };

  for (const page of opts.pages) {
    const tab = h('button', 'sx-book-tab', page.tab, {
      type: 'button',
      role: 'tab',
      'aria-selected': 'false',
      'aria-label': `${page.tab} — ${page.head}`,
    });
    tab.addEventListener('click', () => {
      current = page.id;
      opts.feedback?.('tick');
      draw();
    });
    tabEls.set(page.id, tab);
    tabs.appendChild(tab);
  }

  draw();

  return {
    el,
    open(pageId: string) {
      if (opts.pages.some((p) => p.id === pageId)) {
        current = pageId;
        draw();
      }
    },
    destroy() {
      el.remove();
    },
  };
}

/** A brass lever: the deliberate, signed, irreversible act. Never a button. */
function makeLever(label: string, sub: string, onPull: () => void, feedback?: Feedback): HTMLButtonElement {
  const el = h('button', 'sx-lever', '', { type: 'button' });
  el.append(
    h('span', 'sx-lever-slot', '', { 'aria-hidden': 'true' }),
    h('span', 'sx-lever-knob', '', { 'aria-hidden': 'true' }),
    h('span', 'sx-lever-label', label),
    h('span', 'sx-lever-sub', sub),
  );
  el.setAttribute('aria-label', `${label}. ${sub}`);
  el.addEventListener('click', () => {
    if (el.getAttribute('aria-disabled') === 'true') {
      feedback?.('bad');
      return;
    }
    feedback?.('click');
    el.classList.remove('is-pulled');
    void el.offsetWidth;
    el.classList.add('is-pulled');
    onPull();
  });
  return el;
}

/** Sets a lever's armed state without making it unfocusable. */
function armLever(lever: HTMLButtonElement, armed: boolean) {
  lever.setAttribute('aria-disabled', armed ? 'false' : 'true');
  lever.classList.toggle('is-armed', armed);
}

// ===========================================================================
// 1 · puz-typewriter-survey — "Four Machines, Four Injuries"
// ===========================================================================
//
// The teaching puzzle, and the one that quietly arms Act IV. The player learns
// a vocabulary of seven named type faults, a rule for telling a machine from
// an accident — *a fault seen once is a bad strike; a fault seen on every
// impression of the letters it injures is the machine* — and then applies both
// to an unlabelled sheet out of a coroner's file twenty-four years later.
//
// The specimen line is Conservancy card 7 and it is chosen, not decorative:
// `a` and `e` recur many times, capitals recur, and `,`, `y`, `3`, `l` and `X`
// each appear exactly once, so every machine carries one systematic fault and
// one perfectly true singleton that is *not* the answer.

type DefectId = 'clogged' | 'riding' | 'dropping' | 'doubling' | 'chipped' | 'descender' | 'wandering';

interface DefectSpec {
  id: DefectId;
  name: string;
  /** Card 7's worked example — the whole solution source, printed. */
  gloss: string;
  /** What Wren says under the loupe, spoken to the live region. */
  observed: string;
}

const DEFECTS: DefectSpec[] = [
  {
    id: 'clogged',
    name: 'Clogged counter',
    gloss: 'The enclosed white inside a letter filled solid. Ink, wax and cotton dust, packed hard. It worsens by the year and never improves.',
    observed: 'the counter filled solid — a hard plug of ink and wax, dark as a full stop',
  },
  {
    id: 'riding',
    name: 'Riding high',
    gloss: 'The impression stands above the line of its neighbours. A fault of the typebar’s rest, measured in tenths of a millimetre.',
    observed: 'standing three tenths of a millimetre above the line of its neighbours',
  },
  {
    id: 'dropping',
    name: 'Dropping',
    gloss: 'The impression sits below the line. Usually a whole class at once — the capitals, or the figures — because they hang on one segment.',
    observed: 'sitting two tenths of a millimetre below the line of the lower case',
  },
  {
    id: 'doubling',
    name: 'Doubling',
    gloss: 'A grey ghost a hair behind the black. A slack ribbon vibrator lets the ribbon fall back across the same strike.',
    observed: 'a grey ghost a hair behind and below the black — the ribbon falling twice',
  },
  {
    id: 'chipped',
    name: 'Chipped',
    gloss: 'A piece gone from the face of the type. A hard, straight edge: ink cannot make that shape and neither can a bad strike.',
    observed: 'a square bite out of the face — a hard edge, and ink does not make hard edges',
  },
  {
    id: 'descender',
    name: 'Broken descender',
    gloss: 'The tail below the line snapped clean off. The bowl prints, the tail does not, and the letter sits up like a bird.',
    observed: 'the tail below the line snapped clean off — the bowl prints and nothing else does',
  },
  {
    id: 'wandering',
    name: 'Wandering',
    gloss: 'The character prints out of its own column, leaning or shouldered aside. A worn pivot at the typebar’s heel.',
    observed: 'shouldered out of its own column and leaning right — a worn pivot at the heel',
  },
];

const defectByName = new Map(DEFECTS.map((d) => [d.id, d]));
const defectName = (id: DefectId) => defectByName.get(id)?.name ?? id;

/** Conservancy card 7, the standard specimen line. Two lines, struck once. */
const SPECIMEN: string[] = [
  'the lamp, a sea-mark and every beacon: 3 fathoms',
  'PACK MY BOX WITH FIVE DOZEN JUGS 1928',
];

/** The unlabelled fifth sheet: the 1998 accident report, out of the coroner's file. */
const ORPHAN_SHEET: string[] = [
  'at 09.10 the deceased was found at the foot of the',
  'gallery stair, apparently having fallen backwards',
];

interface FaultRule {
  test(ch: string): boolean;
  defect: DefectId;
}

interface MachineSpec {
  id: string;
  name: string;
  room: string;
  year: string;
  /** Rules in order; the first that matches a glyph wins. */
  rules: FaultRule[];
  /** The fault that recurs, and therefore the fault that dates the machine. */
  primary: DefectId;
}

const isUpper = (ch: string) => ch >= 'A' && ch <= 'Z';
const isPrinting = (ch: string) => ch.trim().length > 0;

const MACHINES: MachineSpec[] = [
  {
    id: 'imperial-66',
    name: 'Imperial 66',
    room: 'Warden’s Office',
    year: '1961',
    rules: [
      { test: (c) => c === ',', defect: 'riding' },
      { test: (c) => c === 'y', defect: 'descender' },
      { test: (c) => c === 'a', defect: 'clogged' },
    ],
    primary: 'clogged',
  },
  {
    id: 'underwood-5',
    name: 'Underwood 5',
    room: 'Rolls Room',
    year: '1928',
    rules: [
      { test: (c) => c === '3', defect: 'wandering' },
      { test: (c) => c === 'e', defect: 'riding' },
    ],
    primary: 'riding',
  },
  {
    id: 'olivetti-32',
    name: 'Olivetti Lettera 32',
    room: 'Registry Counter',
    year: '1966',
    rules: [
      { test: (c) => c === 'l', defect: 'chipped' },
      { test: isPrinting, defect: 'doubling' },
    ],
    primary: 'doubling',
  },
  {
    id: 'remington-noiseless',
    name: 'Remington Noiseless',
    room: 'Accounts Office',
    year: '1938',
    rules: [
      { test: (c) => c === 'X', defect: 'chipped' },
      { test: isUpper, defect: 'dropping' },
    ],
    primary: 'dropping',
  },
];

interface Glyph {
  ch: string;
  line: number;
  fault: DefectId | null;
  /** Which impression of this character this is, and how many there are. */
  nth: number;
  of: number;
}

/** Strikes one specimen sheet: every glyph, with whatever the type did to it. */
function strikeSheet(spec: MachineSpec, lines: string[]): Glyph[] {
  const counts = new Map<string, number>();
  const flat: { ch: string; line: number }[] = [];
  lines.forEach((text, line) => {
    for (const ch of text) {
      flat.push({ ch, line });
      if (isPrinting(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  });
  const seen = new Map<string, number>();
  return flat.map(({ ch, line }) => {
    const nth = isPrinting(ch) ? (seen.set(ch, (seen.get(ch) ?? 0) + 1), seen.get(ch)!) : 0;
    const rule = isPrinting(ch) ? spec.rules.find((r) => r.test(ch)) : undefined;
    return { ch, line, fault: rule ? rule.defect : null, nth, of: counts.get(ch) ?? 0 };
  });
}

/** How many impressions on this sheet carry a given fault. */
function faultTally(glyphs: Glyph[], defect: DefectId): number {
  return glyphs.reduce((n, g) => (g.fault === defect ? n + 1 : n), 0);
}

const SPOKEN: Record<string, string> = {
  ',': 'comma',
  ':': 'colon',
  '.': 'full stop',
  '-': 'hyphen',
  ' ': 'space',
};

const spokenGlyph = (ch: string) =>
  SPOKEN[ch] ?? (isUpper(ch) ? `capital ${ch}` : ch >= '0' && ch <= '9' ? `figure ${ch}` : `letter ${ch}`);

function typewriterSurvey(): PuzzleModule {
  const bin = new Bin();
  const rng = seeded(0x7ea51e);

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const wrap = h('div', 'sx sx-tw');
      root.appendChild(wrap);

      // -- persisted state --------------------------------------------------
      const savedAlbums = asBag(ctx.state.albums);
      /** machine id → the tag she has pinned, and the glyph she pinned it to. */
      const albums = new Map<string, { defect: DefectId; glyph: number }>();
      for (const m of MACHINES) {
        const rec = asBag(savedAlbums[m.id]);
        const defect = asStr(rec.defect) as DefectId;
        if (defectByName.has(defect)) {
          albums.set(m.id, { defect, glyph: asNum(rec.glyph, 0) });
        }
      }
      let attribution = asStr(ctx.state.attribution);

      const sheets = new Map<string, Glyph[]>(
        MACHINES.map((m) => [m.id, strikeSheet(m, SPECIMEN)]),
      );
      const orphan = strikeSheet(MACHINES[0], ORPHAN_SHEET);

      let active = MACHINES[0].id;
      /** The tag currently in her fingers, for the click-then-click route. */
      let armed: DefectId | null = null;
      let solvedOnce = false;

      // -- furniture --------------------------------------------------------
      const step = h('p', 'sx-step');
      const body = h('div', 'sx-tw-body');
      wrap.append(step, body);

      // Left: the four albums, and eventually the sheet with no name on it.
      const rail = h('div', 'sx-tw-rail', '', { role: 'group', 'aria-label': 'Specimen albums' });
      // Centre: the light box.
      const boxWrap = h('div', 'sx-tw-boxwrap');
      // Right: Conservancy card 7.
      const card = h('div', 'sx-tw-card');
      body.append(rail, boxWrap, card);

      // -- the light box ----------------------------------------------------
      const lightbox = h('div', 'sx-tw-lightbox');
      const sheetEl = h('div', 'sx-tw-sheet', '', {
        role: 'group',
        'aria-label': 'Specimen sheet. Arrow keys move along the line.',
      });
      const loupe = h('div', 'sx-tw-loupe', '', { 'aria-hidden': 'true' });
      const loupeInner = h('div', 'sx-tw-loupe-inner');
      loupe.appendChild(loupeInner);
      lightbox.append(sheetEl, loupe);

      const readout = h('p', 'sx-tw-read', 'Bring the loupe over the type.', {
        role: 'status',
        'aria-live': 'polite',
      });
      boxWrap.append(lightbox, readout);

      let glyphEls: HTMLElement[] = [];
      let ghostEls: HTMLElement[] = [];
      let renderedFor = '';

      /** Builds one rendering of a sheet. `live` gets buttons; the loupe's copy does not. */
      const renderSheet = (glyphs: Glyph[], live: boolean): { el: HTMLElement; cells: HTMLElement[] } => {
        const host = h('div', 'sx-tw-lines');
        const cells: HTMLElement[] = [];
        const byLine = new Map<number, HTMLElement>();
        glyphs.forEach((g, i) => {
          let line = byLine.get(g.line);
          if (!line) {
            line = h('div', 'sx-tw-line');
            byLine.set(g.line, line);
            host.appendChild(line);
          }
          if (!isPrinting(g.ch)) {
            line.appendChild(h('span', 'sx-tw-sp', ' ', { 'aria-hidden': 'true' }));
            cells.push(h('span'));
            return;
          }
          const cell = live
            ? h('span', 'sx-tw-g', g.ch, { role: 'button', tabindex: '-1' })
            : h('span', 'sx-tw-g', g.ch, { 'aria-hidden': 'true' });
          if (g.fault) cell.dataset.fault = g.fault;
          // Deterministic ink jitter: no two impressions of the same sort are
          // ever identical, and a sheet where they are looks like a font.
          cell.style.setProperty('--jx', `${(rng() - 0.5) * 0.05}em`);
          cell.style.setProperty('--jy', `${(rng() - 0.5) * 0.035}em`);
          cell.style.setProperty('--ink', (0.82 + rng() * 0.18).toFixed(3));
          if (live) {
            cell.dataset.i = String(i);
            cell.setAttribute(
              'aria-label',
              `${spokenGlyph(g.ch)}, impression ${g.nth} of ${g.of}`,
            );
          }
          line.appendChild(cell);
          cells.push(cell);
        });
        return { el: host, cells };
      };

      const setSheet = (glyphs: Glyph[]) => {
        sheetEl.textContent = '';
        loupeInner.textContent = '';
        const live = renderSheet(glyphs, true);
        const ghost = renderSheet(glyphs, false);
        sheetEl.appendChild(live.el);
        loupeInner.appendChild(ghost.el);
        glyphEls = live.cells;
        ghostEls = ghost.cells;

        const printable = glyphs.map((g, i) => (isPrinting(g.ch) ? i : -1)).filter((i) => i >= 0);
        rovingGrid(
          printable.map((i) => glyphEls[i]),
          (n) => glyphs[printable[n]].line,
          (n) => aimLoupeAt(glyphEls[printable[n]]),
        );
        for (const i of printable) {
          const cell = glyphEls[i];
          cell.addEventListener(
            'click',
            () => {
              placeTag(i);
            },
            { signal: bin.signal },
          );
          cell.addEventListener(
            'keydown',
            (ev: KeyboardEvent) => {
              if (ev.key !== 'Enter' && ev.key !== ' ') return;
              ev.preventDefault();
              ev.stopPropagation();
              placeTag(i);
            },
            { signal: bin.signal },
          );
        }
        paintTags();
      };

      // -- the loupe --------------------------------------------------------
      // Four power, and it is a real 4x: the same markup rendered again and
      // scaled, so a chipped l is chipped at any magnification rather than
      // being a low-resolution photograph of a chipped l.
      const ZOOM = 4;

      const showLoupe = (x: number, y: number) => {
        loupe.classList.add('is-in');
        loupe.style.setProperty('--lx', `${x}px`);
        loupe.style.setProperty('--ly', `${y}px`);
        const size = loupe.offsetWidth || 148;
        loupeInner.style.transform =
          `translate(${size / 2 - x * ZOOM}px, ${size / 2 - y * ZOOM}px) scale(${ZOOM})`;
      };

      const aimLoupeAt = (cell: HTMLElement) => {
        if (!cell.isConnected) return;
        const box = lightbox.getBoundingClientRect();
        const c = cell.getBoundingClientRect();
        showLoupe(c.left + c.width / 2 - box.left, c.top + c.height / 2 - box.top);
        describe(cell);
      };

      const glyphsFor = (id: string) => (id === 'orphan' ? orphan : sheets.get(id)!);

      const describe = (cell: HTMLElement) => {
        const i = Number(cell.dataset.i ?? -1);
        const glyphs = glyphsFor(active);
        const g = glyphs[i];
        if (!g) return;
        const where = `${spokenGlyph(g.ch)}, impression ${g.nth} of ${g.of}`;
        if (!g.fault) {
          readout.textContent = `Under the loupe: the ${where}. Clean. Nothing to record.`;
          return;
        }
        readout.textContent =
          `Under the loupe: the ${where} — ${defectByName.get(g.fault)!.observed}.`;
      };

      lightbox.addEventListener(
        'pointermove',
        (ev: PointerEvent) => {
          const r = lightbox.getBoundingClientRect();
          showLoupe(ev.clientX - r.left, ev.clientY - r.top);
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          const cell = hit instanceof Element ? hit.closest<HTMLElement>('.sx-tw-g[data-i]') : null;
          if (cell) describe(cell);
        },
        { signal: bin.signal },
      );
      lightbox.addEventListener('pointerleave', () => loupe.classList.remove('is-in'), {
        signal: bin.signal,
      });

      // -- Conservancy card 7 -----------------------------------------------
      card.append(
        h('p', 'sx-card-title', 'Conservancy card 7'),
        h('p', 'sx-card-sub', 'Named faults of typescript, with the rule for using them'),
      );

      const rule = h('p', 'sx-tw-rule');
      rule.append(
        h('strong', '', 'The rule. '),
        document.createTextNode(
          'A fault seen once is an accident of the strike — dirt, a hard finger, a fold in the ribbon. A fault seen on every impression of the letters it injures is the machine. Record the machine, and only the machine.',
        ),
      );
      card.appendChild(rule);

      const tagList = h('div', 'sx-tw-tags', '', { role: 'group', 'aria-label': 'Defect tags' });
      card.appendChild(tagList);

      const tagEls = new Map<DefectId, HTMLElement>();

      const setArmed = (defect: DefectId | null) => {
        armed = defect;
        for (const [id, el] of tagEls) {
          const on = id === defect;
          el.classList.toggle('is-armed', on);
          el.setAttribute('aria-pressed', String(on));
        }
        if (defect) {
          readout.textContent =
            `${defectName(defect)} in hand. Put it on the impression that shows it.`;
        }
      };

      for (const d of DEFECTS) {
        const tag = h('div', 'sx-tw-tag', '', {
          role: 'button',
          'aria-pressed': 'false',
          'data-defect': d.id,
        });
        tag.append(
          h('span', 'sx-tw-tag-name', d.name),
          h('span', 'sx-tw-tag-gloss', d.gloss),
          h('span', 'sx-tw-tag-hole', '', { 'aria-hidden': 'true' }),
        );
        tag.setAttribute('aria-label', `${d.name}. ${d.gloss}`);
        tagEls.set(d.id, tag);
        tagList.appendChild(tag);

        const ctl = makeDraggable(tag, {
          bounds: wrap,
          label: `${d.name} tag`,
          feedback: ctx.feedback,
          onDrop: () => {
            const hitGlyph = dropTargetUnder(tag, '.sx-tw-g[data-i]');
            const hitAlbum = dropTargetUnder(tag, '.sx-tw-album');
            ctl.set({ x: 0, y: 0 }, true);
            if (hitGlyph) {
              setArmed(d.id);
              placeTag(Number(hitGlyph.dataset.i ?? -1));
            } else if (hitAlbum) {
              ctx.feedback('bad');
              readout.textContent =
                'Not onto the album. A tag is a claim about one piece of type; it goes on the impression.';
            }
          },
        });
        bin.own(ctl);

        tag.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            ev.stopPropagation();
            setArmed(armed === d.id ? null : d.id);
            ctx.feedback('tick');
          },
          { signal: bin.signal },
        );
        tag.addEventListener(
          'click',
          (ev: MouseEvent) => {
            // A click that ended a drag has already been dealt with by onDrop.
            if (tag.classList.contains('is-dragging')) return;
            ev.preventDefault();
            setArmed(armed === d.id ? null : d.id);
          },
          { signal: bin.signal },
        );
      }

      // -- the albums --------------------------------------------------------
      const albumEls = new Map<string, HTMLElement>();

      for (const m of MACHINES) {
        const album = h('button', 'sx-tw-album', '', {
          type: 'button',
          'data-album': m.id,
        });
        album.append(
          h('span', 'sx-tw-album-name', m.name),
          h('span', 'sx-tw-album-room', `${m.room} · ${m.year}`),
          h('span', 'sx-tw-album-fault', '—'),
          h('span', 'sx-tw-album-state', 'PROVISIONAL'),
        );
        album.addEventListener(
          'click',
          () => {
            if (attributionPhase() && armedOrphan) {
              commitAttribution(m.id);
              return;
            }
            active = m.id;
            ctx.feedback('tick');
            redraw();
          },
          { signal: bin.signal },
        );
        albumEls.set(m.id, album);
        rail.appendChild(album);
      }

      // The fifth sheet. Present in the layout from the first frame so nothing
      // reflows when it arrives; hidden until the four albums are mounted.
      const orphanCard = h('div', 'sx-tw-orphan', '', { hidden: 'hidden' });
      orphanCard.append(
        h('span', 'sx-tw-orphan-mark', 'NO ALBUM'),
        h('span', 'sx-tw-orphan-name', 'Accident report, 14 September 1998'),
        h('span', 'sx-tw-orphan-note', 'Out of the coroner’s file. Typed in this building; nobody has ever said on what.'),
      );
      rail.appendChild(orphanCard);

      let armedOrphan = false;
      const orphanCtl = bin.own(
        makeDraggable(orphanCard, {
          bounds: wrap,
          label: 'Unlabelled specimen sheet from the coroner’s file',
          feedback: ctx.feedback,
          onDrop: () => {
            const hit = dropTargetUnder(orphanCard, '.sx-tw-album');
            orphanCtl.set({ x: 0, y: 0 }, true);
            if (hit?.dataset.album) commitAttribution(hit.dataset.album);
          },
        }),
      );
      orphanCard.addEventListener(
        'keydown',
        (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();
          ev.stopPropagation();
          armedOrphan = !armedOrphan;
          orphanCard.classList.toggle('is-armed', armedOrphan);
          ctx.feedback('tick');
          readout.textContent = armedOrphan
            ? 'The unlabelled sheet is in hand. Choose the album it belongs to.'
            : 'Sheet down.';
        },
        { signal: bin.signal },
      );
      orphanCard.addEventListener(
        'click',
        () => {
          if (orphanCard.classList.contains('is-dragging')) return;
          armedOrphan = !armedOrphan;
          orphanCard.classList.toggle('is-armed', armedOrphan);
        },
        { signal: bin.signal },
      );

      // -- scoring -----------------------------------------------------------

      const holds = (id: string) => {
        const spec = MACHINES.find((m) => m.id === id);
        const pinned = albums.get(id);
        return !!spec && !!pinned && pinned.defect === spec.primary;
      };
      const heldCount = () => MACHINES.filter((m) => holds(m.id)).length;
      const attributionPhase = () => heldCount() === MACHINES.length;

      const persist = () => {
        const bag: Record<string, unknown> = {};
        for (const [id, v] of albums) bag[id] = { defect: v.defect, glyph: v.glyph };
        ctx.state.albums = bag;
        ctx.state.attribution = attribution;
        ctx.state.held = heldCount();
        ctx.save();
      };

      function placeTag(i: number) {
        if (active === 'orphan') {
          ctx.feedback('bad');
          readout.textContent = 'Not on this one. This sheet has no album yet; that is the whole question.';
          return;
        }
        if (!armed) {
          readout.textContent = 'Take a tag off card 7 first — then put it on the impression that shows it.';
          ctx.feedback('tick');
          return;
        }
        const glyphs = glyphsFor(active);
        const g = glyphs[i];
        if (!g) return;

        if (g.fault !== armed) {
          // A tag is a physical claim, and it is wrong at four power. Say so
          // without saying which tag would have been right.
          ctx.feedback('bad');
          readout.textContent =
            `No. The ${spokenGlyph(g.ch)} does not show ${defectName(armed).toLowerCase()}. ` +
            (g.fault
              ? `What it shows is something else, and it is worth a second look.`
              : `It is a clean impression.`);
          return;
        }

        albums.set(active, { defect: armed, glyph: i });
        ctx.feedback('click');
        const tally = faultTally(glyphs, armed);
        readout.textContent =
          `Tagged: ${defectName(armed)} on the ${spokenGlyph(g.ch)}. ` +
          (tally === 1
            ? 'That fault shows once on this sheet, and once is a bad strike.'
            : `That fault shows on ${wordFor(tally).toLowerCase()} impressions of this sheet.`);
        setArmed(null);
        persist();
        redraw();
        report();
      }

      function commitAttribution(machineId: string) {
        armedOrphan = false;
        orphanCard.classList.remove('is-armed');
        if (!attributionPhase()) {
          ctx.feedback('bad');
          readout.textContent = 'Characterise all four first. You compare afterwards, or not at all.';
          return;
        }
        attribution = machineId;
        persist();
        const right = machineId === 'imperial-66';
        ctx.feedback(right ? 'good' : 'bad');
        readout.textContent = right
          ? 'Filled a’s, a comma four tenths high, a y with no tail. The Imperial 66, in the Warden’s Office, and nothing else in this building.'
          : `${MACHINES.find((m) => m.id === machineId)?.name}? Lay the two sheets side by side again. The faults do not answer each other.`;
        redraw();
        report();
      }

      function paintTags() {
        const pinned = albums.get(active);
        glyphEls.forEach((cell, i) => {
          if (!cell.dataset.i) return;
          const on = !!pinned && pinned.glyph === i;
          cell.classList.toggle('is-tagged', on);
          const ghost = ghostEls[i];
          if (ghost) ghost.classList.toggle('is-tagged', on);
          if (on && pinned) {
            cell.setAttribute('aria-describedby', 'sx-tw-pinned');
            cell.dataset.tag = defectName(pinned.defect);
          } else {
            cell.removeAttribute('aria-describedby');
            delete cell.dataset.tag;
          }
        });
      }

      function redraw() {
        // Albums
        for (const m of MACHINES) {
          const el = albumEls.get(m.id)!;
          const pinned = albums.get(m.id);
          const glyphs = sheets.get(m.id)!;
          const faultEl = el.querySelector('.sx-tw-album-fault')!;
          const stateEl = el.querySelector('.sx-tw-album-state')!;
          if (!pinned) {
            faultEl.textContent = '—';
            stateEl.textContent = 'PROVISIONAL';
            el.dataset.holds = 'no';
          } else {
            const tally = faultTally(glyphs, pinned.defect);
            const g = glyphs[pinned.glyph];
            faultEl.textContent =
              `${defectName(pinned.defect).toUpperCase()} — on the ${spokenGlyph(g?.ch ?? '?')}; ` +
              (tally === 1
                ? 'seen once only.'
                : `recurring on ${wordFor(tally).toLowerCase()} impressions.`);
            const ok = pinned.defect === m.primary;
            stateEl.textContent = ok ? 'MOUNTED' : 'PROVISIONAL';
            el.dataset.holds = ok ? 'yes' : 'no';
          }
          el.classList.toggle('is-open', active === m.id);
          el.setAttribute('aria-current', active === m.id ? 'true' : 'false');
        }

        // The fifth sheet
        const phase = attributionPhase();
        orphanCard.hidden = !phase;
        orphanCard.classList.toggle('is-placed', !!attribution);
        const note = orphanCard.querySelector('.sx-tw-orphan-note')!;
        note.textContent = attribution
          ? `Filed against the ${MACHINES.find((m) => m.id === attribution)?.name}.`
          : 'Out of the coroner’s file. Typed in this building; nobody has ever said on what.';

        // The light box. Re-striking the sheet costs ninety elements and, worse,
        // throws away the player's place in the line, so it happens only when
        // the sheet on the box has actually changed.
        if (renderedFor !== active) {
          renderedFor = active;
          setSheet(glyphsFor(active));
        } else {
          paintTags();
        }
        const spec = MACHINES.find((m) => m.id === active);
        step.textContent = phase
          ? 'Four albums mounted. Now the sheet with nothing written on it — take it to the album it came from.'
          : `${spec?.name}, ${spec?.room}. Loupe over the type; tag off card 7; tag onto the impression that shows it.`;
      }

      function report() {
        const n = heldCount();
        if (attribution === 'imperial-66' && n === MACHINES.length) {
          if (solvedOnce) return;
          solvedOnce = true;
          ctx.note('Four albums, mounted and dated, and the orphan sheet has a room to live in.');
          ctx.feedback('good');
          ctx.solve();
          return;
        }
        if (n === MACHINES.length) {
          ctx.note('All four albums hold. The fifth sheet is not signed, dated or accessioned, and it was struck somewhere in this building.');
          return;
        }
        ctx.note(
          n === 0
            ? 'Four machines, four sheets. Characterise before you compare.'
            : `${wordFor(n)} of the four albums hold.`,
        );
      }

      // Add the shared description node once — screen readers reference it
      // from any pinned glyph.
      const pinnedNote = h('span', 'sr-only', 'A defect tag is pinned to this impression.', {
        id: 'sx-tw-pinned',
      });
      wrap.appendChild(pinnedNote);

      redraw();
      report();

      // A previously mounted album should show the loupe somewhere useful
      // rather than sitting cold in a corner.
      bin.after(reduced() ? 0 : 240, () => {
        const first = glyphEls.find((c) => c.dataset.i);
        if (first) aimLoupeAt(first);
      });
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// 2 · puz-bottom-shelf — "Bottom Shelf"
// ===========================================================================
//
// Twenty-three forty, four inches of water, a torch on its last cell, and no
// deduction in the room at all — only triage. The design is explicit that the
// water is the timer and that no timer is drawn, so nothing on this stage
// counts down; it simply gets wetter, and the shelf sags in the middle, which
// is why the boxes in the middle go first.
//
// Then the second half, which is the actual point: forty feet of galvanised
// duct, two women who cannot be told apart, and a transcription discipline
// that costs the player the satisfaction of writing down a name.

interface ShelfBox {
  id: string;
  /** Stencilled shelf-mark, in two lines, legible only inside the cone. */
  series: string;
  number: string;
  /** Front rank or back rank of a shelf two boxes deep. */
  rank: 0 | 1;
  slot: number;
  /** Position across the shelf, 0..1, used for the sag curve. */
  x: number;
  /** Height above the flood, 0..1. The sag decides this, not the player. */
  head: number;
  /** Seconds from the start of the flood until this one is standing in it. */
  drownAt: number;
  filmed: boolean;
  japanned?: boolean;
  label: string;
}

/** Six seconds to look before it starts coming under the door. */
const FLOOD_GRACE = 6;
/** From the first inch to the top of the bottom shelf. */
const FLOOD_SPAN = 54;
/** How long it takes to get two stone of records over your head, in the dark. */
const LIFT_HOLD = 2000;
/** Wading back for the next one. She is not a machine and it is November. */
const LIFT_CARRY = 1250;

function buildShelf(): ShelfBox[] {
  const marks: { series: string; number: string; filmed: boolean; label: string }[] = [];
  for (let i = 1; i <= 8; i++) {
    marks.push({
      series: '14/B',
      number: String(i),
      filmed: false,
      label: `Series 14/B, box ${i}`,
    });
  }
  marks.push({ series: '14/B', number: '17', filmed: false, label: 'Series 14/B, box 17' });
  for (const n of ['2', '5', '9', '12', '14']) {
    marks.push({ series: '1/A', number: n, filmed: true, label: `Series 1/A, box ${n}` });
  }
  for (const n of ['1', '3', '6', '8', '11']) {
    marks.push({ series: '2/C', number: n, filmed: true, label: `Series 2/C, box ${n}` });
  }
  for (const n of ['4', '7', '9', '13']) {
    marks.push({ series: '9/E', number: n, filmed: true, label: `Series 9/E, box ${n}` });
  }

  // A fixed shuffle. The shelf a player left last night is the shelf they come
  // back to, which matters when the save resumes mid-flood.
  const rng = seeded(0x14b17);
  const order = marks.map((m, i) => ({ m, k: rng(), i }));
  order.sort((a, b) => a.k - b.k || a.i - b.i);

  const PER_RANK = 12;
  const boxes: ShelfBox[] = order.map(({ m }, n) => {
    const rank: 0 | 1 = n < PER_RANK ? 0 : 1;
    const slot = n % PER_RANK;
    const x = (slot + 0.5) / PER_RANK;
    // The shelf board has carried a ton of paper since 1946 and it sags. Head
    // room is lowest at the centre of the span and best at the bearers.
    const sag = Math.abs(x - 0.5) * 2;
    const head = clamp(sag * 0.42 + (rank === 1 ? 0.3 : 0) + 0.03, 0, 1);
    return {
      id: `${m.series}/${m.number}`.replace(/\//g, '-').toLowerCase(),
      series: m.series,
      number: m.number,
      rank,
      slot,
      x,
      head,
      drownAt: FLOOD_GRACE + FLOOD_SPAN * head,
      filmed: m.filmed,
      label: m.label,
    };
  });

  // The deed box is not in the shuffle. It is at the back of the bottom shelf,
  // in the corner, two inches proud of everything else, and it is the only
  // object in the room nobody has ever accessioned.
  boxes.push({
    id: 'deed-box',
    series: 'A. FERRIER',
    number: 'WARDEN',
    rank: 1,
    slot: 11,
    x: 0.97,
    head: 0.95,
    drownAt: FLOOD_GRACE + FLOOD_SPAN * 0.95,
    filmed: false,
    japanned: true,
    label: 'A japanned deed box, stencilled A. FERRIER, WARDEN',
  });

  return boxes;
}

interface Fragment {
  id: string;
  /** Word by word, with what actually arrives through forty feet of duct. */
  words: { text: string; heard: boolean; syl: number }[];
  /** Which of the two voices. Never told to the player; only to the synth. */
  f0: number;
}

/** Build a fragment from a marked-up line: `~word` never makes it through. */
function fragment(id: string, f0: number, line: string): Fragment {
  return {
    id,
    f0,
    words: line.split(/\s+/).map((raw) => {
      const heard = !raw.startsWith('~');
      const text = heard ? raw : raw.slice(1);
      const syl = Math.max(1, Math.ceil(text.replace(/[^aeiouy]/gi, '').length * 0.8));
      return { text, heard, syl };
    }),
  };
}

const FRAGMENTS: Fragment[] = [
  fragment('f1', 196, 'forty-seven of them, ~and ~I ~did ~it with my own hands'),
  fragment('f2', 231, 'he was in the chair, ~he ~could ~not hold a pen, ~you ~know ~that better than anybody'),
  fragment('f3', 231, 'you were never ~even there, ~that ~is ~the ~whole ~of ~it, you were never there'),
];

/** The speaker field. Named options, and the honest one. */
const SPEAKERS: { id: string; name: string; named: boolean }[] = [
  { id: 'a-woman', name: 'A woman', named: false },
  { id: 'sabine-ferrier-kyne', name: 'Sabine Ferrier-Kyne', named: true },
  { id: 'ottoline-verge', name: 'Ottoline Verge', named: true },
  { id: 'enid-charnock', name: 'Enid Charnock', named: true },
  { id: 'rita-tain', name: 'Marguerite Tain', named: true },
];

function bottomShelf(): PuzzleModule {
  const bin = new Bin();
  const tone = new Tone();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const wrap = h('div', 'sx sx-bs');
      root.appendChild(wrap);

      const boxes = buildShelf();
      const byId = new Map(boxes.map((b) => [b.id, b]));

      // -- persisted state --------------------------------------------------
      const saved = new Set(asStrs(ctx.state.saved));
      const wet = new Set(asStrs(ctx.state.wet));
      let elapsed = asNum(ctx.state.elapsed, 0);
      let stageADone = asBool(ctx.state.stageADone);
      const played = new Set(asStrs(ctx.state.played));
      const sureness = asBag(ctx.state.sureness);
      const speakers = asBag(ctx.state.speakers);
      let signed = asBool(ctx.state.signed);

      const persist = () => {
        ctx.state.saved = [...saved];
        ctx.state.wet = [...wet];
        ctx.state.elapsed = elapsed;
        ctx.state.stageADone = stageADone;
        ctx.state.played = [...played];
        ctx.state.sureness = sureness;
        ctx.state.speakers = speakers;
        ctx.state.signed = signed;
        // Read by the Act IV bench and the Act V board: a box left in the
        // water comes back with a tide-line through the passage you need.
        ctx.state.filmedSeriesDrowned = boxes.filter((b) => b.filmed && wet.has(b.id)).length;
        ctx.state.uniqueDrowned = boxes.filter((b) => !b.filmed && wet.has(b.id)).length;
        ctx.state.deedBoxSaved = saved.has('deed-box');
        ctx.state.falseAttribution = FRAGMENTS.some((f) => {
          const sp = SPEAKERS.find((s) => s.id === asStr(speakers[f.id]));
          return !!sp?.named;
        });
        ctx.save();
      };

      const step = h('p', 'sx-step');
      const body = h('div', 'sx-bs-body');
      wrap.append(step, body);

      // =====================================================================
      // STAGE A — the shelf
      // =====================================================================

      const vault = h('div', 'sx-bs-vault', '', {
        role: 'group',
        'aria-label': 'The bottom shelf. Arrow keys move the torch; hold Enter to lift a box.',
      });
      const topShelf = h('div', 'sx-bs-top');
      const shelfRow = h('div', 'sx-bs-shelf');
      const water = h('div', 'sx-bs-water', '', { 'aria-hidden': 'true' });
      const dark = h('div', 'sx-bs-dark', '', { 'aria-hidden': 'true' });
      vault.append(topShelf, shelfRow, water, dark);

      // The two things on the wall that are the whole solution source. Both
      // are legible only inside the cone, which is what makes swinging the
      // torch along the top shelf an act rather than a cutscene.
      const register = h('div', 'sx-bs-stencil is-register');
      register.append(
        h('span', 'sx-bs-stencil-head', 'MICROFILM ACCESSION REGISTER · TWIN VOLUME'),
        h('span', 'sx-bs-stencil-body', 'FILMED 1994 — SERIES 1/A · 2/C · 9/E'),
      );
      const order12 = h('div', 'sx-bs-stencil is-order');
      order12.append(
        h('span', 'sx-bs-stencil-head', 'Standing Order 12'),
        h('span', 'sx-bs-stencil-body', 'IN FLOOD, SAVE BY SERIES, NOT BY SIZE'),
      );
      topShelf.append(register, order12);
      const landed = h('div', 'sx-bs-landed', '', {
        role: 'list',
        'aria-label': 'Boxes lifted to the top shelf',
      });
      topShelf.appendChild(landed);

      const boxEls = new Map<string, HTMLButtonElement>();
      for (const b of boxes) {
        const el = h('button', 'sx-bs-box', '', {
          type: 'button',
          'data-box': b.id,
          'data-rank': String(b.rank),
        });
        el.style.setProperty('--slot', String(b.slot));
        el.style.setProperty('--rank', String(b.rank));
        if (b.japanned) el.classList.add('is-japanned');
        el.append(
          h('span', 'sx-bs-box-face', '', { 'aria-hidden': 'true' }),
          h('span', 'sx-bs-box-series', b.series),
          h('span', 'sx-bs-box-number', b.number),
          h('span', 'sx-bs-box-ring', '', { 'aria-hidden': 'true' }),
          h('span', 'sx-bs-box-tide', '', { 'aria-hidden': 'true' }),
        );
        el.setAttribute('aria-label', b.label);
        boxEls.set(b.id, el);
        shelfRow.appendChild(el);
      }

      // -- the torch ---------------------------------------------------------
      // A cone that shrinks on a battery curve, and a flicker that is not
      // decoration: a torch that is perfectly steady is a spotlight, and a
      // spotlight is not frightening.
      let torch = { x: 0.5, y: 0.62 };
      const setTorch = (x: number, y: number) => {
        torch = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
        vault.style.setProperty('--tx', `${(torch.x * 100).toFixed(2)}%`);
        vault.style.setProperty('--ty', `${(torch.y * 100).toFixed(2)}%`);
      };
      setTorch(torch.x, torch.y);

      vault.addEventListener(
        'pointermove',
        (ev: PointerEvent) => {
          const r = vault.getBoundingClientRect();
          setTorch((ev.clientX - r.left) / (r.width || 1), (ev.clientY - r.top) / (r.height || 1));
        },
        { signal: bin.signal },
      );

      const aimTorchAtBox = (id: string) => {
        const el = boxEls.get(id);
        if (!el) return;
        const v = vault.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        setTorch((b.left + b.width / 2 - v.left) / (v.width || 1), (b.top + b.height / 2 - v.top) / (v.height || 1));
      };

      // -- lifting -----------------------------------------------------------
      let holding: { id: string; started: number } | null = null;
      let carryUntil = 0;

      const beginLift = (id: string) => {
        if (stageADone || holding) return;
        if (performance.now() < carryUntil) {
          ctx.feedback('bad');
          say('Both arms. Wait until this one is up.');
          return;
        }
        const el = boxEls.get(id);
        if (!el || saved.has(id)) return;
        holding = { id, started: performance.now() };
        el.classList.add('is-lifting');
        ctx.feedback('click');
      };

      const endLift = (commit: boolean) => {
        if (!holding) return;
        const { id, started } = holding;
        const el = boxEls.get(id)!;
        holding = null;
        el.classList.remove('is-lifting');
        el.style.removeProperty('--hold');
        if (!commit || performance.now() - started < LIFT_HOLD) {
          ctx.feedback('tick');
          return;
        }
        saved.add(id);
        carryUntil = performance.now() + LIFT_CARRY;
        el.classList.add('is-saved');
        el.setAttribute('aria-disabled', 'true');
        const b = byId.get(id)!;
        const chip = h('span', 'sx-bs-landed-chip', `${b.series} ${b.number}`, { role: 'listitem' });
        if (b.japanned) chip.classList.add('is-japanned');
        landed.appendChild(chip);
        ctx.feedback('good');
        say(
          b.japanned
            ? 'Japanned tin, and heavier than it has any business being for something empty.'
            : b.filmed
              ? `${b.series} ${b.number}, up. That series went to film in 1994.`
              : `${b.series} ${b.number}, up.`,
        );
        persist();
        tally();
      };

      for (const [id, el] of boxEls) {
        el.addEventListener('pointerdown', (ev: PointerEvent) => {
          ev.preventDefault();
          el.setPointerCapture(ev.pointerId);
          beginLift(id);
        }, { signal: bin.signal });
        const up = () => endLift(true);
        el.addEventListener('pointerup', up, { signal: bin.signal });
        el.addEventListener('pointercancel', () => endLift(false), { signal: bin.signal });
        el.addEventListener('lostpointercapture', up, { signal: bin.signal });
        el.addEventListener('focus', () => aimTorchAtBox(id), { signal: bin.signal });
        el.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();
          ev.stopPropagation();
          if (!holding) beginLift(id);
        }, { signal: bin.signal });
        el.addEventListener('keyup', (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();
          endLift(true);
        }, { signal: bin.signal });
        // Clicks are swallowed: the gesture is a two-second hold, and a stray
        // click that did nothing must not read as a control that is broken.
        el.addEventListener('click', (ev: MouseEvent) => ev.preventDefault(), { signal: bin.signal });
      }

      rovingGrid(
        boxes.map((b) => boxEls.get(b.id)!),
        (i) => boxes[i].rank,
      );

      // -- the running line --------------------------------------------------
      const heard = h('p', 'sx-bs-say', '', { role: 'status', 'aria-live': 'polite' });
      const say = (text: string) => {
        heard.textContent = text;
        heard.classList.remove('is-in');
        void heard.offsetWidth;
        heard.classList.add('is-in');
      };

      // =====================================================================
      // STAGE B — the duct
      // =====================================================================

      const duct = h('div', 'sx-bs-duct', '', { hidden: 'hidden' });
      const pad = h('div', 'sx-bs-pad');
      duct.append(
        h('p', 'sx-bs-duct-head', 'Transcript, taken in the dark, 00:12–00:31'),
        pad,
      );

      const fragEls = new Map<string, HTMLElement>();
      let plays = 3 - played.size;

      const replayLabel = (id: string) =>
        played.has(id) ? 'Heard' : plays > 0 ? `Listen (${plays} left)` : 'Gone';

      for (const f of FRAGMENTS) {
        const row = h('div', 'sx-bs-frag', '', { 'data-frag': f.id });
        const line = h('p', 'sx-bs-frag-line');
        const controls = h('div', 'sx-bs-frag-controls');

        const listen = h('button', 'sx-bs-listen', '', { type: 'button' });
        listen.append(
          h('span', 'sx-bs-listen-cone', '', { 'aria-hidden': 'true' }),
          h('span', 'sx-bs-listen-label', ''),
        );
        listen.addEventListener('click', () => play(f), { signal: bin.signal });

        const flags = h('div', 'sx-bs-flags', '', { role: 'radiogroup', 'aria-label': 'Certainty' });
        for (const [val, text] of [['sure', 'Sure'], ['not-certain', 'Not certain']] as const) {
          const b = h('button', 'sx-bs-flag', text, {
            type: 'button',
            role: 'radio',
            'aria-checked': 'false',
            'data-flag': val,
          });
          b.addEventListener('click', () => {
            if (!played.has(f.id)) {
              ctx.feedback('bad');
              say('Nothing to be sure of yet.');
              return;
            }
            sureness[f.id] = val;
            ctx.feedback('click');
            persist();
            drawPad();
            tally();
          }, { signal: bin.signal });
          flags.appendChild(b);
        }

        const who = h('div', 'sx-bs-who', '', { role: 'radiogroup', 'aria-label': 'Speaker' });
        for (const sp of SPEAKERS) {
          const b = h('button', 'sx-bs-whobtn', sp.name, {
            type: 'button',
            role: 'radio',
            'aria-checked': 'false',
            'data-speaker': sp.id,
          });
          b.addEventListener('click', () => {
            if (!played.has(f.id)) {
              ctx.feedback('bad');
              say('Nothing to attribute yet.');
              return;
            }
            speakers[f.id] = sp.id;
            ctx.feedback(sp.named ? 'tick' : 'click');
            if (sp.named) {
              say('She writes the name, and looks at it, and does not cross it out. Yet.');
            }
            persist();
            drawPad();
            tally();
          }, { signal: bin.signal });
          who.appendChild(b);
        }

        controls.append(listen, flags, who);
        row.append(line, controls);
        fragEls.set(f.id, row);
        pad.appendChild(row);
      }

      const signLever = makeLever(
        'Enter in the casebook',
        'In her own hand, with the gaps left in',
        () => sign(),
        ctx.feedback,
      );
      duct.appendChild(signLever);

      function drawPad() {
        for (const f of FRAGMENTS) {
          const row = fragEls.get(f.id)!;
          const line = row.querySelector('.sx-bs-frag-line')!;
          line.textContent = '';
          const hasPlayed = played.has(f.id);
          for (const w of f.words) {
            if (hasPlayed && w.heard) {
              line.appendChild(h('span', 'sx-bs-word', w.text));
            } else {
              line.appendChild(
                h('span', 'sx-bs-gap', '—'.repeat(Math.max(2, Math.ceil(w.text.length / 2))), {
                  'aria-label': 'inaudible',
                }),
              );
            }
            line.appendChild(document.createTextNode(' '));
          }
          const listen = row.querySelector<HTMLButtonElement>('.sx-bs-listen')!;
          listen.querySelector('.sx-bs-listen-label')!.textContent = replayLabel(f.id);
          listen.setAttribute('aria-disabled', String(hasPlayed || plays <= 0));
          listen.classList.toggle('is-spent', hasPlayed || plays <= 0);

          for (const b of row.querySelectorAll<HTMLElement>('.sx-bs-flag')) {
            const on = asStr(sureness[f.id]) === b.dataset.flag;
            b.setAttribute('aria-checked', String(on));
            b.classList.toggle('is-on', on);
          }
          for (const b of row.querySelectorAll<HTMLElement>('.sx-bs-whobtn')) {
            const on = asStr(speakers[f.id]) === b.dataset.speaker;
            b.setAttribute('aria-checked', String(on));
            b.classList.toggle('is-on', on);
            b.classList.toggle(
              'is-named',
              on && !!SPEAKERS.find((s) => s.id === b.dataset.speaker)?.named,
            );
          }
          row.dataset.done = String(hasPlayed && !!sureness[f.id] && !!speakers[f.id]);
        }
        armLever(signLever, readyToSign());
      }

      const readyToSign = () =>
        FRAGMENTS.every((f) => played.has(f.id) && !!sureness[f.id] && !!speakers[f.id]);

      // -- the voices --------------------------------------------------------
      let stopBed: (() => void) | null = null;

      function play(f: Fragment) {
        if (played.has(f.id)) {
          ctx.feedback('bad');
          say('The same nothing, again. It does not improve.');
          return;
        }
        if (plays <= 0) {
          ctx.feedback('bad');
          say('They have stopped. Whatever else was said was said quietly.');
          return;
        }
        plays -= 1;
        played.add(f.id);
        ctx.feedback('click');
        persist();

        const c = tone.open();
        if (c) {
          const line = tone.telephone();
          if (line) {
            if (!stopBed) {
              const bedCh = tone.channel(0.5);
              if (bedCh) stopBed = tone.bed(bedCh, 260, 0.28);
            }
            let t = c.currentTime + 0.15;
            for (const w of f.words) {
              // The gate the whole mechanic turns on. A word that gets through
              // the duct is a word she may write down; the rest is a shape.
              t = tone.speak(t, line, Array.from({ length: w.syl }, () => 0.16 + Math.random() * 0.07), {
                f0: f.f0,
                clarity: w.heard ? 0.86 : 0.12,
                level: w.heard ? 1 : 0.7,
              });
              t += 0.07;
            }
            bin.after(Math.ceil((t - c.currentTime) * 1000) + 900, () => {
              stopBed?.();
              stopBed = null;
            });
          }
        }

        say('She writes what arrives and leaves the rest as rule.');
        drawPad();
        tally();
      }

      function sign() {
        if (!readyToSign()) {
          ctx.feedback('bad');
          say('Three fragments. Each one flagged, each one with a speaker field filled, or it is not a transcript.');
          return;
        }
        signed = true;
        persist();
        const named = FRAGMENTS.filter((f) => SPEAKERS.find((s) => s.id === asStr(speakers[f.id]))?.named);
        ctx.feedback('good');
        say(
          named.length === 0
            ? 'Three fragments, none attributed. A woman, and a woman. Which is all she can hold up to a window.'
            : `${wordFor(named.length)} attributed by name, on a recollection taken in the dark, in four inches of water. Somebody will ask her how she knows.`,
        );
        ctx.note(
          named.length === 0
            ? 'Signed, with the gaps left in it.'
            : 'Signed. A name in the speaker column that the paper does not carry.',
        );
        ctx.solve();
      }

      // =====================================================================
      // Staging and the flood clock
      // =====================================================================

      const goStageB = () => {
        stageADone = true;
        persist();
        wrap.dataset.stage = 'b';
        vault.hidden = true;
        duct.hidden = false;
        step.textContent =
          'Forty feet of galvanised duct up to the Wardens’ Hall landing, and two women who will not lower their voices. Three passes at it, and no more.';
        drawPad();
        tally();
      };

      const closeStageA = () => {
        if (stageADone) return;
        endLift(false);
        const kept = boxes.filter((b) => saved.has(b.id));
        const uniqueKept = kept.filter((b) => !b.filmed).length;
        say(
          uniqueKept >= 9
            ? 'Ten up, and every one of them the only copy in the world. The filmed series can drown; they exist twice.'
            : `${wordFor(kept.length)} up, and the water has the rest. Some of what is in it exists nowhere else.`,
        );
        const goOn = h('button', 'sx-bs-goon', 'Listen', { type: 'button' });
        goOn.addEventListener('click', () => {
          ctx.feedback('click');
          goStageB();
        }, { signal: bin.signal });
        vault.appendChild(goOn);
        bin.after(reduced() ? 0 : 500, () => goOn.focus({ preventScroll: true }));
      };

      const paintFlood = () => {
        const level = clamp((elapsed - FLOOD_GRACE) / FLOOD_SPAN, 0, 1);
        vault.style.setProperty('--flood', level.toFixed(4));
        // Battery: the cone closes from a room to a shelf-mark over the run.
        const drain = clamp(elapsed / (FLOOD_GRACE + FLOOD_SPAN + 8), 0, 1);
        const radius = lerp(31, 11.5, drain * drain);
        const flick = reduced() ? 1 : 0.94 + Math.sin(elapsed * 11.3) * 0.03 + Math.sin(elapsed * 3.1) * 0.03;
        vault.style.setProperty('--tr', `${(radius * flick).toFixed(2)}cqmin`);
        vault.style.setProperty('--tglow', flick.toFixed(3));
      };

      const tickFlood = (dt: number) => {
        if (stageADone) return;
        elapsed += dt / 1000;

        if (holding) {
          const held = performance.now() - holding.started;
          const el = boxEls.get(holding.id);
          el?.style.setProperty('--hold', clamp(held / LIFT_HOLD, 0, 1).toFixed(3));
          if (held >= LIFT_HOLD) endLift(true);
        }

        let changed = false;
        for (const b of boxes) {
          if (saved.has(b.id) || wet.has(b.id)) continue;
          if (elapsed >= b.drownAt) {
            wet.add(b.id);
            changed = true;
            const el = boxEls.get(b.id)!;
            el.classList.add('is-wet');
            el.setAttribute('aria-disabled', 'true');
            el.setAttribute('aria-label', `${b.label} — standing in the water`);
          }
        }
        if (changed) persist();

        paintFlood();

        if (boxes.every((b) => saved.has(b.id) || wet.has(b.id))) closeStageA();
      };

      // -- the shared progress line -----------------------------------------
      function tally() {
        if (!stageADone) {
          const kept = boxes.filter((b) => saved.has(b.id));
          const unique = kept.filter((b) => !b.filmed).length;
          ctx.note(
            kept.length === 0
              ? 'One: which of these exists anywhere else. Two: nothing else matters.'
              : `${wordFor(kept.length)} on the top shelf. ${wordFor(unique)} of them exist nowhere else.`,
          );
          return;
        }
        const done = FRAGMENTS.filter((f) => played.has(f.id) && sureness[f.id] && speakers[f.id]).length;
        ctx.note(
          done === FRAGMENTS.length
            ? 'Three lines, flagged and attributed. Sign it or change it.'
            : `${wordFor(done)} of the three fragments committed.`,
        );
      }

      // -- assemble ----------------------------------------------------------
      body.append(vault, duct);
      wrap.appendChild(heard);

      // Restore whatever the save knew.
      for (const b of boxes) {
        const el = boxEls.get(b.id)!;
        if (saved.has(b.id)) {
          el.classList.add('is-saved');
          el.setAttribute('aria-disabled', 'true');
          const chip = h('span', 'sx-bs-landed-chip', `${b.series} ${b.number}`, { role: 'listitem' });
          if (b.japanned) chip.classList.add('is-japanned');
          landed.appendChild(chip);
        } else if (wet.has(b.id)) {
          el.classList.add('is-wet');
          el.setAttribute('aria-disabled', 'true');
        }
      }
      paintFlood();

      if (stageADone) {
        wrap.dataset.stage = 'b';
        vault.hidden = true;
        duct.hidden = false;
        step.textContent =
          'Forty feet of galvanised duct up to the Wardens’ Hall landing, and two women who will not lower their voices.';
        drawPad();
        if (signed) {
          // She has already signed it once; the bench is only being reopened.
          say('The transcript is written up. It reads the same as it did at midnight.');
        }
      } else {
        wrap.dataset.stage = 'a';
        step.textContent =
          'Twenty-four boxes and about forty minutes. Hold a box to get it over your head; the water does not wait for you to decide.';
        say('It is coming under the door at the hinge end. Ankle depth, and rising.');
      }
      tally();

      bin.loop((dt) => tickFlood(dt));
      bin.onCleanup(() => {
        stopBed?.();
        tone.close();
      });
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// 3 · puz-deakin-authentication — "Five Steps on the Deakin Letter"
// ===========================================================================
//
// The only puzzle in the game whose reward is worse than its failure state,
// and the only one where the mechanism has to be able to catch the player
// cheating — because the fiction is entirely about a woman who is allowed to
// stamp PASS on step one, and does not.
//
// So: five stations that each yield a determinate physical reading, five
// stamps that must agree with those readings, and a finding line she has to
// choose herself. Stamp a failing step PASS and she reads the form back and
// refuses to sign it, by name, out loud. That refusal is the puzzle.

const LETTER_TEXT: string[] = [
  'Dear Miss Tain,',
  'You asked me to put it in writing and I will, though it is',
  'twenty-three years and I have nothing to gain by it. The',
  'beacon was dark. We all knew it was dark. We were told,',
  'not asked, to say nothing about the light, and we said',
  'nothing, and a good man was blamed for it.',
  'Yours faithfully,',
  'W. Deakin',
];

type StationId = 'raking' | 'chain' | 'fibre' | 'postmark' | 'ribbon';
type Mark = 'pass' | 'fail';

interface Station {
  id: StationId;
  numeral: string;
  name: string;
  brief: string;
  /** What the object actually is, regardless of what anybody stamps. */
  objective: Mark;
}

const STATIONS: Station[] = [
  {
    id: 'raking',
    numeral: 'I',
    name: 'Raking light',
    brief: 'Take the lamp down to a grazing angle and read the watermark; then look the stock up in the gazetteer.',
    objective: 'fail',
  },
  {
    id: 'chain',
    numeral: 'II',
    name: 'Chain lines',
    brief: 'Lay the beta-radiograph sheet over the paper and count the chain lines inside the twenty-five millimetre window.',
    objective: 'pass',
  },
  {
    id: 'fibre',
    numeral: 'III',
    name: 'Fibre, forty power',
    brief: 'Three samples, from three parts of the sheet. The plate names the furnish.',
    objective: 'pass',
  },
  {
    id: 'postmark',
    numeral: 'IV',
    name: 'Postmark',
    brief: 'Read the frank at magnification, then find the office in the gazetteer of sorting offices.',
    objective: 'fail',
  },
  {
    id: 'ribbon',
    numeral: 'V',
    name: 'Ribbon ink',
    brief: 'Overlay the typescript on each of the four office specimens from Act One.',
    objective: 'pass',
  },
];

const ALBUM_STRIPS: { id: string; name: string; verdict: string }[] = [
  { id: 'imperial-66', name: 'Imperial 66', verdict: 'No correspondence. The a’s here are open; the Imperial’s are stopped solid.' },
  { id: 'underwood-5', name: 'Underwood 5', verdict: 'No correspondence. Nothing on this sheet rides above the line.' },
  { id: 'olivetti-32', name: 'Olivetti Lettera 32', verdict: 'No correspondence. No doubling anywhere on the sheet, at any power.' },
  { id: 'remington-noiseless', name: 'Remington Noiseless', verdict: 'No correspondence. The capitals sit level.' },
];

const FIBRE_READINGS: string[] = [
  'Cotton and linen rag, unbleached, well beaten. Consistent with any bond of the last sixty years.',
  'Bleached softwood sulphite, two fifths of the furnish. Ordinary for a sheet of this weight.',
  'No optical brightener under the filter. Nothing in the furnish dates this paper either way.',
];

const STOCK_PAGES: RefPage[] = [
  {
    id: 'a',
    tab: 'A',
    head: 'Gazetteer of British paper stocks — A',
    foot: 'Right-hand column: date of first manufacture, from the mill’s own returns.',
    entries: [
      { id: 'aberlady-laid', head: 'ABERLADY LAID', body: 'Rag laid, blue-white, watermarked with a scallop shell.', tail: '1904' },
      { id: 'ardwell-bond', head: 'ARDWELL BOND', body: 'Wove bond, 24 lb, watermarked ARDWELL BOND in gothic capitals across the second quarter.', tail: 'June 1981' },
      { id: 'avoch-cartridge', head: 'AVOCH CARTRIDGE', body: 'Heavy wove drawing cartridge, unsized.', tail: '1938' },
    ],
  },
  {
    id: 'b-h',
    tab: 'B–H',
    head: 'Gazetteer of British paper stocks — B to H',
    entries: [
      { id: 'brandon', head: 'BRANDON DUPLICATOR', body: 'Thin wove, absorbent, for spirit duplicators.', tail: '1955' },
      { id: 'croy-wove', head: 'CROY WOVE', body: 'Wove bank, 16 lb, no watermark.', tail: '1927' },
      { id: 'glenshira', head: 'GLENSHIRA BANK', body: 'Laid bank, azure, watermarked with a fouled anchor.', tail: '1911' },
      { id: 'hoy-airmail', head: 'HOY AIRMAIL', body: 'Very thin wove, 9 lb, blue-tinted.', tail: '1948' },
    ],
  },
  {
    id: 'i-z',
    tab: 'I–Z',
    head: 'Gazetteer of British paper stocks — I to Z',
    entries: [
      { id: 'keppoch', head: 'KEPPOCH LEDGER', body: 'Heavy laid ledger, ruled feint, watermarked with a crown.', tail: '1899' },
      { id: 'morvern-bond', head: 'MORVERN BOND', body: 'Wove bond, 20 lb, watermarked MORVERN in a lozenge.', tail: '1962' },
      { id: 'sandaig-laid', head: 'SANDAIG LAID', body: 'Rag laid, cream, nine chain lines to the inch.', tail: '1974' },
      { id: 'tarbert', head: 'TARBERT FLIMSY', body: 'Blue-black copying flimsy, 7 lb.', tail: '1930' },
    ],
  },
];

const OFFICE_PAGES: RefPage[] = [
  {
    id: 'a-c',
    tab: 'A–C',
    head: 'Post Office gazetteer of sorting offices — A to C',
    foot: 'An office that has closed cannot strike a frank. There is no discretion in it.',
    entries: [
      { id: 'brannock', head: 'BRANNOCK HEAD', body: 'Sub-office, no sorting duty; mail bagged to Rossport Head.', tail: 'Closed 1971' },
      { id: 'cardew', head: 'CARDEW', body: 'Sorting office, Rossport sub-district. Duty transferred to Cardew Road.', tail: 'Closed 30 September 1972' },
      { id: 'cardew-road', head: 'CARDEW ROAD', body: 'Sorting office, Rossport sub-district. Successor to Cardew.', tail: 'Opened 1 October 1972' },
    ],
  },
  {
    id: 'd-l',
    tab: 'D–L',
    head: 'Post Office gazetteer of sorting offices — D to L',
    entries: [
      { id: 'ivory-sound', head: 'IVORY SOUND MARINE', body: 'Sorting afloat, mail packet duty.', tail: 'Discontinued 1969' },
      { id: 'kilbride', head: 'KILBRIDE', body: 'Sorting office, county duty.', tail: 'Open' },
    ],
  },
  {
    id: 'm-z',
    tab: 'M–Z',
    head: 'Post Office gazetteer of sorting offices — M to Z',
    entries: [
      { id: 'rossport-head', head: 'ROSSPORT HEAD', body: 'Head office of the district. All duty for the sub-district since 1972.', tail: 'Open' },
      { id: 'rossport-quay', head: 'ROSSPORT QUAY', body: 'Sorting office, harbour duty.', tail: 'Closed 1988' },
      { id: 'st-brides', head: 'ST BRIDE’S', body: 'Sub-office with sorting duty, two deliveries.', tail: 'Open' },
    ],
  },
];

const FINDINGS: { id: string; text: string }[] = [
  { id: 'genuine', text: 'Genuine. The letter may be cited as it stands.' },
  { id: 'inconclusive', text: 'Inconclusive. Neither established nor impeached.' },
  { id: 'adverse', text: 'Not genuine. This sheet cannot have existed on 4 March 1975.' },
];

/**
 * The laid sheet carries eighteen chain lines and the beta-radiograph window
 * is half its width, so the window holds nine of them wherever it is laid
 * down — which is the whole reason the reference range of eight to ten means
 * anything, and the reason the window has to be draggable rather than printed.
 */
const CHAIN_LINES = 18;
/** The window's width as a fraction of the sheet. Matches the stylesheet. */
const CHAIN_WINDOW_W = 0.5;
/** Where it starts, before anybody moves it. */
const CHAIN_WINDOW_HOME = 0.22;

function deakinAuthentication(): PuzzleModule {
  const bin = new Bin();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const wrap = h('div', 'sx sx-dk');
      root.appendChild(wrap);

      // -- persisted state --------------------------------------------------
      const readings = asBag(ctx.state.readings);
      const marks = asBag(ctx.state.marks);
      let finding = asStr(ctx.state.finding);
      let fudged = asNum(ctx.state.fudged, 0);
      const tried = new Set(asStrs(readings.ribbonTried));
      const tallied = new Set(asStrs(readings.chainTallied));

      const state = {
        watermark: asBool(readings.watermark),
        stockDated: asBool(readings.stockDated),
        chain: asNum(readings.chain, 0),
        chainRecorded: asBool(readings.chainRecorded),
        fibre: asNum(readings.fibreTaken, 0),
        frank: asBool(readings.frank),
        officeDated: asBool(readings.officeDated),
        adler: asStr(readings.adler),
      };

      const persist = () => {
        ctx.state.readings = {
          watermark: state.watermark,
          stockDated: state.stockDated,
          chain: state.chain,
          chainRecorded: state.chainRecorded,
          fibreTaken: state.fibre,
          frank: state.frank,
          officeDated: state.officeDated,
          adler: state.adler,
          ribbonTried: [...tried],
          chainTallied: [...tallied],
        };
        ctx.state.marks = marks;
        ctx.state.finding = finding;
        ctx.state.fudged = fudged;
        ctx.save();
      };

      const worked = (id: StationId): boolean => {
        switch (id) {
          case 'raking':
            return state.watermark && state.stockDated;
          case 'chain':
            return state.chainRecorded;
          case 'fibre':
            return state.fibre >= 3;
          case 'postmark':
            return state.frank && state.officeDated;
          case 'ribbon':
            return ALBUM_STRIPS.every((s) => tried.has(s.id));
        }
      };

      let active: StationId = 'raking';

      // -- furniture --------------------------------------------------------
      const step = h('p', 'sx-step');
      const body = h('div', 'sx-dk-body');
      const rail = h('div', 'sx-dk-rail', '', { role: 'tablist', 'aria-label': 'The five steps' });
      const bench = h('div', 'sx-dk-bench');
      const report = h('div', 'sx-dk-report');
      body.append(rail, bench, report);
      wrap.append(step, body);

      const readout = h('p', 'sx-dk-read', '', { role: 'status', 'aria-live': 'polite' });
      const said = (text: string) => {
        readout.textContent = text;
        readout.classList.remove('is-in');
        void readout.offsetWidth;
        readout.classList.add('is-in');
      };

      // -- the letter, drawn once and reused by four of the five stations ----
      const drawLetter = (cls: string): HTMLElement => {
        const sheet = h('div', `sx-dk-sheet ${cls}`);
        sheet.append(h('span', 'sx-dk-sheet-date', '4 March 1975'));
        const type = h('div', 'sx-dk-type');
        for (const line of LETTER_TEXT) type.appendChild(h('p', 'sx-dk-typeline', line));
        sheet.appendChild(type);
        return sheet;
      };

      // =====================================================================
      // I — raking light
      // =====================================================================
      const rakePanel = h('div', 'sx-dk-panel', '', { 'data-panel': 'raking' });
      const rakeStage = h('div', 'sx-dk-rake');
      const rakeSheet = drawLetter('is-raked');
      const watermark = h('span', 'sx-dk-watermark', 'ARDWELL BOND', { 'aria-hidden': 'true' });
      rakeSheet.appendChild(watermark);
      const lampArm = h('div', 'sx-dk-lamparm', '', { 'aria-hidden': 'true' });
      lampArm.append(h('span', 'sx-dk-lamp-head'), h('span', 'sx-dk-lamp-beam'));
      rakeStage.append(rakeSheet, lampArm);

      let rakeHeld = 0;
      const rakeSlider = bin.own(
        makeSlider({
          label: 'Lamp arm — degrees above the plane of the sheet',
          min: 0,
          max: 90,
          step: 1,
          value: state.watermark ? 15 : 74,
          length: '100%',
          format: (v) => `${v}°`,
          feedback: ctx.feedback,
          onChange: (v) => paintRake(v),
        }),
      );

      function rakeAlpha(deg: number) {
        // A watermark is a thin place in the sheet. It only shows when the
        // light is nearly along the paper, and it disappears again the moment
        // you lift the lamp — which is exactly why people miss them.
        const t = (deg - 15) / 8;
        return Math.exp(-t * t);
      }

      function paintRake(deg: number) {
        const a = rakeAlpha(deg);
        rakeStage.style.setProperty('--rake', a.toFixed(3));
        rakeStage.style.setProperty('--rake-deg', `${deg}`);
        rakeSheet.style.setProperty('--rake-shear', `${(1 - a) * 0}deg`);
        if (a > 0.82 && !state.watermark) {
          rakeHeld += 1;
          if (rakeHeld > 1) {
            state.watermark = true;
            ctx.feedback('good');
            said('There it is: ARDWELL BOND, gothic capitals across the second quarter. Now go and find out what that is.');
            stockBook.open('a');
            persist();
            paintAll();
          }
        } else if (a <= 0.82) {
          rakeHeld = 0;
        }
      }

      const stockBook = makeRefBook({
        label: 'Conservancy gazetteer of British paper stocks',
        pages: STOCK_PAGES,
        feedback: ctx.feedback,
        onPick: (entry) => {
          if (!state.watermark) {
            said('Read the sheet first. Looking a stock up before you know which stock is how you find the one you wanted.');
            ctx.feedback('bad');
            return;
          }
          if (entry.id !== 'ardwell-bond') {
            said(`${entry.head}, ${entry.tail}. Not the watermark on this sheet.`);
            return;
          }
          state.stockDated = true;
          ctx.feedback('good');
          said('ARDWELL BOND. First manufactured June 1981. The letter is dated the fourth of March 1975.');
          persist();
          paintAll();
        },
      });
      bin.own(stockBook);

      rakePanel.append(
        h('p', 'sx-dk-brief', STATIONS[0].brief),
        rakeStage,
        rakeSlider.el,
        stockBook.el,
      );

      // =====================================================================
      // II — chain lines
      // =====================================================================
      const chainPanel = h('div', 'sx-dk-panel', '', { 'data-panel': 'chain' });
      const chainStage = h('div', 'sx-dk-chainstage');
      const chainSheet = h('div', 'sx-dk-chainsheet', '', {
        role: 'group',
        'aria-label': 'Laid paper against the light. Chain lines, left to right.',
      });
      const chainEls: HTMLButtonElement[] = [];
      for (let i = 0; i < CHAIN_LINES; i++) {
        const line = h('button', 'sx-dk-chain', '', {
          type: 'button',
          'data-chain': String(i),
        });
        line.style.setProperty('--n', String(i));
        line.append(h('span', 'sx-dk-chain-tick', '', { 'aria-hidden': 'true' }));
        line.addEventListener('click', () => tallyChain(i), { signal: bin.signal });
        chainEls.push(line);
        chainSheet.appendChild(line);
      }
      const beta = h('div', 'sx-dk-beta');
      beta.append(
        h('span', 'sx-dk-beta-scale', '25 mm'),
        h('span', 'sx-dk-beta-edge', '', { 'aria-hidden': 'true' }),
      );
      chainStage.append(chainSheet, beta);

      /** The window's left edge as a fraction of the sheet's width. */
      let betaFrac = CHAIN_WINDOW_HOME;

      const readBeta = (px: number) => {
        const w = chainStage.clientWidth || 1;
        betaFrac = clamp(CHAIN_WINDOW_HOME + px / w, 0, 1 - CHAIN_WINDOW_W);
      };

      bin.own(
        makeDraggable(beta, {
          axis: 'x',
          bounds: chainStage,
          label: 'Beta-radiograph reference sheet, 25 mm window',
          feedback: ctx.feedback,
          position: { x: asNum(readings.betaX, 0), y: 0 },
          onMove: (p) => {
            readBeta(p.x);
            paintChain();
          },
          onDrop: (p) => {
            readBeta(p.x);
            // A tally is a count *against the window*. Move the window and the
            // marks that fell outside it stop being part of the count, which
            // is both the honest rule and the one that stops the player
            // sweeping the whole sheet and calling it twenty-five millimetres.
            for (const key of [...tallied]) if (!inWindow(Number(key))) tallied.delete(key);
            const bag = asBag(ctx.state.readings);
            bag.betaX = p.x;
            ctx.state.readings = bag;
            ctx.save();
            paintChain();
          },
        }),
      );
      readBeta(asNum(readings.betaX, 0));

      const chainReadout = h('p', 'sx-dk-tally', '');
      const chainPlate = h('p', 'sx-dk-plate-line',
        'Reference: rag laid from the English mills, 1965 to 1980 — eight to ten chain lines to the twenty-five millimetres.');
      const chainRecord = makeLever('Record the count', 'Onto the report form', () => recordChain(), ctx.feedback);
      const chainClear = h('button', 'sx-dk-minor', 'Start the count again', { type: 'button' });
      chainClear.addEventListener('click', () => {
        tallied.clear();
        state.chainRecorded = false;
        ctx.feedback('tick');
        persist();
        paintAll();
      }, { signal: bin.signal });

      const chainRow = h('div', 'sx-dk-row');
      chainRow.append(chainRecord, chainClear);
      chainPanel.append(
        h('p', 'sx-dk-brief', STATIONS[1].brief),
        chainStage,
        chainReadout,
        chainPlate,
        chainRow,
      );

      function inWindow(i: number) {
        const f = (i + 0.5) / CHAIN_LINES;
        return f >= betaFrac && f <= betaFrac + CHAIN_WINDOW_W;
      }

      /** Just the chain station, for the sixty frames a drag generates. */
      function paintChain() {
        chainEls.forEach((el, i) => {
          const here = inWindow(i);
          el.classList.toggle('is-tallied', tallied.has(String(i)));
          el.classList.toggle('is-inwindow', here);
          el.setAttribute(
            'aria-label',
            `Chain line ${i + 1} of ${CHAIN_LINES}, ${here ? 'inside' : 'outside'} the window` +
              (tallied.has(String(i)) ? ', counted' : ''),
          );
        });
        chainReadout.textContent = state.chainRecorded
          ? `Recorded: ${wordFor(state.chain).toLowerCase()} chain lines to the twenty-five millimetres.`
          : `Counted so far: ${wordFor(tallied.size).toLowerCase()}.`;
        armLever(chainRecord, !state.chainRecorded && tallied.size >= 8);
      }

      function tallyChain(i: number) {
        if (state.chainRecorded) {
          said('The count is recorded. Start it again if you want to do it properly.');
          ctx.feedback('bad');
          return;
        }
        if (!inWindow(i)) {
          ctx.feedback('bad');
          said('Outside the window. A count that is not against the twenty-five millimetres is not a count.');
          return;
        }
        const key = String(i);
        if (tallied.has(key)) tallied.delete(key);
        else tallied.add(key);
        ctx.feedback('tick');
        persist();
        paintAll();
      }

      function recordChain() {
        const n = tallied.size;
        if (n < 8) {
          ctx.feedback('bad');
          said(`${wordFor(n)} counted. That is not a count, that is a guess. Go back along the window.`);
          return;
        }
        state.chain = n;
        state.chainRecorded = true;
        ctx.feedback('good');
        said(`${wordFor(n)} chain lines to the twenty-five millimetres. Inside the reference range, and it proves nothing on its own — which is what a passing step is for.`);
        persist();
        paintAll();
      }

      // =====================================================================
      // III — fibre at forty power
      // =====================================================================
      const fibrePanel = h('div', 'sx-dk-panel', '', { 'data-panel': 'fibre' });
      const fibreStage = h('div', 'sx-dk-fibrestage');
      const fibreSheet = drawLetter('is-fibre');
      const fibreField = h('button', 'sx-dk-fibrefield', '', {
        type: 'button',
        'aria-label': 'Take a fibre sample from the sheet',
      });
      fibreStage.append(fibreSheet, fibreField);
      const fibrePlate = h('ol', 'sx-dk-fibreplate');
      const fibreMarks = h('div', 'sx-dk-fibremarks', '', { 'aria-hidden': 'true' });
      fibreStage.appendChild(fibreMarks);

      const takeSample = (fx: number, fy: number) => {
        if (state.fibre >= 3) {
          said('Three samples is the practice. A fourth is fishing.');
          ctx.feedback('bad');
          return;
        }
        const pin = h('span', 'sx-dk-fibrepin');
        pin.style.left = `${(fx * 100).toFixed(1)}%`;
        pin.style.top = `${(fy * 100).toFixed(1)}%`;
        fibreMarks.appendChild(pin);
        state.fibre += 1;
        ctx.feedback('click');
        said(`Sample ${state.fibre}: ${FIBRE_READINGS[state.fibre - 1]}`);
        persist();
        paintAll();
      };
      fibreField.addEventListener('click', (ev: MouseEvent) => {
        const r = fibreField.getBoundingClientRect();
        takeSample((ev.clientX - r.left) / (r.width || 1), (ev.clientY - r.top) / (r.height || 1));
      }, { signal: bin.signal });
      fibreField.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        ev.stopPropagation();
        // Keyboard sampling walks three sensible places rather than the centre
        // three times, so the pins land where a person would put them.
        const spots: [number, number][] = [[0.24, 0.28], [0.62, 0.55], [0.4, 0.82]];
        const [sx, sy] = spots[Math.min(state.fibre, 2)];
        takeSample(sx, sy);
      }, { signal: bin.signal });

      fibrePanel.append(
        h('p', 'sx-dk-brief', STATIONS[2].brief),
        fibreStage,
        h('p', 'sx-dk-plate-line', 'Conservancy fibre plate, 40x, Herzberg stain.'),
        fibrePlate,
      );

      // =====================================================================
      // IV — postmark
      // =====================================================================
      const frankPanel = h('div', 'sx-dk-panel', '', { 'data-panel': 'postmark' });
      const frankStage = h('div', 'sx-dk-frankstage');
      const frank = h('div', 'sx-dk-frank');
      frank.append(
        h('span', 'sx-dk-frank-ring', '', { 'aria-hidden': 'true' }),
        h('span', 'sx-dk-frank-office', 'CARDEW'),
        h('span', 'sx-dk-frank-date', '4 MR 75'),
        h('span', 'sx-dk-frank-bars', '', { 'aria-hidden': 'true' }),
      );
      frankStage.appendChild(frank);

      const zoomSlider = bin.own(
        makeSlider({
          label: 'Magnification over the frank',
          min: 1,
          max: 6,
          step: 0.5,
          value: state.frank ? 5 : 1,
          length: '100%',
          format: (v) => `${v}×`,
          feedback: ctx.feedback,
          onChange: (v) => paintFrank(v),
        }),
      );

      function paintFrank(z: number) {
        frankStage.style.setProperty('--zoom', z.toFixed(2));
        frankStage.dataset.legible = z >= 4 ? 'yes' : 'no';
        if (z >= 4 && !state.frank) {
          state.frank = true;
          ctx.feedback('good');
          said('CARDEW, and a date of 4 MR 75. Now: was there a Cardew sorting office in March 1975?');
          officeBook.open('a-c');
          persist();
          paintAll();
        }
      }

      const officeBook = makeRefBook({
        label: 'Post Office gazetteer of sorting offices',
        pages: OFFICE_PAGES,
        feedback: ctx.feedback,
        onPick: (entry) => {
          if (!state.frank) {
            said('Read the frank first. You cannot look up an office you have not read.');
            ctx.feedback('bad');
            return;
          }
          if (entry.id !== 'cardew') {
            said(`${entry.head} — ${entry.tail}. Not the office on this cover.`);
            return;
          }
          state.officeDated = true;
          ctx.feedback('good');
          said('Cardew sorting office closed on the thirtieth of September 1972. It struck its last item two and a half years before this letter was written.');
          persist();
          paintAll();
        },
      });
      bin.own(officeBook);

      frankPanel.append(
        h('p', 'sx-dk-brief', STATIONS[3].brief),
        frankStage,
        zoomSlider.el,
        officeBook.el,
      );

      // =====================================================================
      // V — ribbon ink
      // =====================================================================
      const ribbonPanel = h('div', 'sx-dk-panel', '', { 'data-panel': 'ribbon' });
      const ribbonStage = h('div', 'sx-dk-ribbonstage');
      const ribbonSheet = drawLetter('is-ribbon');
      ribbonStage.appendChild(ribbonSheet);
      const stripTray = h('div', 'sx-dk-tray', '', { role: 'group', 'aria-label': 'Specimen strips' });

      const tryStrip = (id: string, name: string, verdict: string) => {
        tried.add(id);
        if (id === 'adler-gabriele') {
          state.adler = 'match';
          ctx.feedback('good');
        } else {
          ctx.feedback('click');
        }
        said(`${name}: ${verdict}`);
        persist();
        paintAll();
      };

      const makeStrip = (id: string, name: string, verdict: string, extra = '') => {
        const strip = h('div', `sx-dk-strip ${extra}`, '', { 'data-strip': id });
        strip.append(
          h('span', 'sx-dk-strip-name', name),
          h('span', 'sx-dk-strip-ink', '', { 'aria-hidden': 'true' }),
        );
        strip.setAttribute('aria-label', `${name} specimen strip. Lay it over the typescript.`);
        const ctl = bin.own(
          makeDraggable(strip, {
            bounds: ribbonPanel,
            label: `${name} specimen strip`,
            feedback: ctx.feedback,
            onDrop: () => {
              const hit = dropTargetUnder(strip, '.sx-dk-sheet.is-ribbon');
              ctl.set({ x: 0, y: 0 }, true);
              if (hit) tryStrip(id, name, verdict);
            },
          }),
        );
        strip.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();
          ev.stopPropagation();
          tryStrip(id, name, verdict);
        }, { signal: bin.signal });
        strip.addEventListener('click', () => {
          if (strip.classList.contains('is-dragging')) return;
          tryStrip(id, name, verdict);
        }, { signal: bin.signal });
        return strip;
      };

      for (const s of ALBUM_STRIPS) stripTray.appendChild(makeStrip(s.id, s.name, s.verdict));

      // The sixth strip. Not a step, not on the form, not signposted anywhere
      // in the game: an Adler Gabriele in a locker in the Lamp Room, which the
      // player will only think of if she has been paying attention to Rita.
      const annexe = h('div', 'sx-dk-annexe', '', { hidden: 'hidden' });
      annexe.append(
        h('p', 'sx-dk-annexe-head', 'There is a typewriter in the boat-woman’s locker in the Lamp Room.'),
        h('p', 'sx-dk-annexe-note', 'Nobody has mentioned it. Nobody has to. It is not one of the five steps and it will not be on the form.'),
      );
      const annexeStrip = makeStrip(
        'adler-gabriele',
        'Adler Gabriele',
        'Correspondence in eleven sorts out of eleven, and the ink is nylon-ribbon ink — not sold for that machine before 1979.',
        'is-annexe',
      );
      annexe.appendChild(annexeStrip);

      ribbonPanel.append(
        h('p', 'sx-dk-brief', STATIONS[4].brief),
        ribbonStage,
        stripTray,
        annexe,
      );

      // =====================================================================
      // The report form
      // =====================================================================
      report.append(
        h('p', 'sx-card-title', 'Report of examination'),
        h('p', 'sx-card-sub', 'Section 41(4). One line per step, in the words you would have used if it had passed.'),
      );

      const rows = new Map<StationId, HTMLElement>();
      for (const st of STATIONS) {
        const row = h('div', 'sx-dk-reportrow', '', { 'data-row': st.id });
        row.append(
          h('span', 'sx-dk-rn', st.numeral),
          h('span', 'sx-dk-rname', st.name),
        );
        const stamps = h('div', 'sx-dk-stamps', '', { role: 'radiogroup', 'aria-label': `${st.name}: verdict` });
        for (const m of ['pass', 'fail'] as Mark[]) {
          const b = h('button', 'sx-dk-stamp', m.toUpperCase(), {
            type: 'button',
            role: 'radio',
            'aria-checked': 'false',
            'data-mark': m,
          });
          b.addEventListener('click', () => {
            marks[st.id] = m;
            ctx.feedback('click');
            persist();
            paintAll();
          }, { signal: bin.signal });
          stamps.appendChild(b);
        }
        row.append(stamps, h('span', 'sx-dk-rstate', ''));
        rows.set(st.id, row);
        report.appendChild(row);
      }

      const annexeLine = h('p', 'sx-dk-annexe-line', '', { hidden: 'hidden' });
      report.appendChild(annexeLine);

      report.appendChild(h('p', 'sx-dk-findhead', 'Finding'));
      const findList = h('div', 'sx-dk-findings', '', { role: 'radiogroup', 'aria-label': 'Finding' });
      for (const f of FINDINGS) {
        const b = h('button', 'sx-dk-finding', f.text, {
          type: 'button',
          role: 'radio',
          'aria-checked': 'false',
          'data-finding': f.id,
        });
        b.addEventListener('click', () => {
          finding = f.id;
          ctx.feedback('tick');
          persist();
          paintAll();
        }, { signal: bin.signal });
        findList.appendChild(b);
      }
      report.appendChild(findList);

      const fileLever = makeLever('Sign and send', 'A. Wren, appraiser under commission', () => file(), ctx.feedback);
      report.appendChild(fileLever);

      // =====================================================================
      // Filing
      // =====================================================================
      function file() {
        const unworked = STATIONS.filter((s) => !worked(s.id));
        if (unworked.length) {
          ctx.feedback('bad');
          said(`Step ${unworked[0].numeral} is not done. Five steps. Doing four is how you get the answer you came in with.`);
          return;
        }
        const unmarked = STATIONS.filter((s) => !marks[s.id]);
        if (unmarked.length) {
          ctx.feedback('bad');
          said(`Step ${unmarked[0].numeral} has no stamp on it.`);
          return;
        }
        const lying = STATIONS.find((s) => marks[s.id] !== s.objective);
        if (lying) {
          fudged += 1;
          persist();
          ctx.feedback('bad');
          // She reads the form back to herself. This is the whole puzzle.
          said(
            lying.id === 'raking'
              ? 'Step one is stamped PASS, and the watermark is a stock first manufactured in June 1981. She reads it twice and puts the pen down.'
              : lying.id === 'postmark'
                ? 'Step four is stamped PASS, and the office struck its last item on the thirtieth of September 1972. She is not going to sign that.'
                : `Step ${lying.numeral} is stamped ${String(marks[lying.id]).toUpperCase()} and that is not what the object says. Do it again.`,
          );
          return;
        }
        if (finding !== 'adverse') {
          ctx.feedback('bad');
          said(
            finding === 'genuine'
              ? 'Two steps failed and the finding says genuine. That is not a finding, it is a wish.'
              : finding === 'inconclusive'
                ? 'Inconclusive is what you write when the paper will not say. This paper says June 1981 and September 1972, twice over, in two independent ways.'
                : 'Choose the finding line.',
          );
          return;
        }
        ctx.state.fudgedAttempts = fudged;
        ctx.state.adlerFound = state.adler === 'match';
        persist();
        ctx.feedback('good');
        ctx.note(
          state.adler === 'match'
            ? 'Filed. Two failed steps on the form and a third tell nobody asked for.'
            : 'Filed, in the same words she would have used if it had passed.',
        );
        ctx.solve();
      }

      // =====================================================================
      // Painting
      // =====================================================================
      const panels: Record<StationId, HTMLElement> = {
        raking: rakePanel,
        chain: chainPanel,
        fibre: fibrePanel,
        postmark: frankPanel,
        ribbon: ribbonPanel,
      };
      for (const p of Object.values(panels)) bench.appendChild(p);
      bench.appendChild(readout);

      const tabs = new Map<StationId, HTMLButtonElement>();
      for (const st of STATIONS) {
        const tab = h('button', 'sx-dk-tab', '', {
          type: 'button',
          role: 'tab',
          'aria-selected': 'false',
          'data-station': st.id,
        });
        tab.append(
          h('span', 'sx-dk-tab-n', st.numeral),
          h('span', 'sx-dk-tab-name', st.name),
          h('span', 'sx-dk-tab-state', '', { 'aria-hidden': 'true' }),
        );
        tab.addEventListener('click', () => {
          active = st.id;
          ctx.feedback('tick');
          paintAll();
        }, { signal: bin.signal });
        tabs.set(st.id, tab);
        rail.appendChild(tab);
      }

      function paintAll() {
        for (const st of STATIONS) {
          const done = worked(st.id);
          const tab = tabs.get(st.id)!;
          tab.classList.toggle('is-open', active === st.id);
          tab.setAttribute('aria-selected', String(active === st.id));
          tab.dataset.done = done ? 'yes' : 'no';
          tab.querySelector('.sx-dk-tab-state')!.textContent = done ? '✓' : '·';
          tab.setAttribute(
            'aria-label',
            `Step ${st.numeral}, ${st.name}. ${done ? 'Worked.' : 'Not yet worked.'}`,
          );
          panels[st.id].hidden = active !== st.id;

          const row = rows.get(st.id)!;
          const mark = asStr(marks[st.id]);
          row.dataset.mark = mark;
          row.dataset.done = done ? 'yes' : 'no';
          for (const b of row.querySelectorAll<HTMLElement>('.sx-dk-stamp')) {
            const on = b.dataset.mark === mark;
            b.setAttribute('aria-checked', String(on));
            b.classList.toggle('is-struck', on);
          }
          row.querySelector('.sx-dk-rstate')!.textContent = done
            ? mark
              ? ''
              : 'worked, unstamped'
            : 'not yet worked';
        }

        // Station-local painting
        paintChain();

        fibrePlate.textContent = '';
        for (let i = 0; i < state.fibre; i++) {
          fibrePlate.appendChild(h('li', 'sx-dk-fibreline', FIBRE_READINGS[i]));
        }
        if (!state.fibre) {
          fibrePlate.appendChild(h('li', 'sx-dk-fibreline is-empty', 'No samples taken.'));
        }

        for (const strip of stripTray.querySelectorAll<HTMLElement>('.sx-dk-strip')) {
          strip.classList.toggle('is-tried', tried.has(strip.dataset.strip ?? ''));
        }
        const annexeReady = ALBUM_STRIPS.every((s) => tried.has(s.id)) && ctx.hasItem('specimen-album');
        annexe.hidden = !annexeReady;
        annexeStrip.classList.toggle('is-tried', tried.has('adler-gabriele'));
        annexeLine.hidden = state.adler !== 'match';
        annexeLine.textContent =
          'Annexe, not one of the five: specimen from an Adler Gabriele, Lamp Room locker, not accessioned. Correspondence in eleven sorts out of eleven; the ribbon is nylon, and nylon was not sold for that machine until 1979.';

        for (const b of findList.querySelectorAll<HTMLElement>('.sx-dk-finding')) {
          const on = b.dataset.finding === finding;
          b.setAttribute('aria-checked', String(on));
          b.classList.toggle('is-on', on);
        }

        const doneCount = STATIONS.filter((s) => worked(s.id)).length;
        armLever(fileLever, doneCount === STATIONS.length && STATIONS.every((s) => !!marks[s.id]) && !!finding);

        const spec = STATIONS.find((s) => s.id === active)!;
        step.textContent = `Step ${spec.numeral} of five — ${spec.name}. Any order; all five.`;

        ctx.note(
          doneCount === STATIONS.length
            ? 'Five steps worked. Stamp them and write the finding line.'
            : `${wordFor(doneCount)} of the five steps worked.`,
        );
      }

      // Restore the visible state of anything the save already knew.
      paintRake(rakeSlider.get());
      paintFrank(zoomSlider.get());
      for (let i = 0; i < state.fibre; i++) {
        const pin = h('span', 'sx-dk-fibrepin');
        pin.style.left = `${[24, 62, 40][i] ?? 50}%`;
        pin.style.top = `${[28, 55, 82][i] ?? 50}%`;
        fibreMarks.appendChild(pin);
      }
      paintAll();
      said('Five steps. Do all five. Doing four is how you get the answer you came in with.');
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// 4 · puz-chart-loft — "Three Flashes"
// ===========================================================================
//
// Two instruments, one argument: *a measurement is not a memory*.
//
// Stage A is a stopwatch on a telephone. Norah Feaver has told the exact truth
// for twenty-four years — three flashes — and the truth has hanged a man,
// because three flashes is not a light. Three flashes and a period is a light,
// and nobody at the Inquiry asked her for the period. The player asks.
//
// Stage B is a light table. Three surveys of the same water, registered not by
// eye and not on the coastline but on the three marks a surveyor put there for
// the purpose. Register them properly and two things fall out, one of which
// nobody was looking for.

/** Chart units to yards. The scale bar on the base sheet says so, in print. */
const YARDS_PER_UNIT = 4;
/** Max residual, in chart units, at which three marks have lain down together. */
const REG_TOL = 6;
/** Below this the sheet is close enough that the pins take it the rest of the way. */
const REG_SNAP = 18;

const CHART_W = 1000;
const CHART_H = 640;
const CHART_CX = CHART_W / 2;
const CHART_CY = CHART_H / 2;

interface TrigMark {
  id: string;
  name: string;
  x: number;
  y: number;
}

const TRIG: TrigMark[] = [
  { id: 'brannock', name: 'Brannock trig pillar', x: 228, y: 132 },
  { id: 'st-brides', name: 'St Bride’s tower', x: 766, y: 108 },
  { id: 'sowens', name: 'Sowens beacon', x: 492, y: 486 },
];

/** The position the 1975 finding puts the Pelagia in, plotted on 1974 buoyage. */
const FINDING_POS = { x: 596, y: 386 };
/** Where the Inquiry's own reconstructed track actually runs. 340 yards east. */
const TRACK_POS = { x: 681, y: 386 };

type LayerId = 'sheet-1948' | 'sheet-1974' | 'sheet-1998';

interface LayerSpec {
  id: LayerId;
  name: string;
  sub: string;
  start: { dx: number; dy: number; rot: number; scale: number };
}

const LAYERS: LayerSpec[] = [
  {
    id: 'sheet-1948',
    name: '1948',
    sub: 'Headland and approach, Admiralty resurvey',
    start: { dx: 62, dy: -38, rot: -6.2, scale: 0.945 },
  },
  {
    id: 'sheet-1974',
    name: '1974',
    sub: 'Buoyage revision, Ivory Sound',
    start: { dx: -55, dy: 44, rot: 4.6, scale: 1.062 },
  },
  {
    id: 'sheet-1998',
    name: '1998',
    sub: 'Condition survey, shore establishment',
    start: { dx: 34, dy: 68, rot: -2.4, scale: 0.982 },
  },
];

const LIGHT_PAGES: RefPage[] = [
  {
    id: 'ivory-sound',
    tab: 'Ivory Sound',
    head: 'Admiralty List of Lights, 1974 — Ivory Sound and the approach',
    foot: 'A characteristic is the group and the period together. Neither half identifies a light.',
    entries: [
      {
        id: 'nine-bells',
        head: 'NINE BELLS (Brannock Head)',
        body: 'White granite tower, 112 ft. Range 18 M. Established 1811.',
        tail: 'Fl(3) W 20s',
      },
      {
        id: 'cadran-point',
        head: 'CADRAN POINT',
        body: 'White round tower, 61 ft. Range 12 M. Nine miles SSE of Brannock Head. Characteristic unaltered since 1911.',
        tail: 'Fl(3) W 15s',
      },
      {
        id: 'sowens-beacon',
        head: 'SOWENS BEACON',
        body: 'Isolated danger mark on the shoal, 22 ft. Unwatched.',
        tail: 'Q(6)+LFl W 15s',
      },
    ],
  },
  {
    id: 'harbour',
    tab: 'Rossport',
    head: 'Admiralty List of Lights, 1974 — Rossport Harbour and the bar',
    entries: [
      { id: 'pier-head', head: 'ROSSPORT PIER HEAD', body: 'Green post, 14 ft.', tail: 'Fl G 3s' },
      { id: 'st-brides-ldg', head: 'ST BRIDE’S LEADING LIGHTS', body: 'In line 041°.', tail: 'F R (2)' },
      { id: 'kilbride-spit', head: 'KILBRIDE SPIT BUOY', body: 'Port hand, can, topmark.', tail: 'Fl(2) R 10s' },
    ],
  },
];

/** The base sheet: the chart everything else is laid over. */
function baseChartMarkup(): string {
  const trig = TRIG.map(
    (m) => `
      <g class="cl-trig" transform="translate(${m.x} ${m.y})">
        <path d="M 0 -11 L 9.5 6 L -9.5 6 Z" />
        <circle cx="0" cy="0" r="2.4" />
        <text x="13" y="5">${m.name}</text>
      </g>`,
  ).join('');
  return `
    <rect class="cl-sea" x="0" y="0" width="${CHART_W}" height="${CHART_H}" />
    <path class="cl-land" d="M 0 0 H ${CHART_W} V 176 C 902 200 848 168 790 182
      C 720 199 690 250 620 244 C 556 239 528 196 470 200
      C 430 203 404 226 372 224 L 372 268 L 300 268 L 300 222
      C 250 214 196 246 140 236 C 92 227 46 244 0 238 Z" />
    <path class="cl-shoal" d="M 400 470 C 430 436 566 432 596 470 C 618 498 560 528 496 528
      C 434 528 380 502 400 470 Z" />
    <text class="cl-note" x="470" y="504">Sowens Shoal</text>
    <path class="cl-contour" d="M 40 340 C 220 306 360 356 520 340 C 690 322 830 366 980 344" />
    <path class="cl-contour" d="M 40 418 C 230 388 380 432 540 414 C 700 396 840 436 980 414" />
    <text class="cl-sound" x="150" y="336">14</text>
    <text class="cl-sound" x="640" y="330">17</text>
    <text class="cl-sound" x="300" y="414">23</text>
    <text class="cl-sound" x="800" y="410">26</text>
    <text class="cl-title" x="28" y="612">IVORY SOUND · BASE SHEET · trig marks as fixed</text>
    <g class="cl-scale" transform="translate(720 590)">
      <rect x="0" y="-6" width="125" height="6" />
      <rect x="0" y="-6" width="25" height="6" class="cl-scale-alt" />
      <rect x="50" y="-6" width="25" height="6" class="cl-scale-alt" />
      <rect x="100" y="-6" width="25" height="6" class="cl-scale-alt" />
      <text x="0" y="18">0</text>
      <text x="118" y="18">500 YARDS</text>
    </g>
    ${trig}`;
}

/** The three trig marks, printed on every sheet because the surveyor put them there. */
function trigMarkup(): string {
  return TRIG.map(
    (m) => `
      <g class="cl-lmark" transform="translate(${m.x} ${m.y})">
        <circle cx="0" cy="0" r="9" />
        <path d="M -13 0 H 13 M 0 -13 V 13" />
      </g>`,
  ).join('');
}

function layerMarkup(id: LayerId): string {
  if (id === 'sheet-1948') {
    return `
      ${trigMarkup()}
      <path class="cl-oldcoast" d="M 0 12 H ${CHART_W} V 188 C 900 210 846 180 788 194
        C 718 210 688 260 618 254 C 554 249 526 208 468 212
        C 428 215 402 236 370 234 L 370 276 L 298 276 L 298 232
        C 248 224 194 256 138 246 C 90 238 44 254 0 248 Z" />
      <path class="cl-track" d="M 900 236 C 812 292 748 340 ${TRACK_POS.x} ${TRACK_POS.y}
        C 630 424 566 470 470 512" />
      <g class="cl-fix" transform="translate(${TRACK_POS.x} ${TRACK_POS.y})">
        <circle cx="0" cy="0" r="6" />
        <path d="M -11 -11 L 11 11 M 11 -11 L -11 11" />
        <text x="12" y="-10">Track as reconstructed, Inquiry 1975</text>
      </g>
      <g class="cl-inset" transform="translate(40 34)">
        <rect class="cl-inset-frame" x="0" y="0" width="272" height="196" />
        <text class="cl-inset-title" x="10" y="18">INSET · SHORE ESTABLISHMENT · 1:500</text>
        <rect class="cl-building" x="26" y="34" width="216" height="140" />
        <path class="cl-wall" d="M 26 82 H 242 M 128 82 V 174" />
        <text class="cl-inset-note" x="34" y="60">UNDERCROFT</text>
        <rect class="cl-chamber" x="34" y="96" width="72" height="44" />
        <text class="cl-inset-note" x="38" y="122">20' × 12'</text>
        <text class="cl-inset-note" x="150" y="122">STRONGROOM</text>
      </g>`;
  }
  if (id === 'sheet-1974') {
    return `
      ${trigMarkup()}
      <path class="cl-channel" d="M 950 250 C 850 300 760 352 660 392 C 566 430 500 468 430 520" />
      <path class="cl-channel is-edge" d="M 962 292 C 862 342 772 394 672 434 C 578 472 512 510 442 562" />
      <path class="cl-channel is-edge" d="M 938 208 C 838 258 748 310 648 350 C 554 388 488 426 418 478" />
      <g class="cl-buoy" transform="translate(742 330)"><circle r="6"/><path d="M 0 -14 V -6"/><text x="10" y="4">No. 3 Fl(2)R</text></g>
      <g class="cl-buoy" transform="translate(560 428)"><circle r="6"/><path d="M 0 -14 V -6"/><text x="10" y="4">No. 5 Fl(2)R</text></g>
      <g class="cl-fix is-finding" transform="translate(${FINDING_POS.x} ${FINDING_POS.y})">
        <circle cx="0" cy="0" r="6" />
        <path d="M -14 0 H 14 M 0 -14 V 14" />
        <text x="-8" y="26" text-anchor="end">Position as found, para. 51</text>
      </g>
      <text class="cl-title" x="28" y="612">BUOYAGE REVISION 1974 · IVORY SOUND</text>`;
  }
  return `
    ${trigMarkup()}
    <path class="cl-newcoast" d="M 0 6 H ${CHART_W} V 182 C 898 204 844 174 786 188
      C 716 204 686 254 616 248 C 552 243 524 202 466 206
      C 426 209 400 230 368 228 L 368 270 L 296 270 L 296 226
      C 246 218 192 250 136 240 C 88 232 42 248 0 242 Z" />
    <g class="cl-inset" transform="translate(40 34)">
      <rect x="0" y="0" width="272" height="196" />
      <text class="cl-inset-title" x="10" y="18">INSET · SHORE ESTABLISHMENT · 1:500 · 1998</text>
      <rect class="cl-building" x="26" y="34" width="216" height="140" />
      <path class="cl-wall" d="M 26 82 H 242 M 128 82 V 174" />
      <text class="cl-inset-note" x="34" y="60">UNDERCROFT</text>
      <rect class="cl-solid" x="34" y="96" width="72" height="44" />
      <text class="cl-inset-note" x="40" y="158">SOLID</text>
      <text class="cl-inset-note" x="150" y="122">STRONGROOM</text>
    </g>
    <text class="cl-title" x="28" y="612">CONDITION SURVEY 1998</text>`;
}

interface LayerPose {
  dx: number;
  dy: number;
  rot: number;
  scale: number;
}

/** Where a point on a posed sheet actually lands, in chart units. */
function posedPoint(p: { x: number; y: number }, pose: LayerPose): { x: number; y: number } {
  const a = (pose.rot * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const ox = (p.x - CHART_CX) * pose.scale;
  const oy = (p.y - CHART_CY) * pose.scale;
  return {
    x: CHART_CX + ox * cos - oy * sin + pose.dx,
    y: CHART_CY + ox * sin + oy * cos + pose.dy,
  };
}

/** The worst of the three marks, in chart units. */
function residuals(pose: LayerPose): number[] {
  return TRIG.map((m) => {
    const p = posedPoint(m, pose);
    return Math.hypot(p.x - m.x, p.y - m.y);
  });
}

function chartLoft(): PuzzleModule {
  const bin = new Bin();
  const tone = new Tone();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const wrap = h('div', 'sx sx-cl');
      root.appendChild(wrap);

      // -- persisted state --------------------------------------------------
      let lightId = asStr(ctx.state.lightId);
      let measured = asBag(ctx.state.measured);
      let stage: 'a' | 'b' = lightId === 'cadran-point' ? 'b' : 'a';
      const poses = new Map<LayerId, LayerPose>();
      const savedPoses = asBag(ctx.state.poses);
      for (const spec of LAYERS) {
        const rec = asBag(savedPoses[spec.id]);
        poses.set(spec.id, {
          dx: asNum(rec.dx, spec.start.dx),
          dy: asNum(rec.dy, spec.start.dy),
          rot: asNum(rec.rot, spec.start.rot),
          scale: asNum(rec.scale, spec.start.scale),
        });
      }
      let readingOffset = asBool(ctx.state.readingOffset);
      let readingChamber = asBool(ctx.state.readingChamber);

      const persist = () => {
        ctx.state.lightId = lightId;
        ctx.state.measured = measured;
        const bag: Record<string, unknown> = {};
        for (const [id, p] of poses) bag[id] = { ...p };
        ctx.state.poses = bag;
        ctx.state.readingOffset = readingOffset;
        ctx.state.readingChamber = readingChamber;
        ctx.save();
      };

      const step = h('p', 'sx-step');
      const body = h('div', 'sx-cl-body');
      const readout = h('p', 'sx-cl-read', '', { role: 'status', 'aria-live': 'polite' });
      wrap.append(step, body, readout);
      const said = (text: string) => {
        readout.textContent = text;
        readout.classList.remove('is-in');
        void readout.offsetWidth;
        readout.classList.add('is-in');
      };

      // =====================================================================
      // STAGE A — the Rossport call box
      // =====================================================================
      const callbox = h('div', 'sx-cl-callbox');

      const set = h('div', 'sx-cl-set');
      set.append(
        h('span', 'sx-cl-set-body', '', { 'aria-hidden': 'true' }),
        h('span', 'sx-cl-set-bell', '', { 'aria-hidden': 'true' }),
        h('span', 'sx-cl-set-plate', 'ROSSPORT 2 · PRESS BUTTON A'),
      );
      const line = h('span', 'sx-cl-line', '', { 'aria-hidden': 'true' });
      set.appendChild(line);

      const ring = h('button', 'sx-cl-ring', '', { type: 'button' });
      ring.append(
        h('span', 'sx-cl-ring-face', 'A', { 'aria-hidden': 'true' }),
        h('span', 'sx-cl-ring-label', 'Ask her to tap it'),
      );

      const watch = h('div', 'sx-cl-watch');
      const plunger = h('button', 'sx-cl-plunger', '', {
        type: 'button',
        'aria-label': 'Stopwatch plunger. Press on every flash she taps.',
      });
      plunger.append(
        h('span', 'sx-cl-plunger-cap', '', { 'aria-hidden': 'true' }),
        h('span', 'sx-cl-plunger-stem', '', { 'aria-hidden': 'true' }),
      );
      const tape = h('div', 'sx-cl-tape', '', { 'aria-hidden': 'true' });
      const dials = h('div', 'sx-cl-dials');
      const dialGroup = h('div', 'sx-cl-dial');
      dialGroup.append(h('span', 'sx-cl-dial-cap', 'Flashes in the group'), h('span', 'sx-cl-dial-val', '—'));
      const dialPeriod = h('div', 'sx-cl-dial');
      dialPeriod.append(h('span', 'sx-cl-dial-cap', 'Period'), h('span', 'sx-cl-dial-val', '—'));
      dials.append(dialGroup, dialPeriod);
      const rewind = h('button', 'sx-dk-minor', 'Rewind the watch', { type: 'button' });
      watch.append(plunger, tape, dials, rewind);

      const visible = h('div', 'sx-cl-visible');
      const visLamp = h('span', 'sx-cl-vislamp', '', { 'aria-hidden': 'true' });
      const visToggle = h('button', 'sx-cl-vistoggle', 'Show the transients', {
        type: 'button',
        role: 'switch',
        'aria-checked': 'false',
      });
      visible.append(visToggle, visLamp);

      const chip = h('div', 'sx-cl-chip', '', { hidden: 'hidden' });
      chip.append(
        h('span', 'sx-cl-chip-head', 'Measured characteristic'),
        h('span', 'sx-cl-chip-val', '—'),
      );

      const listBook = makeRefBook({
        label: 'Admiralty List of Lights, 1974',
        pages: LIGHT_PAGES,
        feedback: ctx.feedback,
        onPick: (entry) => matchLight(entry.id),
      });
      bin.own(listBook);

      const boxLeft = h('div', 'sx-cl-boxleft');
      boxLeft.append(set, ring, watch, visible);
      const boxRight = h('div', 'sx-cl-boxright');
      boxRight.append(chip, listBook.el);
      callbox.append(boxLeft, boxRight);

      // -- the call ----------------------------------------------------------
      /** Flash times inside one group, and the period she is actually keeping. */
      const GROUP = [0, 2, 4];
      const PERIOD = 15;
      const GROUPS = 6;

      let callStart = 0;
      let scheduled: number[] = [];
      let clicks: number[] = [];
      let calling = false;
      let showTransients = false;
      let nextFlash = 0;

      const clock = () => tone.now();

      const startCall = () => {
        if (calling) {
          stopCall('She has put it down. Ring again if you need it again.');
          return;
        }
        const c = tone.open();
        calling = true;
        clicks = [];
        scheduled = [];
        nextFlash = 0;
        callStart = clock() + 1.4;
        for (let g = 0; g < GROUPS; g++) {
          for (const f of GROUP) scheduled.push(callStart + g * PERIOD + f);
        }
        if (c) {
          const wire = tone.telephone();
          if (wire) {
            const hiss = tone.channel(0.28);
            if (hiss) stopHiss = tone.bed(hiss, 2600, 0.05);
            for (const t of scheduled) tone.tap(t, wire, 1);
          }
        }
        ring.classList.add('is-live');
        ring.querySelector('.sx-cl-ring-label')!.textContent = 'Hang up';
        line.classList.add('is-live');
        ctx.feedback('click');
        said('‘Right you are. It was like this — and then a wait, and then the same again. I can still do it.’');
        drawTape();
      };

      let stopHiss: (() => void) | null = null;

      const stopCall = (why: string) => {
        calling = false;
        scheduled = [];
        tone.stopAll();
        stopHiss?.();
        stopHiss = null;
        ring.classList.remove('is-live');
        ring.querySelector('.sx-cl-ring-label')!.textContent = 'Ask her to tap it';
        line.classList.remove('is-live');
        visLamp.classList.remove('is-on');
        said(why);
      };

      ring.addEventListener('click', startCall, { signal: bin.signal });

      const press = () => {
        if (!calling) {
          ctx.feedback('bad');
          said('The line is down. Ring her first, and then count what she gives you.');
          return;
        }
        clicks.push(clock());
        plunger.classList.remove('is-struck');
        void plunger.offsetWidth;
        plunger.classList.add('is-struck');
        ctx.feedback('tick');
        drawTape();
        evaluate();
      };
      plunger.addEventListener('click', press, { signal: bin.signal });

      rewind.addEventListener('click', () => {
        clicks = [];
        ctx.feedback('tick');
        drawTape();
        evaluate();
        said('Watch rewound. Nothing lost but the counting.');
      }, { signal: bin.signal });

      visToggle.addEventListener('click', () => {
        showTransients = !showTransients;
        visToggle.setAttribute('aria-checked', String(showTransients));
        visToggle.classList.toggle('is-on', showTransients);
        ctx.feedback('tick');
      }, { signal: bin.signal });

      function drawTape() {
        tape.textContent = '';
        if (!clicks.length) {
          tape.appendChild(h('span', 'sx-cl-tape-empty', 'no marks on the tape'));
          return;
        }
        const t0 = clicks[0];
        const span = Math.max(20, clicks[clicks.length - 1] - t0 + 4);
        for (const t of clicks) {
          const mark = h('span', 'sx-cl-tape-mark');
          mark.style.left = `${(((t - t0) / span) * 100).toFixed(2)}%`;
          tape.appendChild(mark);
        }
      }

      /**
       * Splits the tape into groups and derives the characteristic.
       *
       * The last group is discarded because it may still be running — which is
       * also why a single group is not enough: one group has no period in it,
       * and a period is the half of the answer that matters.
       */
      function evaluate() {
        const groups: number[][] = [];
        for (const t of clicks) {
          const last = groups[groups.length - 1];
          if (!last || t - last[last.length - 1] > 5) groups.push([t]);
          else last.push(t);
        }
        const complete = groups.slice(0, -1);
        const starts = groups.map((g) => g[0]);

        let count = 0;
        if (complete.length) {
          const tallyBySize = new Map<number, number>();
          for (const g of complete) tallyBySize.set(g.length, (tallyBySize.get(g.length) ?? 0) + 1);
          count = [...tallyBySize.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
        }

        let period = 0;
        if (starts.length >= 2) {
          let sum = 0;
          for (let i = 1; i < starts.length; i++) sum += starts[i] - starts[i - 1];
          period = sum / (starts.length - 1);
        }

        dialGroup.querySelector('.sx-cl-dial-val')!.textContent = count ? String(count) : '—';
        dialPeriod.querySelector('.sx-cl-dial-val')!.textContent = period
          ? `${period.toFixed(1)} s`
          : '—';

        const good = count === 3 && Math.abs(period - PERIOD) <= 1.2;
        chip.hidden = !good;
        if (!good) {
          chip.classList.remove('is-good');
          return;
        }
        const value = `Fl(3) W ${Math.round(period)}s`;
        chip.querySelector('.sx-cl-chip-val')!.textContent = value;
        if (!chip.classList.contains('is-good')) {
          chip.classList.add('is-good');
          ctx.feedback('good');
          said(
            `Three flashes, ${period.toFixed(1)} seconds between the first of one group and the first of the next. Now find it in the List.`,
          );
          measured = { group: count, period: Number(period.toFixed(2)) };
          persist();
        }
      }

      const chipCtl = bin.own(
        makeDraggable(chip, {
          bounds: wrap,
          label: 'Measured characteristic',
          feedback: ctx.feedback,
          onDrop: () => {
            const hit = dropTargetUnder(chip, '[data-entry]');
            chipCtl.set({ x: 0, y: 0 }, true);
            if (hit?.dataset.entry) matchLight(hit.dataset.entry);
          },
        }),
      );

      function matchLight(entryId: string) {
        if (chip.hidden) {
          ctx.feedback('bad');
          said('Measure it first. Three flashes is not a light; three flashes and a period is a light.');
          return;
        }
        if (entryId === 'cadran-point') {
          lightId = entryId;
          persist();
          ctx.feedback('good');
          stopCall('‘Fifteen. It was fifteen. I’ve counted it a thousand times since and never once been asked.’');
          said(
            'Cadran Point. Nine miles south-south-east, Fl(3) W 15s, unaltered since 1911. She saw Cadran, and she has told the exact truth for twenty-four years.',
          );
          goStageB();
          return;
        }
        ctx.feedback('bad');
        said(
          entryId === 'nine-bells'
            ? 'Twenty seconds. She counted fifteen, twice, on a kitchen clock, from memory. It is not this light — and that is the whole case.'
            : entryId === 'sowens-beacon'
              ? 'Fifteen seconds, and six quick flashes and a long one. She tapped three. It is not this light either.'
              : 'Not this one. The group and the period both have to answer.',
        );
      }

      // =====================================================================
      // STAGE B — the light table
      // =====================================================================
      const loft = h('div', 'sx-cl-loft', '', { hidden: 'hidden' });
      const tableWrap = h('div', 'sx-cl-tablewrap');
      const table = h('div', 'sx-cl-table');
      tableWrap.appendChild(table);

      const baseSvg = sv('svg', {
        class: 'sx-cl-svg is-base',
        viewBox: `0 0 ${CHART_W} ${CHART_H}`,
        'aria-hidden': 'true',
        preserveAspectRatio: 'xMidYMid meet',
      });
      baseSvg.innerHTML = baseChartMarkup();
      table.appendChild(baseSvg);

      /** Chart units per CSS pixel, remeasured whenever the bench resizes. */
      let unitScale = 1;

      interface LayerRig {
        spec: LayerSpec;
        el: HTMLElement;
        spin: HTMLElement;
        drag: Control<{ x: number; y: number }>;
        registered: boolean;
      }
      const rigs = new Map<LayerId, LayerRig>();
      let selected: LayerId = 'sheet-1948';

      for (const spec of LAYERS) {
        const el = h('div', 'sx-cl-layer', '', {
          'data-layer': spec.id,
          'aria-label': `${spec.name} survey sheet: ${spec.sub}. Drag to move; bracket keys rotate; minus and equals scale.`,
        });
        const spin = h('div', 'sx-cl-spin');
        const svg = sv('svg', {
          class: 'sx-cl-svg',
          viewBox: `0 0 ${CHART_W} ${CHART_H}`,
          preserveAspectRatio: 'xMidYMid meet',
        });
        svg.innerHTML = layerMarkup(spec.id);
        spin.appendChild(svg);
        el.appendChild(spin);
        table.appendChild(el);

        const pose = poses.get(spec.id)!;
        const drag = bin.own(
          makeDraggable(el, {
            label: `${spec.name} survey sheet`,
            feedback: ctx.feedback,
            step: 2,
            position: { x: pose.dx, y: pose.dy },
            onMove: (p) => {
              const q = poses.get(spec.id)!;
              q.dx = p.x / unitScale;
              q.dy = p.y / unitScale;
              paintLayer(spec.id);
            },
            onDrop: () => {
              persist();
              checkRegistration(spec.id);
            },
          }),
        );

        el.addEventListener('pointerdown', () => selectLayer(spec.id), { signal: bin.signal });
        el.addEventListener('focus', () => selectLayer(spec.id), { signal: bin.signal });
        el.addEventListener(
          'wheel',
          (ev: WheelEvent) => {
            ev.preventDefault();
            selectLayer(spec.id);
            const q = poses.get(spec.id)!;
            if (ev.shiftKey) q.scale = clamp(q.scale - Math.sign(ev.deltaY) * 0.004, 0.86, 1.16);
            else q.rot = clamp(q.rot - Math.sign(ev.deltaY) * 0.4, -18, 18);
            paintLayer(spec.id);
            syncSliders();
            checkRegistration(spec.id);
          },
          { signal: bin.signal, passive: false },
        );
        el.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            const q = poses.get(spec.id)!;
            if (ev.key === '[') q.rot = clamp(q.rot - 0.3, -18, 18);
            else if (ev.key === ']') q.rot = clamp(q.rot + 0.3, -18, 18);
            else if (ev.key === '-') q.scale = clamp(q.scale - 0.004, 0.86, 1.16);
            else if (ev.key === '=' || ev.key === '+') q.scale = clamp(q.scale + 0.004, 0.86, 1.16);
            else return;
            ev.preventDefault();
            ev.stopPropagation();
            ctx.feedback('tick');
            paintLayer(spec.id);
            syncSliders();
            checkRegistration(spec.id);
          },
          { signal: bin.signal },
        );

        rigs.set(spec.id, { spec, el, spin, drag, registered: false });
      }

      // -- the dividers ------------------------------------------------------
      const dividers = h('div', 'sx-cl-dividers', '', { 'aria-hidden': 'false' });
      const pins: Control<{ x: number; y: number }>[] = [];
      const pinEls: HTMLElement[] = [];
      const pinStart: { x: number; y: number }[] = [
        { x: 300, y: 566 },
        { x: 400, y: 566 },
      ];
      const legs = sv('svg', {
        class: 'sx-cl-legs',
        viewBox: `0 0 ${CHART_W} ${CHART_H}`,
        'aria-hidden': 'true',
        preserveAspectRatio: 'xMidYMid meet',
      });
      legs.innerHTML = '<path class="cl-leg" d="M 0 0 L 0 0" />';
      const legPath = legs.querySelector('path')!;
      dividers.appendChild(legs);

      for (let i = 0; i < 2; i++) {
        const pin = h('div', 'sx-cl-pin', '', { 'data-pin': String(i) });
        pin.append(h('span', 'sx-cl-pin-point', '', { 'aria-hidden': 'true' }));
        dividers.appendChild(pin);
        pinEls.push(pin);
        const ctl = bin.own(
          makeDraggable(pin, {
            label: i === 0 ? 'Dividers, first point' : 'Dividers, second point',
            feedback: ctx.feedback,
            step: 3,
            position: { x: pinStart[i].x, y: pinStart[i].y },
            onMove: () => paintDividers(),
            onDrop: () => paintDividers(),
          }),
        );
        pins.push(ctl);
      }
      table.appendChild(dividers);

      // -- controls ----------------------------------------------------------
      const controls = h('div', 'sx-cl-controls');
      const tabRow = h('div', 'sx-cl-layertabs', '', { role: 'tablist', 'aria-label': 'Survey sheets' });
      const layerTabs = new Map<LayerId, HTMLButtonElement>();
      for (const spec of LAYERS) {
        const tab = h('button', 'sx-cl-layertab', '', {
          type: 'button',
          role: 'tab',
          'aria-selected': 'false',
          'data-tab': spec.id,
        });
        tab.append(
          h('span', 'sx-cl-layertab-name', spec.name),
          h('span', 'sx-cl-layertab-sub', spec.sub),
          h('span', 'sx-cl-layertab-state', '', { 'aria-hidden': 'true' }),
        );
        tab.addEventListener('click', () => {
          selectLayer(spec.id);
          rigs.get(spec.id)?.el.focus({ preventScroll: true });
        }, { signal: bin.signal });
        layerTabs.set(spec.id, tab);
        tabRow.appendChild(tab);
      }

      const rotSlider = bin.own(
        makeSlider({
          label: 'Rotate the selected sheet',
          min: -18,
          max: 18,
          step: 0.1,
          value: 0,
          length: '100%',
          format: (v) => `${v.toFixed(1)}°`,
          feedback: ctx.feedback,
          onChange: (v, committed) => {
            const q = poses.get(selected)!;
            q.rot = v;
            paintLayer(selected);
            if (committed) {
              persist();
              checkRegistration(selected);
            }
          },
        }),
      );
      const scaleSlider = bin.own(
        makeSlider({
          label: 'Scale the selected sheet',
          min: 0.86,
          max: 1.16,
          step: 0.002,
          value: 1,
          length: '100%',
          format: (v) => `${(v * 100).toFixed(1)}%`,
          feedback: ctx.feedback,
          onChange: (v, committed) => {
            const q = poses.get(selected)!;
            q.scale = v;
            paintLayer(selected);
            if (committed) {
              persist();
              checkRegistration(selected);
            }
          },
        }),
      );

      const resid = h('ul', 'sx-cl-resid', '', { 'aria-label': 'Residuals at the three marks' });
      const divRead = h('p', 'sx-cl-divread', 'Dividers: —');

      const casebook = h('div', 'sx-cl-casebook');
      const readOffsetLever = makeLever(
        'Enter the offset',
        'Casebook, citation column',
        () => enterOffset(),
        ctx.feedback,
      );
      const readChamberLever = makeLever(
        'Enter the chamber',
        'Casebook, citation column',
        () => enterChamber(),
        ctx.feedback,
      );
      const readLines = h('ul', 'sx-cl-readings');
      casebook.append(h('p', 'sx-card-title', 'Two readings'), readLines, readOffsetLever, readChamberLever);

      controls.append(
        tabRow,
        h('p', 'sx-cl-ctl-cap', 'Rotate'),
        rotSlider.el,
        h('p', 'sx-cl-ctl-cap', 'Scale'),
        scaleSlider.el,
        resid,
        divRead,
        casebook,
      );

      loft.append(tableWrap, controls);

      // -- geometry helpers --------------------------------------------------
      const measure = () => {
        const r = table.getBoundingClientRect();
        unitScale = (r.width || CHART_W) / CHART_W;
        // Re-express every stored pose and pin in the new pixel scale so a
        // resized bench does not move anything on the chart.
        for (const [id, rig] of rigs) {
          const p = poses.get(id)!;
          rig.drag.set({ x: p.dx * unitScale, y: p.dy * unitScale }, true);
          paintLayer(id);
        }
        pins.forEach((ctl, i) => {
          const u = pinUnits[i];
          ctl.set({ x: u.x * unitScale, y: u.y * unitScale }, true);
        });
        paintDividers();
      };

      const pinUnits: { x: number; y: number }[] = pinStart.map((p) => ({ ...p }));

      function paintLayer(id: LayerId) {
        const rig = rigs.get(id);
        const p = poses.get(id);
        if (!rig || !p) return;
        rig.spin.style.setProperty('--rot', `${p.rot}deg`);
        rig.spin.style.setProperty('--scale', String(p.scale));
        const rs = residuals(p);
        rig.el.dataset.off = String(Math.round(Math.max(...rs) * YARDS_PER_UNIT));
        if (id === selected) paintResiduals(rs);
      }

      function paintResiduals(rs: number[]) {
        resid.textContent = '';
        TRIG.forEach((m, i) => {
          const yards = Math.round(rs[i] * YARDS_PER_UNIT);
          const li = h('li', 'sx-cl-resid-row');
          li.dataset.ok = rs[i] <= REG_TOL ? 'yes' : 'no';
          li.append(
            h('span', 'sx-cl-resid-name', m.name),
            h('span', 'sx-cl-resid-val', rs[i] <= REG_TOL ? 'lies down' : `${yards} yd out`),
          );
          resid.appendChild(li);
        });
      }

      function checkRegistration(id: LayerId) {
        const rig = rigs.get(id);
        const p = poses.get(id);
        if (!rig || !p || rig.registered) return;
        const worst = Math.max(...residuals(p));
        if (worst > REG_SNAP) return;
        // Close enough that the register pins would take it: drop it home.
        p.dx = 0;
        p.dy = 0;
        p.rot = 0;
        p.scale = 1;
        rig.drag.set({ x: 0, y: 0 }, true);
        rig.registered = true;
        rig.el.classList.add('is-registered');
        paintLayer(id);
        syncSliders();
        ctx.feedback('good');
        persist();
        const n = [...rigs.values()].filter((r) => r.registered).length;
        said(
          n === LAYERS.length
            ? 'All three lie down on the marks. Now read what they say about each other.'
            : `${rig.spec.name} registers on all three marks. ${wordFor(LAYERS.length - n)} to go.`,
        );
        revealFindings();
        tally();
      }

      function syncSliders() {
        const p = poses.get(selected)!;
        rotSlider.set(p.rot, true);
        scaleSlider.set(p.scale, true);
      }

      function selectLayer(id: LayerId) {
        if (selected === id) return;
        selected = id;
        for (const [lid, rig] of rigs) {
          rig.el.classList.toggle('is-selected', lid === id);
          rig.el.style.setProperty('--depth', lid === id ? '3' : '1');
          layerTabs.get(lid)!.setAttribute('aria-selected', String(lid === id));
          layerTabs.get(lid)!.classList.toggle('is-open', lid === id);
        }
        syncSliders();
        paintLayer(id);
      }

      function paintDividers() {
        pins.forEach((ctl, i) => {
          const p = ctl.get();
          pinUnits[i] = { x: p.x / unitScale, y: p.y / unitScale };
        });
        const [a, b] = pinUnits;
        legPath.setAttribute('d', `M ${a.x} ${a.y} L ${b.x} ${b.y}`);
        const dist = Math.hypot(b.x - a.x, b.y - a.y) * YARDS_PER_UNIT;
        const named = (p: { x: number; y: number }) => {
          if (Math.hypot(p.x - FINDING_POS.x, p.y - FINDING_POS.y) <= 16) return 'the position as found';
          if (Math.hypot(p.x - TRACK_POS.x, p.y - TRACK_POS.y) <= 16) return 'the reconstructed track';
          return null;
        };
        const na = named(a);
        const nb = named(b);
        divRead.textContent =
          na && nb && na !== nb
            ? `Dividers: ${Math.round(dist / 10) * 10} yards, ${na} to ${nb}.`
            : `Dividers: ${Math.round(dist / 10) * 10} yards against the printed scale.`;
        armLever(readOffsetLever, offsetReady());
      }

      const allRegistered = () => [...rigs.values()].every((r) => r.registered);

      function offsetReady() {
        if (!allRegistered() || readingOffset) return false;
        const [a, b] = pinUnits;
        const spans = (p: { x: number; y: number }, q: { x: number; y: number }) =>
          Math.hypot(a.x - p.x, a.y - p.y) <= 16 && Math.hypot(b.x - q.x, b.y - q.y) <= 16;
        if (!spans(FINDING_POS, TRACK_POS) && !spans(TRACK_POS, FINDING_POS)) return false;
        const dist = Math.hypot(b.x - a.x, b.y - a.y) * YARDS_PER_UNIT;
        return Math.abs(dist - 340) <= 40;
      }

      function enterOffset() {
        if (!offsetReady()) {
          ctx.feedback('bad');
          said(
            allRegistered()
              ? 'Set the dividers on the two marks themselves — the position in the finding, and the track the Inquiry drew — and read it against the printed scale.'
              : 'Register all three sheets first. A reading taken off unregistered tracings is a reading about nothing.',
          );
          return;
        }
        readingOffset = true;
        persist();
        ctx.feedback('good');
        said(
          'Three hundred and forty yards east of the position in the finding, and dead on the line a competent pilot would steer. Emrys Tain was where he ought to have been.',
        );
        revealFindings();
        tally();
      }

      function enterChamber() {
        if (!allRegistered()) {
          ctx.feedback('bad');
          said('Register the sheets first.');
          return;
        }
        readingChamber = true;
        persist();
        ctx.feedback('good');
        said(
          'A chamber twenty feet by twelve under the north end of the undercroft, on the 1948 inset. On the 1998 inset the same ground is drawn solid. It stops existing in 1975.',
        );
        revealFindings();
        tally();
      }

      // The chamber is a click target on the 1948 sheet, live once it registers.
      const chamberHit = h('button', 'sx-cl-chamberhit', '', {
        type: 'button',
        'aria-label': 'The chamber on the 1948 inset, twenty feet by twelve',
      });
      chamberHit.addEventListener('click', () => enterChamber(), { signal: bin.signal });
      rigs.get('sheet-1948')!.el.appendChild(chamberHit);

      function revealFindings() {
        const on = allRegistered();
        loft.dataset.registered = on ? 'yes' : 'no';
        chamberHit.hidden = !on || readingChamber;
        readLines.textContent = '';
        readLines.appendChild(
          h(
            'li',
            `sx-cl-reading ${readingOffset ? 'is-in' : ''}`,
            readingOffset
              ? 'The reconstructed track lies 340 yards east of the position in the finding, and on the line a competent pilot would steer.'
              : 'Reading one: how far, and which way, the Inquiry’s own track lies from its own finding.',
          ),
        );
        readLines.appendChild(
          h(
            'li',
            `sx-cl-reading ${readingChamber ? 'is-in' : ''}`,
            readingChamber
              ? 'A chamber 20 ft × 12 ft under the north end of the undercroft on the 1948 inset; drawn solid in 1998.'
              : 'Reading two: anything on one sheet that is not on the others.',
          ),
        );
        armLever(readOffsetLever, offsetReady());
        armLever(readChamberLever, on && !readingChamber);
        for (const [id, rig] of rigs) {
          layerTabs.get(id)!.querySelector('.sx-cl-layertab-state')!.textContent = rig.registered
            ? '✓ registered'
            : '· loose';
          layerTabs.get(id)!.dataset.done = rig.registered ? 'yes' : 'no';
        }
      }

      // =====================================================================
      // Staging
      // =====================================================================
      body.append(callbox, loft);

      function goStageB() {
        stage = 'b';
        wrap.dataset.stage = 'b';
        callbox.hidden = true;
        loft.hidden = false;
        step.textContent =
          'The Chart Loft. Three surveys of the same water. Register them on the marks the surveyor put there — not on the coastline, which moves.';
        // The table has just been given a size; everything is measured from it.
        requestAnimationFrame(() => measure());
        selectLayer('sheet-1974');
        selectLayer('sheet-1948');
        revealFindings();
        tally();
      }

      function tally() {
        if (stage === 'a') {
          ctx.note(
            lightId
              ? 'The light is named. Upstairs to the loft.'
              : 'Three flashes is not a light. Three flashes and a period is a light.',
          );
          return;
        }
        const n = [...rigs.values()].filter((r) => r.registered).length;
        const reads = (readingOffset ? 1 : 0) + (readingChamber ? 1 : 0);
        if (n < LAYERS.length) {
          ctx.note(`${wordFor(n)} of the three sheets lie down on the marks.`);
          return;
        }
        if (reads < 2) {
          ctx.note(`Registered. ${wordFor(reads)} of the two readings entered.`);
          return;
        }
        ctx.note('The light, the track and the room that was not there.');
        ctx.feedback('good');
        ctx.solve();
      }

      // -- restore -----------------------------------------------------------
      for (const [id, rig] of rigs) {
        const p = poses.get(id)!;
        rig.registered = Math.max(...residuals(p)) <= REG_TOL;
        rig.el.classList.toggle('is-registered', rig.registered);
        paintLayer(id);
      }
      selectLayer('sheet-1974');
      selectLayer('sheet-1948');
      bin.observe(table, () => measure());

      if (stage === 'b') {
        wrap.dataset.stage = 'b';
        callbox.hidden = true;
        loft.hidden = false;
        step.textContent =
          'The Chart Loft. Three surveys of the same water, and a pair of dividers against a printed scale bar.';
        requestAnimationFrame(() => measure());
        revealFindings();
        said('Cadran Point, Fl(3) W 15s. Now the sheets.');
      } else {
        wrap.dataset.stage = 'a';
        step.textContent =
          'The call box at Rossport, and a woman in Wolverhampton who has never once been wrong. Press the plunger on every flash she taps, and on the first of the next group.';
        said('‘Three flashes, love. Three. We all saw them.’ — and nobody, in twenty-four years, has asked her how long they took.');
        drawTape();
        // A measurement already taken is a measurement she still holds; the
        // player must not be made to sit through the call a second time.
        const wasGroup = asNum(measured.group, 0);
        const wasPeriod = asNum(measured.period, 0);
        if (wasGroup === 3 && Math.abs(wasPeriod - PERIOD) <= 1.2) {
          dialGroup.querySelector('.sx-cl-dial-val')!.textContent = String(wasGroup);
          dialPeriod.querySelector('.sx-cl-dial-val')!.textContent = `${wasPeriod.toFixed(1)} s`;
          chip.querySelector('.sx-cl-chip-val')!.textContent = `Fl(3) W ${Math.round(wasPeriod)}s`;
          chip.hidden = false;
          chip.classList.add('is-good');
        }
      }
      tally();

      // The transient lamp, and the end of the call.
      bin.loop(() => {
        if (!calling) return;
        const t = clock();
        while (nextFlash < scheduled.length && scheduled[nextFlash] <= t) {
          nextFlash += 1;
          if (showTransients) {
            visLamp.classList.remove('is-on');
            void visLamp.offsetWidth;
            visLamp.classList.add('is-on');
          }
        }
        if (nextFlash >= scheduled.length && scheduled.length && t > scheduled[scheduled.length - 1] + 2.2) {
          stopCall('‘That’s it. That’s exactly it, and I’d know it anywhere.’');
        }
      });

      bin.onCleanup(() => {
        stopHiss?.();
        tone.close();
      });
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================

/**
 * Registers every mechanism in this batch. The integration layer calls one of
 * these per batch, so a puzzle file can be added or pulled without anybody
 * editing a central table.
 */
export function registerSensoryPuzzles(): void {
  registerPuzzle('puz-typewriter-survey', typewriterSurvey);
  registerPuzzle('puz-bottom-shelf', bottomShelf);
  registerPuzzle('puz-deakin-authentication', deakinAuthentication);
  registerPuzzle('puz-chart-loft', chartLoft);
}
