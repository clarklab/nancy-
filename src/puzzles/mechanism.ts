/**
 * The four mechanisms you work with your hands.
 *
 * Everything in this file is an *object*, not a form. The player winds a
 * timelock, levers nine courses of brick out of a Portland stone opening,
 * patches six cord pairs across a 1926 plug board, and bolts a Fresnel panel
 * into a bronze frame. Nothing here has a submit button; a mechanism knows it
 * is right the instant it is right, and says so with a detent, a lamp and a
 * line of Wren's own commentary.
 *
 *   puz-three-movements  The Three Movements   — Chubb timelock, Act II
 *   puz-tide-room        The Room That Was Not There — brick, marigraph, drum
 *   puz-switchboard      The Night Plug-Log    — twelve jacks, six cords
 *   puz-the-optic        First Light           — panel, sectors, escapement
 *
 * Three rules hold across all four.
 *
 * 1. THE OBJECT IS THE INTERFACE. Every control is a shared primitive from
 *    `puzzle-host` — the same brass, the same detent weight, the same keyboard
 *    contract — dressed in this file's stylesheet and nothing else.
 * 2. THE CHECK IS CONTINUOUS, except where the fiction insists on a deliberate
 *    physical act (lifting a lever, throwing a speaking key, transferring a
 *    reading to the casebook). Those are the moments the design wants weight
 *    on; everything else settles the instant it is true.
 * 3. NO SIGNAL IS CARRIED BY HUE ALONE. A live cord lamp is also a filled
 *    ring; a soft mortar joint is also hatched; a struck sector is also
 *    notched. The colour-blind-safe setting thickens all three.
 */

import type { PuzzleContext, PuzzleModule } from '@/engine/types';
import {
  makeDial,
  makeDraggable,
  makeRotatable,
  makeSlider,
  makeToggle,
  registerPuzzle,
  type Control,
} from '@/ui/puzzle-host';

import '@/styles/puzzles-mechanism.css';

// ===========================================================================
// Shared workshop kit
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

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className = '',
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  if (className) node.setAttribute('class', className);
  return node;
}

const attrs = (node: Element, map: Record<string, string | number>) => {
  for (const [k, v] of Object.entries(map)) node.setAttribute(k, String(v));
  return node;
};

/**
 * A cast brass instruction plate — the thing a Victorian engineer bolted to
 * the machine so that nobody would ever have to guess. Every puzzle here has
 * one, because every one of these mechanisms had one in life.
 */
function plate(heading: string, lines: string[], className = ''): HTMLElement {
  const el = h('div', `mech-plate ${className}`.trim());
  el.appendChild(h('p', 'mech-plate-head', heading));
  const list = h('ul', 'mech-plate-list');
  for (const line of lines) list.appendChild(h('li', 'mech-plate-line', line));
  el.appendChild(list);
  return el;
}

/** Small engraved caption above or below a fitting. */
const caption = (text: string) => h('span', 'mech-caption', text);

/**
 * Everything one mounted mechanism has to give back.
 *
 * Puzzles are opened and closed dozens of times in a playthrough; a single
 * leaked rAF loop turns into a stutter three hours later that nobody can
 * trace. So nothing is created here that the rig is not holding the other end
 * of: listeners take its signal, loops take its `loop`, primitives take its
 * `keep`.
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

  /** Re-runs `fn` whenever `el` changes size. Used by anything drawn in px. */
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
        console.error('[mechanism] a fitting threw during teardown', err);
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
// `ctx.state` is a plain bag off the save file, so it can hold anything a
// previous version wrote, or nothing at all. Every read is defensive: a stale
// save must degrade to "start of the puzzle", never to a crash on line one.

const readNum = (bag: Record<string, unknown>, key: string, fallback: number): number => {
  const v = bag[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

const readBool = (bag: Record<string, unknown>, key: string): boolean => bag[key] === true;

const readNums = (bag: Record<string, unknown>, key: string): number[] => {
  const v = bag[key];
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];
};

const readStrings = (bag: Record<string, unknown>, key: string): string[] => {
  const v = bag[key];
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
};

// -- the stage rail ----------------------------------------------------------

/**
 * Multi-stage mechanisms get a numbered rail so the player always knows how
 * many operations are left in the job. It is a progress readout, not a
 * navigation control: you cannot click stage three, you can only earn it.
 */
class Stages {
  readonly el = h('ol', 'mech-rail');
  private steps: HTMLElement[] = [];
  private panels: HTMLElement[] = [];
  private at = -1;

  constructor(names: string[]) {
    this.el.setAttribute('aria-label', 'Operations');
    names.forEach((name, i) => {
      const step = h('li', 'mech-rail-step');
      step.append(h('span', 'mech-rail-numeral', ROMAN[i] ?? String(i + 1)));
      step.append(h('span', 'mech-rail-name', name));
      this.steps.push(step);
      this.el.appendChild(step);
    });
  }

  add(panel: HTMLElement) {
    panel.classList.add('mech-stage');
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
    if (focus) this.panels[i]?.focus({ preventScroll: true });
  }
}

/** Wraps a mechanism's root so every module has the same outer furniture. */
function bench(root: HTMLElement, kind: string): HTMLElement {
  const el = h('div', `mech-root ${kind}`);
  root.appendChild(el);
  return el;
}

// ===========================================================================
// puz-three-movements — "The Three Movements"
// The Strongroom door, Act II. A Chubb timelock with no keyhole.
// ===========================================================================

/** One quarter-hour of winding, in degrees of key rotation. */
const QUARTER_DEG = 6;

interface MovementSpec {
  key: string;
  numeral: string;
  title: string;
  /** Full-scale of the engraved dial, in hours. */
  scale: number;
  /** Correct setting, in quarter-hours. */
  answer: number;
  /** Engraved under the face — what the movement is *for*, never its value. */
  legend: string;
}

const MOVEMENTS: MovementSpec[] = [
  {
    key: 'm1',
    numeral: 'I',
    title: 'Ordinary day',
    scale: 48,
    answer: 61, // 15¼ h — 17:30 to 08:45
    legend: 'Closing hour to opening hour, Monday to Friday',
  },
  {
    key: 'm2',
    numeral: 'II',
    title: 'Saturday',
    scale: 72,
    answer: 177, // 44¼ h — Sat 12:30 to Mon 08:45
    legend: 'Saturday closing to the next working morning',
  },
  {
    key: 'm3',
    numeral: 'III',
    title: 'The interval last set',
    scale: 48,
    answer: 60, // 15 h — 17:00 to 08:00, 14 September 1998
    legend: 'As entered by hand at the last winding',
  },
];

/** "15 h 15" — the way the little engraved window reads it. */
function quartersText(q: number): string {
  const hours = Math.floor(q / 4);
  const mins = (q % 4) * 15;
  return `${hours} h ${String(mins).padStart(2, '0')}`;
}

/** "fifteen and a quarter hours" — the way Wren says it out loud. */
function quartersSpoken(q: number): string {
  const hours = Math.floor(q / 4);
  const part = ['', ' and a quarter', ' and a half', ' and three quarters'][q % 4];
  return `${hours}${part} hours`;
}

interface BookPage {
  heading: string;
  strap: string;
  lines: [string, string][];
}

const ORDER_BOOK: BookPage[] = [
  {
    heading: 'Week ending Friday 11 September 1998',
    strap: 'Warden’s Order Book, working copy. Ordinary working days.',
    lines: [
      ['Mon 7 Sept', 'Strongroom wound. Closed 17.30, to open 08.45.'],
      ['Tue 8 Sept', 'Strongroom wound. Closed 17.30, to open 08.45.'],
      ['Wed 9 Sept', 'Strongroom wound. Closed 17.30, to open 08.45.'],
      ['Thu 10 Sept', 'Strongroom wound. Closed 17.30, to open 08.45. Boiler man attended.'],
      ['Fri 11 Sept', 'Strongroom wound. Closed 17.30, to open 08.45.'],
    ],
  },
  {
    heading: 'Saturdays, Michaelmas quarter',
    strap: 'Half day. The building is not opened again until Monday.',
    lines: [
      ['Sat 29 Aug', 'Half day. Strongroom wound. Closed 12.30, to open Monday 08.45.'],
      ['Sat 5 Sept', 'Half day. Strongroom wound. Closed 12.30, to open Monday 08.45.'],
      ['Sat 12 Sept', 'Half day. Strongroom wound. Closed 12.30, to open Monday 08.45.'],
      ['Sat 19 Sept', 'Half day. Strongroom wound. Closed 12.30, to open Monday 08.45.'],
    ],
  },
  {
    heading: 'Monday 14 September 1998',
    strap: 'The last entry in this hand. Nothing was written on the 15th.',
    lines: [
      ['09.10', 'Duplicating Room booked, Warden’s Office, 09.10 to 09.30.'],
      ['11.00', 'Scaffold licence, north elevation, renewed for one month.'],
      ['16.20', 'Accident. Mr C. Sallow, Rolls Room stair. Ambulance called 16.31.'],
      ['17.00', 'Strongroom wound. Closed 17.00, to open 08.00.'],
      ['—', 'Building secured by the Warden. Night porter stood down at 18.00.'],
    ],
  },
];

function threeMovements(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'mech-timelock');

      // -- left column: the cast plate and the book she carried down --------
      const left = h('div', 'tl-column');
      left.appendChild(
        plate('Chubb & Son’s Lock and Safe Co. Ltd · Wolverhampton · 1911', [
          'Movement I — Ordinary day',
          'Movement II — Saturday',
          'Movement III — The interval last set',
          'The door cannot be drawn before the shortest movement has run out.',
        ]),
      );

      const carried = ctx.hasItem('order-book-working-copy');
      const book = h('section', 'tl-book');
      book.setAttribute('aria-label', 'Warden’s Order Book, working copy');
      const bookHead = h('header', 'tl-book-head');
      bookHead.append(
        h('h3', 'tl-book-title', 'Warden’s Order Book'),
        h(
          'span',
          'tl-book-tag',
          carried ? 'Working copy — carried down' : 'Copied into the casebook this morning',
        ),
      );
      const bookBody = h('div', 'tl-book-body');
      const bookFoot = h('div', 'tl-book-foot');
      const prev = h('button', 'tl-page-btn', '◀');
      const next = h('button', 'tl-page-btn', '▶');
      prev.type = 'button';
      next.type = 'button';
      prev.setAttribute('aria-label', 'Previous page of the Order Book');
      next.setAttribute('aria-label', 'Next page of the Order Book');
      const pageCount = h('span', 'tl-page-count');
      bookFoot.append(prev, pageCount, next);
      book.append(bookHead, bookBody, bookFoot);
      left.appendChild(book);

      let page = clamp(readNum(ctx.state, 'page', 0), 0, ORDER_BOOK.length - 1);

      const drawPage = () => {
        const p = ORDER_BOOK[page];
        bookBody.textContent = '';
        bookBody.append(h('h4', 'tl-page-head', p.heading), h('p', 'tl-page-strap', p.strap));
        const dl = h('dl', 'tl-entries');
        for (const [when, what] of p.lines) {
          dl.append(h('dt', 'tl-entry-when', when), h('dd', 'tl-entry-what', what));
        }
        bookBody.appendChild(dl);
        pageCount.textContent = `${page + 1} / ${ORDER_BOOK.length}`;
        prev.disabled = page === 0;
        next.disabled = page === ORDER_BOOK.length - 1;
      };

      const turnTo = (n: number) => {
        page = clamp(n, 0, ORDER_BOOK.length - 1);
        drawPage();
        ctx.feedback('tick');
        ctx.state.page = page;
        ctx.save();
      };
      prev.addEventListener('click', () => turnTo(page - 1), { signal: rig.signal });
      next.addEventListener('click', () => turnTo(page + 1), { signal: rig.signal });
      drawPage();

      // -- right column: three movements, then the handle -------------------
      const right = h('div', 'tl-column tl-column--work');
      const bank = h('div', 'tl-bank');
      right.appendChild(bank);

      const quarters = new Map<string, number>();
      const needles = new Map<string, HTMLElement>();
      const windows = new Map<string, HTMLElement>();
      const keys = new Map<string, Control<number>>();

      const agreed = () => MOVEMENTS.every((m) => quarters.get(m.key) === m.answer);

      const persist = () => {
        for (const m of MOVEMENTS) ctx.state[m.key] = quarters.get(m.key) ?? 0;
        ctx.save();
      };

      for (const spec of MOVEMENTS) {
        const maxQ = spec.scale * 4;
        const start = clamp(Math.round(readNum(ctx.state, spec.key, 0)), 0, maxQ);
        quarters.set(spec.key, start);

        const mv = h('div', 'tl-movement');
        const head = h('header', 'tl-mv-head');
        head.append(
          h('span', 'tl-mv-numeral', spec.numeral),
          h('span', 'tl-mv-title', spec.title),
        );
        mv.appendChild(head);

        // The engraved face: an hour tick every hour, a numeral every six.
        const face = h('div', 'tl-face');
        const dialSweep = 300;
        const ticks = h('div', 'tl-ticks');
        for (let hour = 0; hour <= spec.scale; hour += 1) {
          const major = hour % 6 === 0;
          if (!major && spec.scale > 48 && hour % 2 === 1) continue;
          const tick = h('span', `tl-tick${major ? ' is-major' : ''}`);
          tick.style.setProperty('--a', `${-dialSweep / 2 + (hour / spec.scale) * dialSweep}deg`);
          ticks.appendChild(tick);
          if (major) {
            const num = h('span', 'tl-numeral', String(hour));
            num.style.setProperty(
              '--a',
              `${-dialSweep / 2 + (hour / spec.scale) * dialSweep}deg`,
            );
            ticks.appendChild(num);
          }
        }
        const needle = h('span', 'tl-needle');
        const win = h('output', 'tl-window');
        face.append(ticks, needle, h('span', 'tl-hub'), win);
        needles.set(spec.key, needle);
        windows.set(spec.key, win);
        mv.appendChild(face);
        mv.appendChild(caption(spec.legend));

        // The winding key. Six degrees to the quarter-hour, so a full turn of
        // the wrist is fifteen hours and the long Saturday movement is a real
        // three-turn wind rather than a number you type.
        const keyWell = h('div', 'tl-key-well');
        const keyEl = h('div', 'tl-key');
        keyEl.append(h('span', 'tl-key-bit'), h('span', 'tl-key-bow'));
        keyWell.append(keyEl, caption('Wind'));
        mv.appendChild(keyWell);

        bank.appendChild(mv);

        const paint = () => {
          const q = quarters.get(spec.key) ?? 0;
          needle.style.setProperty('--a', `${-dialSweep / 2 + (q / maxQ) * dialSweep}deg`);
          win.textContent = quartersText(q);
          keyEl.setAttribute('aria-valuenow', String(q / 4));
          keyEl.setAttribute('aria-valuetext', quartersSpoken(q));
          mv.classList.toggle('is-wound', q > 0);
        };

        const setQ = (q: number, announce: boolean) => {
          const next = clamp(Math.round(q), 0, maxQ);
          if (next === quarters.get(spec.key)) return;
          quarters.set(spec.key, next);
          paint();
          if (announce) {
            ctx.note(`Movement ${spec.numeral} stands at ${quartersSpoken(next)}.`);
          }
          persist();
        };

        keyEl.setAttribute('role', 'spinbutton');
        keyEl.setAttribute('aria-valuemin', '0');
        keyEl.setAttribute('aria-valuemax', String(spec.scale));
        keyEl.setAttribute(
          'aria-description',
          'Arrow keys wind a quarter of an hour. Page Up and Page Down wind an hour, ' +
            'with Shift, four hours.',
        );

        const rot = rig.keep(
          makeRotatable(keyEl, {
            angle: start * QUARTER_DEG,
            detent: QUARTER_DEG,
            min: 0,
            max: maxQ * QUARTER_DEG,
            label: `Movement ${spec.numeral}, ${spec.title.toLowerCase()} — winding key`,
            feedback: ctx.feedback,
            onChange: (deg) => setQ(deg / QUARTER_DEG, false),
            onCommit: (deg) => setQ(deg / QUARTER_DEG, true),
          }),
        );
        keys.set(spec.key, rot);

        // Winding forty-four hours a quarter at a time with the arrow keys is
        // not accessibility, it is a sentence. Page keys wind by the hour.
        keyEl.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            const coarse = ev.shiftKey ? 16 : 4;
            let delta = 0;
            if (ev.key === 'PageUp') delta = coarse;
            else if (ev.key === 'PageDown') delta = -coarse;
            else return;
            ev.preventDefault();
            ev.stopPropagation();
            const target = clamp((quarters.get(spec.key) ?? 0) + delta, 0, maxQ);
            rot.set(target * QUARTER_DEG, true);
            setQ(target, true);
            ctx.feedback('tick');
          },
          { signal: rig.signal },
        );

        paint();
      }

      // -- the handle and the lever -----------------------------------------
      const gate = h('div', 'tl-gate');
      const handleWell = h('div', 'tl-handle-well');
      const handle = h('div', 'tl-handle');
      for (let i = 0; i < 4; i++) {
        const spoke = h('span', 'tl-spoke');
        spoke.style.setProperty('--a', `${i * 45}deg`);
        handle.appendChild(spoke);
      }
      handle.append(h('span', 'tl-handle-rim'), h('span', 'tl-handle-boss'));
      handleWell.append(handle, caption('Three quarters anti-clockwise'));

      const lever = h('button', 'tl-lever');
      lever.type = 'button';
      lever.disabled = true;
      lever.append(h('span', 'tl-lever-arm'), h('span', 'tl-lever-label', 'Lift'));
      lever.setAttribute('aria-label', 'Lift the releasing lever');

      const verdict = h('p', 'tl-verdict');
      verdict.setAttribute('role', 'status');
      gate.append(handleWell, lever, verdict);
      right.appendChild(gate);

      let pulls = Math.max(0, Math.round(readNum(ctx.state, 'pulls', 0)));
      let drawn = false;

      const armLever = (on: boolean) => {
        lever.disabled = !on;
        lever.classList.toggle('is-live', on);
      };

      const handleCtl = rig.keep(
        makeRotatable(handle, {
          angle: 0,
          detent: 15,
          min: -270,
          max: 0,
          label: 'Door handle',
          feedback: ctx.feedback,
          onChange: (deg) => {
            if (agreed()) {
              handle.classList.toggle('is-drawn', deg <= -255);
              if (deg <= -255 && !drawn) {
                drawn = true;
                ctx.feedback('good');
                verdict.textContent = 'The dogs are clear. Lift the lever.';
                armLever(true);
                lever.focus({ preventScroll: true });
              }
              return;
            }
            // Dead against the dogs: it gives about fifteen degrees of slack
            // and then it is eleven inches of steel arguing back.
            if (deg < -18) handleCtl.set(-18, true);
          },
          onCommit: () => {
            if (agreed()) return;
            handleCtl.set(0, true);
            pulls += 1;
            ctx.state.pulls = pulls;
            ctx.save();
            ctx.feedback('bad');
            handle.classList.remove('is-refused');
            void handle.offsetWidth;
            handle.classList.add('is-refused');
            verdict.textContent = 'The movements are not in agreement.';
            // Third time of asking, she starts counting what holds. Not which
            // — a mechanism that names its own wrong dial is a walkthrough.
            if (pulls >= 3) {
              const right_ = MOVEMENTS.filter((m) => quarters.get(m.key) === m.answer).length;
              ctx.note(
                right_ === 0
                  ? 'Nothing drops. Not one of the three is a number this building keeps.'
                  : `${['One', 'Two', 'Three'][right_ - 1]} of the three movements holds. The rest are mine, not the building’s.`,
              );
            } else {
              ctx.note('Dead against the dogs. It does not want a number I invented.');
            }
          },
        }),
      );

      lever.addEventListener(
        'click',
        () => {
          if (!agreed() || !drawn) return;
          ctx.feedback('good');
          lever.classList.add('is-lifted');
          ctx.note('Eleven inches of steel, and it goes back like a drawer.');
          rig.after(reduced() ? 60 : 420, () => ctx.solve());
        },
        { signal: rig.signal },
      );

      // Continuous watch on the three movements: the instant the dogs line up
      // the handle goes live, without the player having to try it and be told.
      let wasAgreed = false;
      rig.loop(() => {
        const now = agreed();
        if (now === wasAgreed) return;
        wasAgreed = now;
        el.classList.toggle('is-agreed', now);
        if (now) {
          ctx.feedback('tick');
          verdict.textContent = 'Something drops inside the door. The handle is live.';
          ctx.note('Three detents, one after another, somewhere behind eleven inches of steel.');
        } else if (!drawn) {
          verdict.textContent = '';
          armLever(false);
        }
      });

      el.append(left, right);

      ctx.note(
        carried
          ? 'The working copy, open on the floor against the door frame. Every closing hour since the war.'
          : 'No book in my hands, but the closing hours are copied into the casebook.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-tide-room — "The Room That Was Not There"
// Undercroft north wall, then the Tide Room. Brick, then brass, then paper.
// ===========================================================================

/** Bed joints, counted up from the floor. The 1975 cement is the third. */
const SOFT_JOINT = 3;
const JOINTS = 8;
const PULLS_NEEDED = 3;

/** The six operations on the Kelvin & White plate, in the order it gives them. */
const MARIGRAPH_OPS = [
  { id: 'weight', label: 'Hang the driving weight', done: 'The weight swings free on its gut line.' },
  { id: 'drum', label: 'Ship the drum on its spindle', done: 'The drum drops onto the square and turns true.' },
  { id: 'paper', label: 'Smoke and mount the paper', done: 'Lamp-black, evenly laid, and the sheet clipped at the seam.' },
  { id: 'pen', label: 'Re-ink the pen and set it to the datum', done: 'The stylus sits exactly on the three-metre line.' },
  { id: 'clutch', label: 'Engage the clutch', done: 'The float wire takes up and the arm answers the water.' },
  { id: 'clock', label: 'Wind the clock', done: 'Sixty-seven years of dust, and it starts ticking under my hand.' },
];

/** Minutes past midnight of the drum's left and right edges, and of the moment. */
const T0 = 18 * 60;
const T1 = 30 * 60;
const T_TRUE = 23 * 60 + 4;

/** Admiralty prediction for Ivory Sound, 3 November 1974, in metres. */
const predicted = (m: number) => 2.9 + 1.6 * Math.cos((2 * Math.PI * (m - 1190)) / 745);
/** What the float actually wrote: prediction plus the surge nobody allowed for. */
const observed = (m: number) => predicted(m) + 1.4 * Math.exp(-(((m - T_TRUE) / 95) ** 2));

const hhmm = (m: number) => {
  const t = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function tideRoom(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'mech-tideroom');
      const stages = new Stages(['The wall', 'To set going', 'Drum 1974/44']);
      el.appendChild(stages.el);

      const persist = (patch: Record<string, unknown>) => {
        Object.assign(ctx.state, patch);
        ctx.save();
      };

      // =====================================================================
      // Stage I — nine courses of brick in a Portland stone opening
      // =====================================================================
      const wallStage = h('div', 'tr-wall-stage');
      stages.add(wallStage);

      const wall = h('div', 'tr-wall');
      for (let course = 8; course >= 0; course--) {
        const row = h('div', 'tr-course');
        row.style.setProperty('--offset', course % 2 === 0 ? '0' : '0.5');
        for (let b = 0; b < 7; b++) row.appendChild(h('span', 'tr-brick'));
        wall.appendChild(row);
        if (course > 0) {
          const joint = h('button', 'tr-joint');
          joint.type = 'button';
          joint.dataset.joint = String(course);
          if (course === SOFT_JOINT) joint.classList.add('is-soft');
          joint.setAttribute(
            'aria-label',
            `Bed joint above course ${course}${course === SOFT_JOINT ? ', pale sandy mortar' : ', black ash mortar'}`,
          );
          wall.appendChild(joint);
        }
      }

      const gauge = h('div', 'tr-gauge');
      const gaugeTrack = h('div', 'tr-gauge-track');
      const gaugeFill = h('span', 'tr-gauge-fill');
      const gaugeBand = h('span', 'tr-gauge-band');
      gaugeTrack.append(gaugeFill, gaugeBand);
      const grip = h('button', 'tr-grip');
      grip.type = 'button';
      grip.append(h('span', 'tr-grip-shaft'), h('span', 'tr-grip-label', 'Pull'));
      grip.setAttribute(
        'aria-label',
        'Pull on the crowbar. Hold to build weight, release inside the marked band.',
      );
      gauge.append(caption('Strain'), gaugeTrack, grip);

      const readout = h('p', 'tr-readout');
      readout.setAttribute('role', 'status');
      const courses = h('p', 'tr-courses');

      const wallPanel = h('div', 'tr-wall-panel');
      wallPanel.append(
        plate('Works Order 75/188 — 15 June 1975', [
          '“Seal chamber, damp.” Nine courses, common brick.',
          'Ordered p.p. Countersigned by no one.',
          'Wipe a joint with a thumb: 1811 mortar is black ash and will not mark.',
        ]),
        gauge,
      );
      wallStage.append(
        h('div', 'tr-wall-holder').appendChild(wall).parentElement as HTMLElement,
        wallPanel,
      );
      wallStage.append(readout, courses);

      let seated = clamp(Math.round(readNum(ctx.state, 'seated', 0)), 0, JOINTS);
      let pulls = clamp(Math.round(readNum(ctx.state, 'pulls', 0)), 0, PULLS_NEEDED);
      let power = 0;
      let holding = false;
      let rising = true;

      const BAND: [number, number] = [0.58, 0.8];
      gaugeBand.style.setProperty('--lo', String(BAND[0]));
      gaugeBand.style.setProperty('--hi', String(BAND[1]));

      const paintCourses = () => {
        courses.textContent =
          pulls === 0
            ? 'Nine courses in. Nothing has moved.'
            : pulls === PULLS_NEEDED
              ? 'The panel is out. Cold air, and it smells of brass polish and low tide.'
              : `${['One', 'Two'][pulls - 1]} course out. The joint above it has started to weep dust.`;
        wall.dataset.out = String(pulls);
      };

      const describe = (joint: number | null) => {
        if (joint === null) {
          readout.textContent = seated
            ? `Bar seated in the joint above course ${seated}.`
            : 'Run a hand along the joints. The wall will tell you which one is younger than it is.';
          return;
        }
        readout.textContent =
          joint === SOFT_JOINT
            ? `Course ${joint}: pale, sandy, and the point of a knife goes in a quarter inch. Portland cement. Modern. SOFT.`
            : `Course ${joint}: black ash mortar, hard as the brick either side of it. 1811. HARD.`;
      };

      for (const joint of wall.querySelectorAll<HTMLButtonElement>('.tr-joint')) {
        const n = Number(joint.dataset.joint);
        joint.addEventListener('pointerenter', () => describe(n), { signal: rig.signal });
        joint.addEventListener('focus', () => describe(n), { signal: rig.signal });
        joint.addEventListener('pointerleave', () => describe(null), { signal: rig.signal });
        joint.addEventListener('blur', () => describe(null), { signal: rig.signal });
        joint.addEventListener(
          'click',
          () => {
            seated = n;
            persist({ seated });
            ctx.feedback('click');
            for (const other of wall.querySelectorAll('.tr-joint')) {
              other.classList.toggle('is-seated', other === joint);
            }
            wallPanel.classList.add('is-armed');
            describe(null);
            ctx.note(
              n === SOFT_JOINT
                ? 'Bar in to the shoulder, and it goes in like it was waiting.'
                : 'Bar in. It will not go past half an inch, and it should not.',
            );
          },
          { signal: rig.signal },
        );
      }

      const release = () => {
        if (!holding) return;
        holding = false;
        grip.classList.remove('is-hauling');
        const inBand = power >= BAND[0] && power <= BAND[1];
        const good = inBand && seated === SOFT_JOINT;
        if (!seated) {
          ctx.feedback('bad');
          ctx.note('Nothing to pull against. Seat the bar in a joint first.');
        } else if (seated !== SOFT_JOINT) {
          // The design is explicit: the wrong joint costs nothing but effort.
          ctx.feedback('bad');
          ctx.note('The bar skids out of 1811 mortar and takes a flake of glaze with it. No progress, no harm.');
        } else if (!inBand) {
          ctx.feedback('bad');
          ctx.note(
            power < BAND[0]
              ? 'Not enough on it. The brick sits exactly where it has sat since June 1975.'
              : 'Too much, too fast — the bar bends and the brick stays. Steady weight, not a heave.',
          );
        } else {
          pulls = Math.min(PULLS_NEEDED, pulls + 1);
          persist({ pulls });
          ctx.feedback('good');
          paintCourses();
          if (pulls >= PULLS_NEEDED) {
            ctx.note('Nine courses of 1975 lying in the mud, and a Portland stone opening behind them.');
            rig.after(reduced() ? 80 : 900, () => stages.go(1, true));
          } else {
            ctx.note(`Course out. ${PULLS_NEEDED - pulls} to go, and the same weight each time.`);
          }
        }
        power = 0;
        rising = true;
        gaugeFill.style.setProperty('--p', '0');
      };

      const grab = (ev: Event) => {
        if (pulls >= PULLS_NEEDED) return;
        ev.preventDefault();
        if (holding) return;
        holding = true;
        power = 0;
        rising = true;
        grip.classList.add('is-hauling');
        ctx.feedback('click');
      };

      grip.addEventListener('pointerdown', grab, { signal: rig.signal });
      grip.addEventListener('pointerup', release, { signal: rig.signal });
      grip.addEventListener('pointerleave', release, { signal: rig.signal });
      grip.addEventListener('pointercancel', release, { signal: rig.signal });
      grip.addEventListener(
        'keydown',
        (ev: KeyboardEvent) => {
          if (ev.key !== ' ' && ev.key !== 'Enter') return;
          if (ev.repeat) {
            ev.preventDefault();
            return;
          }
          ev.stopPropagation();
          grab(ev);
        },
        { signal: rig.signal },
      );
      grip.addEventListener(
        'keyup',
        (ev: KeyboardEvent) => {
          if (ev.key !== ' ' && ev.key !== 'Enter') return;
          ev.stopPropagation();
          release();
        },
        { signal: rig.signal },
      );

      // The strain gauge. It climbs while held and falls back over the top, so
      // there is a right moment rather than a right button.
      rig.loop((dt) => {
        if (!holding) return;
        const speed = dt / 1500;
        power += rising ? speed : -speed;
        if (power >= 1) {
          power = 1;
          rising = false;
        }
        if (power <= 0) {
          power = 0;
          rising = true;
        }
        gaugeFill.style.setProperty('--p', power.toFixed(3));
        gaugeTrack.classList.toggle('is-in-band', power >= BAND[0] && power <= BAND[1]);
      });

      paintCourses();
      describe(null);
      if (seated) {
        wall.querySelector(`.tr-joint[data-joint="${seated}"]`)?.classList.add('is-seated');
        wallPanel.classList.add('is-armed');
      }

      // =====================================================================
      // Stage II — TO SET GOING
      // =====================================================================
      const setStage = h('div', 'tr-set-stage');
      stages.add(setStage);

      const machine = h('div', 'tr-machine');
      machine.append(
        h('span', 'tr-mach-case'),
        h('span', 'tr-mach-weight'),
        h('span', 'tr-mach-drum'),
        h('span', 'tr-mach-paper'),
        h('span', 'tr-mach-pen'),
        h('span', 'tr-mach-clutch'),
        h('span', 'tr-mach-clock'),
        h('span', 'tr-mach-trace'),
      );
      const machineWrap = h('div', 'tr-machine-wrap');
      machineWrap.append(machine, caption('Kelvin & White tide gauge, 1908'));

      // The instruction plate is under sixty years of salt. Scrub it.
      const plateWrap = h('div', 'tr-saltplate');
      const plateText = plate('Kelvin & White, Glasgow — To set going', MARIGRAPH_OPS.map(
        (op, i) => `${i + 1}. ${op.label}.`,
      ));
      const salt = h('canvas', 'tr-salt');
      const scrubHint = h('p', 'tr-scrub-hint', 'Sixty years of salt. Rub it off — drag across the plate, or press the wiping cloth.');
      const cloth = h('button', 'tr-cloth', 'Cloth');
      cloth.type = 'button';
      cloth.setAttribute('aria-label', 'Wipe the instruction plate with a cloth');
      plateWrap.append(plateText, salt, scrubHint, cloth);

      let saltCleared = readBool(ctx.state, 'plateWiped');
      const sctx = salt.getContext('2d');

      const paintSalt = () => {
        if (!sctx) return;
        const r = plateWrap.getBoundingClientRect();
        if (r.width < 2) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        salt.width = Math.round(r.width * dpr);
        salt.height = Math.round(r.height * dpr);
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.globalCompositeOperation = 'source-over';
        sctx.clearRect(0, 0, r.width, r.height);
        const g = sctx.createLinearGradient(0, 0, r.width, r.height);
        g.addColorStop(0, 'rgba(226, 222, 205, 0.97)');
        g.addColorStop(0.45, 'rgba(196, 194, 178, 0.99)');
        g.addColorStop(1, 'rgba(168, 170, 158, 0.98)');
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, r.width, r.height);
        // Bloom: salt does not dry flat, it dries in rings.
        for (let i = 0; i < 90; i++) {
          const x = Math.random() * r.width;
          const y = Math.random() * r.height;
          const rad = 3 + Math.random() * 16;
          sctx.beginPath();
          sctx.arc(x, y, rad, 0, Math.PI * 2);
          sctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
          sctx.fill();
        }
        sctx.globalCompositeOperation = 'destination-out';
      };

      const scrubAt = (cx: number, cy: number) => {
        if (!sctx || saltCleared) return;
        const r = salt.getBoundingClientRect();
        sctx.beginPath();
        sctx.arc(cx - r.left, cy - r.top, 26, 0, Math.PI * 2);
        sctx.fill();
        scrubbed += 1;
        if (scrubbed > 34) clearSalt();
      };

      let scrubbed = 0;
      const clearSalt = () => {
        if (saltCleared) return;
        saltCleared = true;
        salt.classList.add('is-gone');
        scrubHint.remove();
        cloth.remove();
        persist({ plateWiped: true });
        ctx.feedback('good');
        ctx.note('Wiped, and the numbered list under TO SET GOING is perfectly legible.');
      };

      let scrubbing = false;
      salt.addEventListener(
        'pointerdown',
        (ev: PointerEvent) => {
          ev.preventDefault();
          scrubbing = true;
          salt.setPointerCapture(ev.pointerId);
          ctx.feedback('tick');
          scrubAt(ev.clientX, ev.clientY);
        },
        { signal: rig.signal },
      );
      salt.addEventListener(
        'pointermove',
        (ev: PointerEvent) => {
          if (scrubbing) scrubAt(ev.clientX, ev.clientY);
        },
        { signal: rig.signal },
      );
      const stopScrub = () => {
        scrubbing = false;
      };
      salt.addEventListener('pointerup', stopScrub, { signal: rig.signal });
      salt.addEventListener('pointercancel', stopScrub, { signal: rig.signal });
      cloth.addEventListener(
        'click',
        () => {
          ctx.feedback('tick');
          if (!sctx) return clearSalt();
          const r = salt.getBoundingClientRect();
          for (let i = 0; i < 14; i++) {
            scrubAt(r.left + Math.random() * r.width, r.top + Math.random() * r.height);
          }
        },
        { signal: rig.signal },
      );

      const rack = h('div', 'tr-rack');
      rack.setAttribute('role', 'group');
      rack.setAttribute('aria-label', 'Operations, in no particular order');
      const column = h('ol', 'tr-sequence');
      column.setAttribute('aria-label', 'Operations performed');

      const doneOps = new Set(readStrings(ctx.state, 'ops'));
      const cards = new Map<string, HTMLElement>();

      const opOrder = () => MARIGRAPH_OPS.filter((op) => doneOps.has(op.id)).length;

      const paintMachine = () => {
        for (const op of MARIGRAPH_OPS) machine.classList.toggle(`has-${op.id}`, doneOps.has(op.id));
        machine.classList.toggle('is-running', doneOps.size === MARIGRAPH_OPS.length);
      };

      const perform = (id: string) => {
        if (doneOps.has(id)) return;
        const nextIdx = opOrder();
        const expected = MARIGRAPH_OPS[nextIdx];
        const card = cards.get(id);
        if (!expected || expected.id !== id) {
          ctx.feedback('bad');
          card?.classList.remove('is-refused');
          void card?.offsetWidth;
          card?.classList.add('is-refused');
          ctx.note('Out of order, and the pen stays dry. The plate numbers them for a reason.');
          return;
        }
        doneOps.add(id);
        persist({ ops: [...doneOps] });
        ctx.feedback('good');
        card?.remove();
        const row = h('li', 'tr-seq-row');
        row.append(
          h('span', 'tr-seq-num', String(nextIdx + 1)),
          h('span', 'tr-seq-label', expected.label),
          h('span', 'tr-seq-done', expected.done),
        );
        column.appendChild(row);
        paintMachine();
        ctx.note(expected.done);
        if (doneOps.size === MARIGRAPH_OPS.length) {
          ctx.note('It is writing. Which is the only reason I am entitled to believe the old drums.');
          rig.after(reduced() ? 80 : 1400, () => stages.go(2, true));
        }
      };

      // The rack is shuffled deterministically — the same wrong-looking order
      // every time, so a player who reopens the bench is not re-learning it.
      const rackOrder = [3, 0, 5, 2, 4, 1];
      for (const i of rackOrder) {
        const op = MARIGRAPH_OPS[i];
        if (doneOps.has(op.id)) continue;
        const card = h('div', 'tr-op');
        card.append(h('span', 'tr-op-grip'), h('span', 'tr-op-label', op.label));
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute(
          'aria-label',
          `${op.label}. Drag onto the machine, or press Enter to perform it.`,
        );
        cards.set(op.id, card);
        rack.appendChild(card);

        rig.keep(
          makeDraggable(card, {
            bounds: setStage,
            label: op.label,
            feedback: ctx.feedback,
            onDrop: (p) => {
              const r = card.getBoundingClientRect();
              const m = machine.getBoundingClientRect();
              const over =
                r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top;
              if (over) perform(op.id);
              if (!over || doneOps.has(op.id) === false) {
                // Springs back whether it was wrong or merely dropped short.
                if (card.isConnected && (p.x !== 0 || p.y !== 0)) {
                  card.classList.add('is-returning');
                  rig.after(240, () => card.classList.remove('is-returning'));
                }
              }
            },
          }),
        ).set({ x: 0, y: 0 }, true);

        card.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            ev.stopPropagation();
            perform(op.id);
          },
          { signal: rig.signal },
        );
      }

      for (let i = 0; i < MARIGRAPH_OPS.length; i++) {
        const op = MARIGRAPH_OPS[i];
        if (!doneOps.has(op.id)) break;
        const row = h('li', 'tr-seq-row');
        row.append(
          h('span', 'tr-seq-num', String(i + 1)),
          h('span', 'tr-seq-label', op.label),
          h('span', 'tr-seq-done', op.done),
        );
        column.appendChild(row);
      }
      paintMachine();

      const setLeft = h('div', 'tr-set-left');
      setLeft.append(plateWrap, rack);
      const setRight = h('div', 'tr-set-right');
      setRight.append(machineWrap, column);
      setStage.append(setLeft, setRight);

      // =====================================================================
      // Stage III — drum 1974/44 against the Admiralty prediction
      // =====================================================================
      const drumStage = h('div', 'tr-drum-stage');
      stages.add(drumStage);

      const chart = h('div', 'tr-chart');
      const base = svg('svg', 'tr-chart-svg');
      attrs(base, { viewBox: '0 0 1000 430', preserveAspectRatio: 'none', 'aria-hidden': 'true' });

      const X = (m: number) => 52 + ((m - T0) / (T1 - T0)) * 926;
      const Y = (h_: number) => 386 - (h_ / 5) * 344;

      const grid = svg('g', 'tr-grid');
      for (let m = T0; m <= T1; m += 60) {
        const line = svg('line');
        attrs(line, { x1: X(m), y1: 42, x2: X(m), y2: 386 });
        line.setAttribute('class', m % 360 === 0 ? 'tr-grid-major' : 'tr-grid-minor');
        grid.appendChild(line);
        if (m % 120 === 0) {
          const t = svg('text', 'tr-grid-label');
          attrs(t, { x: X(m), y: 406, 'text-anchor': 'middle' });
          t.textContent = hhmm(m);
          grid.appendChild(t);
        }
      }
      for (let mtr = 0; mtr <= 5; mtr += 1) {
        const line = svg('line', 'tr-grid-minor');
        attrs(line, { x1: 52, y1: Y(mtr), x2: 978, y2: Y(mtr) });
        grid.appendChild(line);
        const t = svg('text', 'tr-grid-label');
        attrs(t, { x: 40, y: Y(mtr) + 5, 'text-anchor': 'end' });
        t.textContent = `${mtr}m`;
        grid.appendChild(t);
      }
      base.appendChild(grid);

      const path = (fn: (m: number) => number) => {
        const pts: string[] = [];
        for (let m = T0; m <= T1; m += 4) pts.push(`${X(m).toFixed(1)},${Y(fn(m)).toFixed(1)}`);
        return pts.join(' ');
      };

      const trace = svg('polyline', 'tr-trace');
      attrs(trace, { points: path(observed), fill: 'none' });
      base.appendChild(trace);

      // Registration crosses cut into the drum paper by the instrument itself.
      for (const m of [T0 + 120, T1 - 120]) {
        const cross = svg('g', 'tr-cross');
        const a = svg('line');
        attrs(a, { x1: X(m) - 11, y1: Y(0.35), x2: X(m) + 11, y2: Y(0.35) });
        const b = svg('line');
        attrs(b, { x1: X(m), y1: Y(0.35) - 11, x2: X(m), y2: Y(0.35) + 11 });
        cross.append(a, b);
        base.appendChild(cross);
      }

      const vern = svg('g', 'tr-vernier');
      const vLine = svg('line', 'tr-vernier-line');
      const vSpan = svg('line', 'tr-vernier-span');
      const vCapA = svg('line', 'tr-vernier-cap');
      const vCapB = svg('line', 'tr-vernier-cap');
      vern.append(vLine, vSpan, vCapA, vCapB);
      base.appendChild(vern);

      chart.appendChild(base);

      // The prediction arrives on tracing paper and lands crooked.
      const sheet = h('div', 'tr-sheet');
      sheet.setAttribute('aria-roledescription', 'tracing sheet');
      const over = svg('svg', 'tr-sheet-svg');
      attrs(over, { viewBox: '0 0 1000 430', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      const pred = svg('polyline', 'tr-pred');
      attrs(pred, { points: path(predicted), fill: 'none' });
      over.appendChild(pred);
      for (const m of [T0 + 120, T1 - 120]) {
        const cross = svg('g', 'tr-cross tr-cross--sheet');
        const a = svg('line');
        attrs(a, { x1: X(m) - 11, y1: Y(0.35), x2: X(m) + 11, y2: Y(0.35) });
        const b = svg('line');
        attrs(b, { x1: X(m), y1: Y(0.35) - 11, x2: X(m), y2: Y(0.35) + 11 });
        cross.append(a, b);
        over.appendChild(cross);
      }
      const sheetLabel = h('span', 'tr-sheet-label', 'Admiralty tide tables 1974 · predicted · Ivory Sound');
      sheet.append(over, sheetLabel);
      chart.appendChild(sheet);

      let registered = readBool(ctx.state, 'registered');
      const sheetStart = registered ? { x: 0, y: 0 } : { x: 44, y: -27 };
      const sheetCtl = rig.keep(
        makeDraggable(sheet, {
          position: sheetStart,
          bounds: chart,
          step: 2,
          label: 'Predicted-tide transparency',
          feedback: ctx.feedback,
          onMove: () => testRegistration(false),
          onDrop: () => testRegistration(true),
        }),
      );

      function testRegistration(commit: boolean) {
        if (registered) return;
        const p = sheetCtl.get();
        const close = Math.abs(p.x) <= 7 && Math.abs(p.y) <= 7;
        sheet.classList.toggle('is-near', close);
        if (!close || !commit) return;
        registered = true;
        sheetCtl.set({ x: 0, y: 0 }, true);
        sheet.classList.add('is-registered');
        sheet.classList.remove('is-near');
        persist({ registered: true });
        ctx.feedback('good');
        ctx.note('Both crosses lie down together. The sheet is registered on the drum, not on the eye.');
        paintVernier();
      }

      const dials = h('div', 'tr-dials');
      const reading = h('div', 'tr-reading');
      reading.setAttribute('role', 'status');
      const rTime = h('span', 'tr-read-row');
      const rTrace = h('span', 'tr-read-row');
      const rPred = h('span', 'tr-read-row');
      const rDiff = h('span', 'tr-read-row tr-read-diff');
      reading.append(rTime, rTrace, rPred, rDiff);

      let cursor = clamp(Math.round(readNum(ctx.state, 'cursor', T0 + 180)), T0, T1);

      const vernierCtl = rig.keep(
        makeSlider({
          label: 'Vernier cursor',
          min: T0,
          max: T1,
          step: 1,
          value: cursor,
          length: '100%',
          format: (v) => hhmm(v),
          feedback: ctx.feedback,
          onChange: (v, committed) => {
            cursor = v;
            paintVernier();
            if (committed) persist({ cursor });
          },
        }),
      );

      function paintVernier() {
        const x = X(cursor);
        const yo = Y(observed(cursor));
        const yp = Y(predicted(cursor));
        attrs(vLine, { x1: x, y1: 42, x2: x, y2: 386 });
        attrs(vSpan, { x1: x, y1: yo, x2: x, y2: yp });
        attrs(vCapA, { x1: x - 9, y1: yo, x2: x + 9, y2: yo });
        attrs(vCapB, { x1: x - 9, y1: yp, x2: x + 9, y2: yp });
        vern.classList.toggle('is-live', registered);
        rTime.textContent = `3 November 1974 · ${hhmm(cursor)}`;
        if (!registered) {
          rTrace.textContent = 'Trace —';
          rPred.textContent = 'Prediction —';
          rDiff.textContent = 'The sheet is not registered. A reading off an unregistered overlay is an opinion.';
          return;
        }
        const o = observed(cursor);
        const p = predicted(cursor);
        rTrace.textContent = `Trace ${o.toFixed(2)} m`;
        rPred.textContent = `Prediction ${p.toFixed(2)} m`;
        const d = o - p;
        rDiff.textContent = `Difference ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} m · ${(o + 0.0).toFixed(2)} m over the Sowens shoal`;
      }

      const transfer = h('button', 'tr-transfer');
      transfer.type = 'button';
      transfer.append(
        h('span', 'tr-transfer-line', 'Casebook — 3.11.74, 23.04'),
        h('span', 'tr-transfer-cta', 'Transfer the reading'),
      );
      transfer.setAttribute(
        'aria-label',
        'Transfer the vernier reading into the casebook against 23:04 on 3 November 1974',
      );
      transfer.addEventListener(
        'click',
        () => {
          if (!registered) {
            ctx.feedback('bad');
            ctx.note('Register the sheet on the drum’s own crosses first.');
            return;
          }
          if (cursor !== T_TRUE) {
            ctx.feedback('bad');
            ctx.note(
              `That is ${hhmm(cursor)}. The casebook line is twenty-three oh four, and it is not going to move for me.`,
            );
            return;
          }
          const d = observed(T_TRUE) - predicted(T_TRUE);
          if (Math.abs(d - 1.4) > 0.1) {
            ctx.feedback('bad');
            return;
          }
          ctx.feedback('good');
          transfer.classList.add('is-written');
          ctx.note('One metre four above prediction. Four metres two over the Sowens shoal. The Inquiry assumed two metres eight.');
          rig.after(reduced() ? 80 : 700, () => ctx.solve());
        },
        { signal: rig.signal },
      );

      dials.append(caption('Vernier'), vernierCtl.el, reading, transfer);
      drumStage.append(chart, dials);
      paintVernier();
      if (registered) sheet.classList.add('is-registered');

      // -- assemble and resume ----------------------------------------------
      const stageHolder = h('div', 'mech-stages');
      stageHolder.append(wallStage, setStage, drumStage);
      el.appendChild(stageHolder);
      rig.watch(plateWrap, paintSalt);

      const resume =
        doneOps.size === MARIGRAPH_OPS.length ? 2 : pulls >= PULLS_NEEDED ? 1 : 0;
      stages.go(resume);
      if (!saltCleared) requestAnimationFrame(paintSalt);
      else salt.classList.add('is-gone');

      ctx.note(
        resume === 0
          ? 'Horizontal rain, and the floodlights are behind me. Nine courses in a Portland stone opening.'
          : resume === 1
            ? 'The machine, then. Nobody has wound it since June 1975.'
            : 'Drum 1974/44 on the table, and the tide tables beside it.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-switchboard — "The Night Plug-Log"
// Twelve jacks, six cord pairs, and a night clerk who wrote down cords.
// ===========================================================================

interface Jack {
  id: string;
  face: string;
  name: string;
  kind: 'ext' | 'trunk';
}

const JACKS: Jack[] = [
  { id: 'x1', face: '1', name: 'Registry counter', kind: 'ext' },
  { id: 'x2', face: '2', name: 'Warden’s Office', kind: 'ext' },
  { id: 'x3', face: '3', name: 'Accounts Office', kind: 'ext' },
  { id: 'x4', face: '4', name: 'Rolls Room', kind: 'ext' },
  { id: 'x5', face: '5', name: 'Post Room', kind: 'ext' },
  { id: 'x6', face: '6', name: 'Duplicating Room', kind: 'ext' },
  { id: 'x7', face: '7', name: 'Lamp Room', kind: 'ext' },
  { id: 'x8', face: '8', name: 'Gate lodge', kind: 'ext' },
  { id: 'x9', face: '9', name: 'Switchboard, night porter', kind: 'ext' },
  { id: 't1', face: 'T1', name: 'Trunk 1 — G.P.O. outward', kind: 'trunk' },
  { id: 't2', face: 'T2', name: 'Trunk 2 — Rossport exchange', kind: 'trunk' },
  { id: 't3', face: 'T3', name: 'Trunk 3 — Coastguard, direct wire', kind: 'trunk' },
];

interface LoggedCall {
  cord: number;
  time: string;
  duration: string;
  /** Exactly as the nineteen-year-old wrote it. */
  shorthand: string;
  ends: [string, string];
  /** Written into the casebook when the patch takes. */
  reconstruction: string;
  /** Which G.P.O. account line, if any, corroborates it from outside. */
  gpo?: string;
}

const CALLS: LoggedCall[] = [
  {
    cord: 1,
    time: '21.47',
    duration: '1 min',
    shorthand: '9 – 7 · ROUND',
    ends: ['x9', 'x7'],
    reconstruction:
      '21:47 · cord 1 · 1 min — night porter at the board to the Lamp Room. The hourly round check. Nothing whatever in it, and it proves the board was manned.',
  },
  {
    cord: 2,
    time: '22.34',
    duration: '6 min',
    shorthand: 'T3 IN – 2',
    ends: ['t3', 'x2'],
    reconstruction:
      '22:34 · cord 2 · 6 min — trunk 3 inbound, the Coastguard’s own wire, into extension 2. The Warden’s Office. On a Sunday night, in a building that was locked at six.',
  },
  {
    cord: 3,
    time: '22.41',
    duration: '4 min',
    shorthand: '2 OUT – T1 – CARDEW 4471 – N.R.',
    ends: ['x2', 't1'],
    reconstruction:
      '22:41 · cord 3 · 4 min — extension 2 outward on trunk 1 to Cardew 4471. No reply. Four minutes of no reply, which is a long time to stand listening to a bell in a call box.',
    gpo: 'gpo-cardew',
  },
  {
    cord: 4,
    time: '23.06',
    duration: '8 min',
    shorthand: 'T? IN – 2 – RELAY',
    ends: ['t3', 'x2'],
    reconstruction:
      '23:06 · cord 4 · 8 min — inbound again on the Coastguard’s direct wire, extension 2. The relay. Trunk 2 was carrying the harbourmaster at eleven past, so it cannot have been that one.',
  },
  {
    cord: 5,
    time: '23.11',
    duration: '2 min',
    shorthand: '2 OUT – T2 – HARBOURMASTER',
    ends: ['x2', 't2'],
    reconstruction:
      '23:11 · cord 5 · 2 min — extension 2 outward on trunk 2, the harbourmaster at Rossport. Two minutes, over the top of a call that was already running.',
  },
  {
    cord: 6,
    time: '23.19',
    duration: '6 min',
    shorthand: 'AS BEFORE – T2 – ROSSPORT',
    ends: ['x2', 't2'],
    reconstruction:
      '23:19 · cord 6 · 6 min — “as before”, which in this girl’s hand means the same extension as the entry above. Extension 2, outward on trunk 2, to Rossport.',
    gpo: 'gpo-rossport',
  },
];

const DIRECTORY: [string, string][] = [
  ['Extension 1', 'Registry counter (public hours only)'],
  ['Extension 2', 'Warden’s Office'],
  ['Extension 3', 'Accounts Office — Miss Charnock'],
  ['Extension 4', 'Rolls Room'],
  ['Extension 5', 'Post Room'],
  ['Extension 6', 'Duplicating Room'],
  ['Extension 7', 'Lamp Room and stores'],
  ['Extension 8', 'Gate lodge'],
  ['Extension 9', 'Switchboard'],
  ['Trunk 1', 'G.P.O. outward. All charged calls.'],
  ['Trunk 2', 'Rossport exchange.'],
  ['Trunk 3', 'H.M. Coastguard, Rossport. Direct wire, not through the exchange.'],
  ['Cardew 4471', 'Call box, P.O., for the relief boatman. — pencil, in another hand'],
];

const ROSTER: [string, string][] = [
  ['18.00', 'Building secured. Registry, Accounts, Post Room and Duplicating dark.'],
  ['18.00–06.00', 'Night porter at the gate lodge and the board. Rounds on the hour.'],
  ['Sunday 3.11.74', 'No officer rostered. Warden’s Office not manned.'],
  ['Relief keeper', 'Ashore at Cardew, on call. Telephone: the box outside the Post Office.'],
];

const GPO_LINES: { id: string; text: string }[] = [
  { id: 'gpo-cardew', text: '3.11.74 · CARDEW · 22.41 · 4 min · 1s 9d · init. E.C.' },
  { id: 'gpo-rossport', text: '3.11.74 · ROSSPORT · 23.19 · 6 min · 2s 3d · init. E.C.' },
];

function switchboard(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'mech-switchboard');

      // -- the board ---------------------------------------------------------
      const board = h('div', 'sb-board');
      const field = h('div', 'sb-field');
      const extRow = h('div', 'sb-row sb-row--ext');
      const trunkRow = h('div', 'sb-row sb-row--trunk');
      const jackEls = new Map<string, HTMLElement>();

      for (const jack of JACKS) {
        const j = h('div', 'sb-jack');
        j.dataset.jack = jack.id;
        j.append(h('span', 'sb-jack-hole'), h('span', 'sb-jack-face', jack.face));
        const label = h('span', 'sb-jack-name', jack.name);
        j.appendChild(label);
        j.setAttribute('aria-hidden', 'true');
        jackEls.set(jack.id, j);
        (jack.kind === 'ext' ? extRow : trunkRow).appendChild(j);
      }
      field.append(caption('Internal extensions'), extRow, caption('Trunks'), trunkRow);

      const cordShelf = h('div', 'sb-shelf');
      const lampField = h('div', 'sb-lamps');
      const cordSvg = svg('svg', 'sb-cords');
      cordSvg.setAttribute('aria-hidden', 'true');

      board.append(field, cordShelf, lampField, cordSvg);

      // -- state -------------------------------------------------------------
      interface Cord {
        n: number;
        a: HTMLElement;
        b: HTMLElement;
        ctlA: Control<{ x: number; y: number }>;
        ctlB: Control<{ x: number; y: number }>;
        key: Control<boolean>;
        lamp: HTMLElement;
        seated: [string | null, string | null];
        path: SVGPathElement;
      }

      const cords: Cord[] = [];
      const done = new Set<number>(readNums(ctx.state, 'calls'));
      const matched = new Map<string, number>();
      for (const [k, v] of Object.entries(
        (ctx.state.gpo as Record<string, unknown> | undefined) ?? {},
      )) {
        if (typeof v === 'number') matched.set(k, v);
      }

      const persist = () => {
        ctx.state.calls = [...done];
        ctx.state.gpo = Object.fromEntries(matched);
        ctx.save();
      };

      /** Which jack, if any, is holding a plug — a hole takes one plug only. */
      const occupant = (jackId: string, exclude?: HTMLElement): boolean =>
        cords.some(
          (c) =>
            (c.seated[0] === jackId && c.a !== exclude) ||
            (c.seated[1] === jackId && c.b !== exclude),
        );

      const centre = (node: Element, rel: DOMRect) => {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2 - rel.left, y: r.top + r.height / 2 - rel.top };
      };

      const redraw = () => {
        const rel = board.getBoundingClientRect();
        if (rel.width < 2) return;
        cordSvg.setAttribute('width', String(rel.width));
        cordSvg.setAttribute('height', String(rel.height));
        for (const cord of cords) {
          const a = centre(cord.a, rel);
          const b = centre(cord.b, rel);
          const sag = 26 + Math.abs(a.x - b.x) * 0.16;
          const mx = (a.x + b.x) / 2;
          const my = Math.max(a.y, b.y) + sag;
          cord.path.setAttribute('d', `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`);
        }
      };

      const casebook = h('ol', 'sb-casebook');
      casebook.setAttribute('aria-label', 'Reconstructed calls');
      const caseRows = new Map<number, HTMLElement>();

      const writeCall = (call: LoggedCall) => {
        if (caseRows.has(call.cord)) return;
        const row = h('li', 'sb-case-row');
        row.dataset.cord = String(call.cord);
        row.append(
          h('span', 'sb-case-time', call.time),
          h('span', 'sb-case-text', call.reconstruction),
        );
        const dock = h('span', 'sb-dock');
        dock.dataset.dock = String(call.cord);
        dock.setAttribute('aria-hidden', 'true');
        row.appendChild(dock);
        caseRows.set(call.cord, row);
        // Keep the casebook in log order however they were reconstructed.
        const after = [...caseRows.entries()]
          .filter(([n]) => n > call.cord)
          .sort((a, b) => a[0] - b[0])[0];
        if (after) casebook.insertBefore(row, after[1]);
        else casebook.appendChild(row);
        requestAnimationFrame(() => row.classList.add('is-in'));
      };

      let coda: HTMLElement | null = null;

      const check = () => {
        if (done.size !== CALLS.length) return;
        if (!coda) buildCoda();
        if (matched.size !== GPO_LINES.length) return;
        ctx.note('Their own book, corroborated from outside the building by somebody who wrote it down for money.');
        rig.after(reduced() ? 60 : 500, () => ctx.solve());
      };

      const testCord = (cord: Cord) => {
        const call = CALLS.find((c) => c.cord === cord.n);
        if (!call || done.has(cord.n)) return;
        const [a, b] = cord.seated;
        if (!a || !b || !cord.key.get()) return;
        const want = new Set(call.ends);
        if (!want.has(a) || !want.has(b) || a === b) {
          // A wrong patch buzzes and throws itself out, the way a real board
          // does when the far end never picks up.
          ctx.feedback('bad');
          cord.lamp.classList.remove('is-buzz');
          void cord.lamp.offsetWidth;
          cord.lamp.classList.add('is-buzz');
          cord.key.set(false, true);
          unplug(cord, 0);
          unplug(cord, 1);
          ctx.note(`Dead. Nothing on the log ran between those two holes on cord ${cord.n}.`);
          return;
        }
        done.add(cord.n);
        persist();
        ctx.feedback('good');
        cord.lamp.classList.add('is-lit');
        writeCall(call);
        ctx.note(
          done.size === CALLS.length
            ? 'Six calls, and every one of them through extension 2 after the building was locked.'
            : `${done.size} of six reconstructed.`,
        );
        check();
      };

      function unplug(cord: Cord, end: 0 | 1) {
        cord.seated[end] = null;
        const ctl = end === 0 ? cord.ctlA : cord.ctlB;
        ctl.set({ x: 0, y: 0 }, true);
        (end === 0 ? cord.a : cord.b).classList.remove('is-seated');
        paintJacks();
        redraw();
      }

      const paintJacks = () => {
        for (const [id, jack] of jackEls) jack.classList.toggle('is-taken', occupant(id));
      };

      const seat = (cord: Cord, end: 0 | 1, jackId: string | null) => {
        const plug = end === 0 ? cord.a : cord.b;
        const ctl = end === 0 ? cord.ctlA : cord.ctlB;
        if (jackId === null) {
          unplug(cord, end);
          ctx.feedback('tick');
          return;
        }
        const jack = jackEls.get(jackId);
        if (!jack || occupant(jackId, plug)) {
          ctx.feedback('bad');
          ctl.set({ x: 0, y: 0 }, true);
          cord.seated[end] = null;
          plug.classList.remove('is-seated');
          paintJacks();
          redraw();
          return;
        }
        const p = plug.getBoundingClientRect();
        const j = jack.getBoundingClientRect();
        const cur = ctl.get();
        ctl.set(
          {
            x: cur.x + (j.left + j.width / 2 - (p.left + p.width / 2)),
            y: cur.y + (j.top + j.height / 2 - (p.top + p.height / 2)),
          },
          true,
        );
        cord.seated[end] = jackId;
        plug.classList.add('is-seated');
        plug.setAttribute(
          'aria-label',
          `Cord ${cord.n}, ${end === 0 ? 'answering' : 'calling'} plug — in ${JACKS.find((x) => x.id === jackId)?.name}`,
        );
        ctx.feedback('click');
        paintJacks();
        redraw();
        testCord(cord);
      };

      /** Nearest free hole to a dropped plug, or null to fall back to the shelf. */
      const nearestJack = (plug: HTMLElement): string | null => {
        const p = plug.getBoundingClientRect();
        const px = p.left + p.width / 2;
        const py = p.top + p.height / 2;
        let best: string | null = null;
        let bestD = 46;
        for (const [id, jack] of jackEls) {
          if (occupant(id, plug)) continue;
          const r = jack.getBoundingClientRect();
          const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
          if (d < bestD) {
            bestD = d;
            best = id;
          }
        }
        return best;
      };

      for (let n = 1; n <= 6; n++) {
        const pair = h('div', 'sb-pair');
        pair.style.setProperty('--n', String(n - 1));
        const lamp = h('span', 'sb-lamp');
        lamp.append(h('span', 'sb-lamp-glass'), h('span', 'sb-lamp-num', String(n)));
        lamp.setAttribute('aria-hidden', 'true');
        lampField.appendChild(lamp);

        const plugA = h('div', 'sb-plug sb-plug--a');
        const plugB = h('div', 'sb-plug sb-plug--b');
        for (const plug of [plugA, plugB]) {
          plug.append(h('span', 'sb-plug-tip'), h('span', 'sb-plug-collar'), h('span', 'sb-plug-shank'));
        }
        pair.append(plugA, plugB);

        const key = rig.keep(
          makeToggle({
            label: `Cord ${n} speaking key`,
            onLabel: 'Key thrown',
            offLabel: 'Key down',
            feedback: ctx.feedback,
            onChange: () => testCord(cord),
          }),
        );
        key.el.classList.add('sb-key');
        pair.append(key.el, h('span', 'sb-cord-num', `Cord ${n}`));
        cordShelf.appendChild(pair);

        const pathEl = svg('path', 'sb-cord');
        attrs(pathEl, { fill: 'none' });
        cordSvg.appendChild(pathEl);

        const mk = (plug: HTMLElement, end: 0 | 1) =>
          rig.keep(
            makeDraggable(plug, {
              bounds: board,
              label: `Cord ${n}, ${end === 0 ? 'answering' : 'calling'} plug`,
              feedback: ctx.feedback,
              onMove: redraw,
              onDrop: () => {
                const target = nearestJack(plug);
                if (target) seat(cord, end, target);
                else {
                  cord.seated[end] = null;
                  plug.classList.remove('is-seated');
                  (end === 0 ? cord.ctlA : cord.ctlB).set({ x: 0, y: 0 }, true);
                  paintJacks();
                  redraw();
                }
              },
            }),
          );

        const ctlA = mk(plugA, 0);
        const ctlB = mk(plugB, 1);

        const cord: Cord = {
          n,
          a: plugA,
          b: plugB,
          ctlA,
          ctlB,
          key,
          lamp,
          seated: [null, null],
          path: pathEl,
        };
        cords.push(cord);

        // Keyboard patching. Nudging a plug pixel by pixel into a hole is a
        // dexterity test nobody asked for, so the digits seat it outright.
        const bindKeys = (plug: HTMLElement, end: 0 | 1) => {
          plug.setAttribute(
            'aria-description',
            'Digits 1 to 9 seat this plug in an extension; Shift with 1, 2 or 3 seats it in a trunk; 0 pulls it out.',
          );
          plug.addEventListener(
            'keydown',
            (ev: KeyboardEvent) => {
              if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
              const m = /^Digit([0-9])$/.exec(ev.code);
              if (!m) return;
              const digit = Number(m[1]);
              ev.preventDefault();
              ev.stopPropagation();
              if (digit === 0) return seat(cord, end, null);
              if (ev.shiftKey) {
                if (digit > 3) return ctx.feedback('bad');
                return seat(cord, end, `t${digit}`);
              }
              seat(cord, end, `x${digit}`);
            },
            { signal: rig.signal },
          );
        };
        bindKeys(plugA, 0);
        bindKeys(plugB, 1);
      }

      // -- the books ---------------------------------------------------------
      const books = h('div', 'sb-books');
      const tabs = h('div', 'sb-tabs');
      tabs.setAttribute('role', 'tablist');
      const pages = h('div', 'sb-pages');

      const makeBook = (id: string, name: string, build: (page: HTMLElement) => void) => {
        const tab = h('button', 'sb-tab', name);
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.id = `sb-tab-${id}`;
        const page = h('div', 'sb-page');
        page.setAttribute('role', 'tabpanel');
        page.setAttribute('aria-labelledby', tab.id);
        page.hidden = true;
        build(page);
        tabs.appendChild(tab);
        pages.appendChild(page);
        tab.addEventListener(
          'click',
          () => {
            for (const t of tabs.children) t.classList.remove('is-on');
            for (const p of pages.children) (p as HTMLElement).hidden = true;
            tab.classList.add('is-on');
            tab.setAttribute('aria-selected', 'true');
            page.hidden = false;
            ctx.feedback('tick');
          },
          { signal: rig.signal },
        );
        return { tab, page };
      };

      const logBook = makeBook('log', 'Call log', (page) => {
        page.appendChild(h('h4', 'sb-page-head', 'Night call log · Sunday 3 November 1974'));
        const table = h('table', 'sb-log');
        const head = h('tr', '');
        for (const th of ['Time', 'Cord', 'Mins', 'Entry']) head.appendChild(h('th', '', th));
        table.appendChild(head);
        for (const call of CALLS) {
          const tr = h('tr', 'sb-log-row');
          tr.dataset.cord = String(call.cord);
          tr.append(
            h('td', 'sb-log-time', call.time),
            h('td', 'sb-log-cord', String(call.cord)),
            h('td', 'sb-log-mins', call.duration.replace(' min', '')),
            h('td', 'sb-log-note', call.shorthand),
          );
          table.appendChild(tr);
        }
        page.appendChild(table);
        page.appendChild(
          h(
            'p',
            'sb-page-foot',
            'She was nineteen and paid to be quick. Cords and minutes; never a name.',
          ),
        );
      });

      makeBook('dir', 'Directory', (page) => {
        page.appendChild(h('h4', 'sb-page-head', 'Internal directory, 1974'));
        const dl = h('dl', 'sb-dl');
        for (const [k, v] of DIRECTORY) {
          dl.append(h('dt', '', k), h('dd', '', v));
        }
        page.appendChild(dl);
      });

      makeBook('roster', 'Night roster', (page) => {
        page.appendChild(h('h4', 'sb-page-head', 'Night duty roster'));
        const dl = h('dl', 'sb-dl');
        for (const [k, v] of ROSTER) {
          dl.append(h('dt', '', k), h('dd', '', v));
        }
        page.appendChild(dl);
      });

      books.append(tabs, pages);
      logBook.tab.click();

      // -- the G.P.O. coda ---------------------------------------------------
      function buildCoda() {
        if (coda) return;
        coda = h('div', 'sb-coda');
        coda.append(
          h('h4', 'sb-page-head', 'G.P.O. itemised trunk account · Q4 1974'),
          h(
            'p',
            'sb-coda-strap',
            'From Miss Charnock’s telephone file. Somebody outside this building wrote these down for money. Lay each against the call it pays for.',
          ),
        );
        for (const line of GPO_LINES) {
          if (matched.has(line.id)) continue;
          const slip = h('div', 'sb-slip', line.text);
          slip.tabIndex = 0;
          slip.setAttribute(
            'aria-label',
            `${line.text}. Drag onto the call it corroborates, or press 1 to 6 for a logged call.`,
          );
          coda.appendChild(slip);

          const ctl = rig.keep(
            makeDraggable(slip, {
              bounds: el,
              label: line.text,
              feedback: ctx.feedback,
              onDrop: () => {
                const r = slip.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                let hit: number | null = null;
                for (const [cordN, row] of caseRows) {
                  const rr = row.getBoundingClientRect();
                  if (cx >= rr.left && cx <= rr.right && cy >= rr.top && cy <= rr.bottom) {
                    hit = cordN;
                  }
                }
                if (hit === null) {
                  ctl.set({ x: 0, y: 0 }, true);
                  return;
                }
                tryMatch(line.id, hit, slip, ctl);
              },
            }),
          );

          slip.addEventListener(
            'keydown',
            (ev: KeyboardEvent) => {
              const m = /^Digit([1-6])$/.exec(ev.code);
              if (!m) return;
              ev.preventDefault();
              ev.stopPropagation();
              tryMatch(line.id, Number(m[1]), slip, ctl);
            },
            { signal: rig.signal },
          );
        }
        el.appendChild(coda);
        ctx.note('Six calls reconstructed. Now find somebody outside this building who wrote it down for money.');
      }

      function tryMatch(
        lineId: string,
        cordN: number,
        slip: HTMLElement,
        ctl: Control<{ x: number; y: number }>,
      ) {
        const call = CALLS.find((c) => c.cord === cordN);
        if (!call || call.gpo !== lineId) {
          ctx.feedback('bad');
          ctl.set({ x: 0, y: 0 }, true);
          slip.classList.remove('is-refused');
          void slip.offsetWidth;
          slip.classList.add('is-refused');
          ctx.note('That is not the call this account is paying for. Check the minute and the duration.');
          return;
        }
        matched.set(lineId, cordN);
        persist();
        ctx.feedback('good');
        ctl.destroy();
        slip.remove();
        const dock = caseRows.get(cordN)?.querySelector<HTMLElement>('.sb-dock');
        if (dock) {
          dock.textContent = GPO_LINES.find((g) => g.id === lineId)?.text ?? '';
          dock.classList.add('is-docketed');
          dock.removeAttribute('aria-hidden');
        }
        check();
      }

      // -- restore -----------------------------------------------------------
      for (const call of CALLS) if (done.has(call.cord)) writeCall(call);
      for (const cord of cords) {
        if (!done.has(cord.n)) continue;
        const call = CALLS.find((c) => c.cord === cord.n);
        if (!call) continue;
        cord.lamp.classList.add('is-lit');
        cord.key.set(true, true);
        // Seat both ends after layout, so the measurements are real.
        requestAnimationFrame(() => {
          if (rig.closed) return;
          seat(cord, 0, call.ends[0]);
          seat(cord, 1, call.ends[1]);
        });
      }
      for (const [lineId, cordN] of matched) {
        const dock = caseRows.get(cordN)?.querySelector<HTMLElement>('.sb-dock');
        if (dock) {
          dock.textContent = GPO_LINES.find((g) => g.id === lineId)?.text ?? '';
          dock.classList.add('is-docketed');
          dock.removeAttribute('aria-hidden');
        }
      }

      const legend = h(
        'p',
        'sb-legend',
        'Drag a plug into a hole; throw that cord’s key to listen. Keyboard: with a plug focused, 1–9 for an extension, Shift 1–3 for a trunk, 0 to pull it out.',
      );

      const left = h('div', 'sb-left');
      left.append(board, legend);
      const right = h('div', 'sb-right');
      right.append(books, casebook);
      el.append(left, right);

      rig.watch(board, redraw);
      requestAnimationFrame(redraw);
      if (done.size === CALLS.length) rig.after(60, buildCoda);
      paintJacks();

      ctx.note('Twelve holes, six cords, and everything that happened in this building that night went through them.');
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================
// puz-the-optic — "First Light"
// The lantern room at dawn. The one thing in the game that is not evidence.
// ===========================================================================

/** Degrees the governor turns in one second. One revolution in twenty. */
const DEG_PER_SEC = 18;
const CLIP_COUNT = 6;
/** Turns of the crank between the weight on the floor and full fall. */
const FULL_WIND = 2880;

function theOptic(): PuzzleModule {
  const rig = new Rig();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const el = bench(root, 'mech-optic');
      const stages = new Stages(['Seat the panel', 'Set the character', 'Wind and set']);

      const head = h('div', 'op-head');
      head.append(
        plate('Chance Brothers, Birmingham · 1908 · Maintenance', [
          'One revolution in twenty seconds. Eighteen degrees the second.',
          'Bolts to be set in opposed pairs.',
          'The first sector plate to stand at the datum mark.',
        ]),
        stages.el,
      );

      // -- the optic itself, present in every stage --------------------------
      const ring = h('div', 'op-ring');
      const frame = h('div', 'op-frame');
      for (let i = 0; i < 10; i++) {
        const seg = h('span', 'op-frame-seg');
        seg.style.setProperty('--a', `${i * 36}deg`);
        frame.appendChild(seg);
      }
      const bay = h('div', 'op-bay');
      const datum = h('span', 'op-datum');
      datum.setAttribute('aria-hidden', 'true');
      const beam = h('span', 'op-beam');
      beam.setAttribute('aria-hidden', 'true');
      ring.append(frame, bay, datum, beam, h('span', 'op-burner'));

      // -- stage I: the panel -------------------------------------------------
      const seatStage = h('div', 'op-seat-stage');
      stages.add(seatStage);

      let seated = readBool(ctx.state, 'seated');
      const panelHolder = h('div', 'op-panel-holder');
      const panel = h('div', 'op-panel');
      const panelSpin = h('div', 'op-panel-spin');
      for (let i = 0; i < 9; i++) panelSpin.appendChild(h('span', 'op-prism'));
      panelSpin.append(h('span', 'op-panel-bull'));
      panel.appendChild(panelSpin);
      panel.setAttribute('aria-roledescription', 'Fresnel panel');
      panelHolder.appendChild(panel);

      const collar = h('div', 'op-collar');
      collar.append(h('span', 'op-collar-bar'), caption('Turn'));

      let panelAngle = 0;
      const collarCtl = rig.keep(
        makeRotatable(collar, {
          angle: 0,
          detent: 5,
          min: -90,
          max: 90,
          label: 'Fresnel panel — rotation collar',
          feedback: ctx.feedback,
          onChange: (deg) => {
            panelAngle = deg;
            panelSpin.style.setProperty('--panel-rot', `${deg}deg`);
            testSeat(false);
          },
          onCommit: () => testSeat(true),
        }),
      );

      const panelCtl = rig.keep(
        makeDraggable(panel, {
          bounds: seatStage,
          step: 4,
          label: 'Fresnel panel — carry it to the frame',
          feedback: ctx.feedback,
          onMove: () => testSeat(false),
          onDrop: () => testSeat(true),
        }),
      );

      const clipRing = h('div', 'op-clips');
      const clipEls: HTMLButtonElement[] = [];
      const fastened: number[] = readNums(ctx.state, 'clips');

      function testSeat(commit: boolean) {
        if (seated) return;
        const p = panel.getBoundingClientRect();
        const b = bay.getBoundingClientRect();
        const dx = p.left + p.width / 2 - (b.left + b.width / 2);
        const dy = p.top + p.height / 2 - (b.top + b.height / 2);
        const near = Math.hypot(dx, dy) < 34 && Math.abs(panelAngle) <= 5;
        panel.classList.toggle('is-near', near);
        if (!near || !commit) return;
        seated = true;
        ctx.state.seated = true;
        ctx.save();
        panel.classList.remove('is-near');
        panel.classList.add('is-seated');
        panelCtl.destroy();
        collarCtl.destroy();
        collar.remove();
        bay.appendChild(panel);
        panel.style.removeProperty('--drag-x');
        panel.style.removeProperty('--drag-y');
        panelSpin.style.setProperty('--panel-rot', '0deg');
        ctx.feedback('good');
        ctx.note('The lands register, all four of them, and it takes its own weight. Now the clips, and not round the ring.');
        clipRing.hidden = false;
        clipEls[0]?.focus({ preventScroll: true });
      }

      // Six clips at sixty degrees. The strain model is the real instruction
      // plate: fasten two that are not opposite one another and the glass
      // bows, because that is what glass does.
      clipRing.hidden = true;
      clipRing.setAttribute('role', 'group');
      clipRing.setAttribute('aria-label', 'Six bronze clips');
      for (let i = 0; i < CLIP_COUNT; i++) {
        const clip = h('button', 'op-clip');
        clip.type = 'button';
        clip.style.setProperty('--a', `${i * 60}deg`);
        clip.append(h('span', 'op-clip-jaw'), h('span', 'op-clip-num', String(i + 1)));
        clip.setAttribute('aria-label', `Clip ${i + 1}`);
        clipEls.push(clip);
        clipRing.appendChild(clip);
        clip.addEventListener('click', () => fasten(i), { signal: rig.signal });
      }
      ring.appendChild(clipRing);

      let cracks = 0;

      const strain = (set: number[]) => {
        let x = 0;
        let y = 0;
        for (const i of set) {
          const a = (i * 60 * Math.PI) / 180;
          x += Math.cos(a);
          y += Math.sin(a);
        }
        return Math.hypot(x, y) / Math.max(1, set.length);
      };

      const paintClips = () => {
        clipEls.forEach((c, i) => {
          const on = fastened.includes(i);
          c.classList.toggle('is-fast', on);
          c.setAttribute('aria-pressed', String(on));
        });
        const s = fastened.length ? strain(fastened) : 0;
        panel.style.setProperty('--bow', (fastened.length % 2 === 0 ? s : s * 0.35).toFixed(3));
      };

      function fasten(i: number) {
        if (!seated || fastened.includes(i) || panel.classList.contains('is-cracked')) return;
        fastened.push(i);
        ctx.feedback('click');
        paintClips();
        // Judged on even counts: a pair either opposes or it does not.
        if (fastened.length % 2 === 0 && strain(fastened) > 0.28) {
          crack();
          return;
        }
        ctx.state.clips = [...fastened];
        ctx.save();
        if (fastened.length === CLIP_COUNT) {
          ctx.feedback('good');
          clipRing.classList.add('is-done');
          ctx.note('Six clips, three opposed pairs, and the panel is dead flat against the lands.');
          rig.after(reduced() ? 80 : 800, () => stages.go(1, true));
        } else if (fastened.length % 2 === 0) {
          ctx.note(`${fastened.length} of six, and the glass has not moved a thousandth.`);
        }
      }

      function crack() {
        cracks += 1;
        ctx.feedback('bad');
        panel.classList.add('is-bowing');
        rig.after(reduced() ? 60 : 520, () => {
          panel.classList.remove('is-bowing');
          panel.classList.add('is-cracked');
          ctx.note(
            cracks === 1
              ? 'A sound like a knuckle. One clip too far round the ring, and eight hundred pounds of somebody else’s money has a hairline through it.'
              : 'Again. Opposed pairs. One, then the one facing it, and then the next pair.',
          );
          rig.after(reduced() ? 80 : 2600, () => {
            fastened.length = 0;
            ctx.state.clips = [];
            ctx.save();
            panel.classList.remove('is-cracked');
            paintClips();
            ctx.note('Ivo Sandbach turns the spare over in the fleece and hands it to me without a word.');
          });
        });
      }

      const seatCue = h('p', 'op-cue');
      seatCue.textContent =
        'Carry the panel into the bay and bring it upright with the collar. Then the clips, in opposed pairs.';
      seatStage.append(panelHolder, collar, seatCue);

      // -- stage II: the character -------------------------------------------
      const charStage = h('div', 'op-char-stage');
      stages.add(charStage);

      const sectorAngles: number[] = [0, 0, 0];
      const stored = readNums(ctx.state, 'sectors');
      for (let i = 0; i < 3; i++) sectorAngles[i] = stored[i] ?? [15, 84, 200][i];

      const sectorLayer = h('div', 'op-sectors');
      sectorLayer.setAttribute('role', 'group');
      sectorLayer.setAttribute('aria-label', 'Three occulting sector plates');
      const sectorCtls: Control<number>[] = [];
      for (let i = 0; i < 3; i++) {
        const plateEl = h('div', 'op-sector');
        plateEl.append(h('span', 'op-sector-arm'), h('span', 'op-sector-window'), h('span', 'op-sector-num', String(i + 1)));
        plateEl.setAttribute('role', 'spinbutton');
        plateEl.setAttribute('aria-valuemin', '0');
        plateEl.setAttribute('aria-valuemax', '359');
        plateEl.setAttribute(
          'aria-description',
          'Arrow keys move one degree. Page Up and Page Down move six.',
        );
        sectorLayer.appendChild(plateEl);

        const ctl = rig.keep(
          makeRotatable(plateEl, {
            angle: sectorAngles[i],
            detent: 1,
            label: `Sector plate ${i + 1}`,
            feedback: ctx.feedback,
            onChange: (deg) => {
              sectorAngles[i] = ((deg % 360) + 360) % 360;
              plateEl.setAttribute('aria-valuenow', String(Math.round(sectorAngles[i])));
              plateEl.setAttribute('aria-valuetext', `${Math.round(sectorAngles[i])} degrees`);
              paintCharacter();
            },
            onCommit: () => {
              ctx.state.sectors = [...sectorAngles];
              ctx.save();
              paintCharacter();
            },
          }),
        );
        sectorCtls.push(ctl);

        plateEl.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            let d = 0;
            if (ev.key === 'PageUp') d = 6;
            else if (ev.key === 'PageDown') d = -6;
            else return;
            ev.preventDefault();
            ev.stopPropagation();
            ctl.set(sectorAngles[i] + d, false);
            ctx.feedback('tick');
          },
          { signal: rig.signal },
        );
      }
      ring.appendChild(sectorLayer);

      const observer = h('div', 'op-observer');
      const sea = h('div', 'op-sea');
      const spark = h('span', 'op-spark');
      sea.append(spark, h('span', 'op-horizon'));
      const stopwatch = h('p', 'op-stopwatch');
      stopwatch.setAttribute('role', 'status');
      const named = h('p', 'op-named');
      const listExtract = h('table', 'op-list');
      const lhead = h('tr', '');
      for (const t of ['Light', 'Character', 'Flashes']) lhead.appendChild(h('th', '', t));
      listExtract.appendChild(lhead);
      for (const [name, ch, sp] of [
        ['Nine Bells', 'Fl(3) W 20s', 'two seconds apart'],
        ['Cadran Point', 'Fl(3) W 15s', 'a second and a half apart'],
      ]) {
        const tr = h('tr', '');
        tr.append(h('td', '', name), h('td', '', ch), h('td', '', sp));
        listExtract.appendChild(tr);
      }
      observer.append(
        caption('From nine miles out'),
        sea,
        stopwatch,
        named,
        caption('Admiralty List of Lights 1974 · Ivory Sound'),
        listExtract,
      );
      charStage.appendChild(observer);

      const sorted = () => [...sectorAngles].map((a) => Math.round(a)).sort((a, b) => a - b);

      const charactersRight = () => {
        const s = sorted();
        return (
          Math.abs(s[0] - 0) <= 1 && Math.abs(s[1] - 36) <= 1 && Math.abs(s[2] - 72) <= 1
        );
      };

      function paintCharacter() {
        const s = sorted();
        const g1 = (s[1] - s[0]) / DEG_PER_SEC;
        const g2 = (s[2] - s[1]) / DEG_PER_SEC;
        stopwatch.textContent = `Three flashes at ${(s[0] / DEG_PER_SEC).toFixed(1)} s, ${(s[1] / DEG_PER_SEC).toFixed(1)} s and ${(s[2] / DEG_PER_SEC).toFixed(1)} s. One revolution in twenty.`;
        const even = Math.abs(g1 - g2) < 0.12;
        if (even && Math.abs(g1 - 2) < 0.08 && s[0] <= 1) {
          named.textContent = 'Fl(3) W 20s — NINE BELLS.';
          named.dataset.match = 'true';
        } else if (even && Math.abs(g1 - 1.5) < 0.1) {
          named.textContent = 'Fl(3) W 15s — CADRAN POINT. Nine miles south-south-east, and it has never once been wrong.';
          named.dataset.match = 'wrong';
        } else if (s[0] > 1 && even && Math.abs(g1 - 2) < 0.08) {
          named.textContent = 'The spacing is right; the first plate is off the datum, so the release will not put the first flash on the second.';
          named.dataset.match = 'near';
        } else {
          named.textContent = 'No light on this coast shows that.';
          named.dataset.match = 'none';
        }
        for (let i = 0; i < 3; i++) {
          sectorLayer.children[i].setAttribute('style', `--a:${sectorAngles[i]}deg`);
        }
        check();
      }

      // -- stage III: wind and set -------------------------------------------
      const windStage = h('div', 'op-wind-stage');
      stages.add(windStage);

      let wind = clamp(readNum(ctx.state, 'wind', 0), 0, FULL_WIND);
      const shaft = h('div', 'op-shaft');
      const weight = h('span', 'op-weight');
      shaft.append(weight, h('span', 'op-shaft-scale'));
      const crank = h('div', 'op-crank');
      crank.append(h('span', 'op-crank-arm'), h('span', 'op-crank-handle'));
      crank.setAttribute('role', 'spinbutton');
      crank.setAttribute('aria-valuemin', '0');
      crank.setAttribute('aria-valuemax', '100');
      const windRead = h('p', 'op-wind-read');
      windRead.setAttribute('role', 'status');

      const paintWind = () => {
        const frac = wind / FULL_WIND;
        shaft.style.setProperty('--fall', frac.toFixed(3));
        crank.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
        crank.setAttribute('aria-valuetext', `${Math.round(frac * 100)} per cent of the fall`);
        windRead.textContent =
          frac >= 1
            ? 'Wound to full fall. Eight turns, and the gut line is hard up under the pulley.'
            : `${Math.round(frac * 100)} per cent of the fall. Keep cranking.`;
      };

      const crankCtl = rig.keep(
        makeRotatable(crank, {
          angle: wind,
          detent: 30,
          min: 0,
          max: FULL_WIND,
          label: 'Winding crank',
          feedback: ctx.feedback,
          onChange: (deg) => {
            wind = deg;
            paintWind();
            check();
          },
          onCommit: () => {
            ctx.state.wind = wind;
            ctx.save();
          },
        }),
      );
      void crankCtl;

      let hour = clamp(Math.round(readNum(ctx.state, 'hour', 12)), 0, 23);
      let minute = clamp(Math.round(readNum(ctx.state, 'minute', 0)), 0, 59);

      const hourDial = rig.keep(
        makeDial({
          label: 'Escapement release — hour',
          steps: 24,
          value: hour,
          wrap: true,
          labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
          feedback: ctx.feedback,
          onChange: (v, committed) => {
            hour = v;
            if (committed) {
              ctx.state.hour = hour;
              ctx.save();
            }
            paintRelease();
          },
        }),
      );
      const minuteDial = rig.keep(
        makeDial({
          label: 'Escapement release — minute',
          steps: 60,
          value: minute,
          wrap: true,
          labels: Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')),
          feedback: ctx.feedback,
          onChange: (v, committed) => {
            minute = v;
            if (committed) {
              ctx.state.minute = minute;
              ctx.save();
            }
            paintRelease();
          },
        }),
      );
      minuteDial.el.classList.add('op-dial-minutes');
      hourDial.el.classList.add('op-dial-hours');

      const releaseRead = h('p', 'op-release-read');
      releaseRead.setAttribute('role', 'status');
      const paintRelease = () => {
        releaseRead.textContent = `Release at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        check();
      };

      const windRow = h('div', 'op-wind-row');
      const crankWell = h('div', 'op-crank-well');
      crankWell.append(shaft, crank, caption('Wind to full fall'));
      const clockWell = h('div', 'op-clock-well');
      const dialRow = h('div', 'op-dial-row');
      dialRow.append(hourDial.el, h('span', 'op-colon', ':'), minuteDial.el);
      clockWell.append(caption('Escapement release'), dialRow, releaseRead);
      windRow.append(crankWell, clockWell);
      windStage.append(windRow, windRead);

      // -- the live preview ---------------------------------------------------
      let beamAngle = 0;
      let lit = false;
      rig.loop((dt) => {
        beamAngle = (beamAngle + (DEG_PER_SEC * dt) / 1000) % 360;
        beam.style.setProperty('--a', `${beamAngle}deg`);
        const on = sectorAngles.some((a) => {
          let d = Math.abs(((beamAngle - a + 540) % 360) - 180);
          d = 180 - d;
          return d <= 3.5;
        });
        if (on !== lit) {
          lit = on;
          spark.classList.toggle('is-on', on);
          ring.classList.toggle('is-flashing', on);
        }
      });

      // -- the continuous check ----------------------------------------------
      let solved = false;
      function check() {
        if (solved || stages.index < 2) return;
        if (!charactersRight() || wind < FULL_WIND || hour !== 23 || minute !== 4) return;
        solved = true;
        ctx.feedback('good');
        el.classList.add('is-lit');
        ctx.note('Fl(3) W 20s. Wound to full fall, and the escapement set for twenty-three oh four.');
        rig.after(reduced() ? 90 : 1200, () => ctx.solve());
      }

      // The character stage cannot be left until the plates are right: it is
      // the only thing in this mechanism that can be *wrong*, as opposed to
      // merely unfinished.
      let charDone = false;
      rig.loop(() => {
        if (stages.index !== 1 || charDone) return;
        if (!charactersRight()) return;
        charDone = true;
        ctx.feedback('good');
        ctx.note('Nought, thirty-six, seventy-two. A flash at nought, a flash at two, a flash at four, and sixteen seconds of nothing at all.');
        rig.after(reduced() ? 80 : 1100, () => stages.go(2, true));
      });

      const stageHolder = h('div', 'mech-stages');
      stageHolder.append(seatStage, charStage, windStage);

      const body = h('div', 'op-body');
      body.append(ring, stageHolder);
      el.append(head, body);

      paintClips();
      paintCharacter();
      paintWind();
      paintRelease();

      const resume = !seated || fastened.length < CLIP_COUNT ? 0 : charactersRight() ? 2 : 1;
      if (seated) {
        panel.classList.add('is-seated');
        panelCtl.destroy();
        collarCtl.destroy();
        collar.remove();
        bay.appendChild(panel);
        clipRing.hidden = false;
      }
      if (fastened.length === CLIP_COUNT) clipRing.classList.add('is-done');
      stages.go(resume);
      if (resume === 2) charDone = true;

      ctx.note(
        resume === 0
          ? 'Dawn, and the sea is the colour of a nail. Sandbach’s panel is on the gallery floor in a fleece.'
          : resume === 1
            ? 'Three sector plates and a ring marked in degrees. Eighteen degrees the second.'
            : 'Wind it, and set the release.',
      );
    },

    unmount() {
      rig.destroy();
    },
  };
}

// ===========================================================================

/**
 * Registers every mechanism in this batch. The integration layer calls one of
 * these per batch, so a puzzle file can be added or pulled without anybody
 * editing a central table.
 */
export function registerMechanismPuzzles(): void {
  registerPuzzle('puz-three-movements', threeMovements);
  registerPuzzle('puz-tide-room', tideRoom);
  registerPuzzle('puz-switchboard', switchboard);
  registerPuzzle('puz-the-optic', theOptic);
}
