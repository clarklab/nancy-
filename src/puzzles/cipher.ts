/**
 * The cipher, decoding and document-restoration bench.
 *
 * Four mechanisms live in this file, and they are all the same argument made
 * four different ways: paper is an object before it is a text, and an object
 * can be interrogated. Wren never *reads* her way to an answer in any of them.
 * She humidifies, separates, floats, lays down, rakes, mirrors and winds — and
 * the words arrive afterwards, as a consequence of having handled the thing
 * correctly.
 *
 *   puz-fused-commission   Act I    two leaves welded by spray, and a needle
 *                                   that has to be held between 68 and 72
 *   puz-ash-grate          Act I    fourteen wet fragments off a grate at
 *                                   twenty past one, and a jigsaw of char
 *   puz-per-procurationem  Act IV   forty-eight signatures, two dates typed
 *                                   unaided, and offset ink in a shaving mirror
 *   puz-september-spool    Act IV   a fabric ribbon, mirrored and backwards,
 *                                   and the sequence that is the actual evidence
 *
 * House rules observed throughout:
 *
 *  - Dragging is never reimplemented. `makeDraggable`, `makeSlider`,
 *    `makeToggle` and `makeRotatable` come from the host so a lever here has
 *    the same detent weight as a lever three puzzles away. Where a gesture the
 *    kit does not cover is needed (wheel-and-key rotation of a jigsaw piece,
 *    a speed-gated stroke along a seam) it is written once, here, and shared.
 *  - Every mechanism is checked continuously. Nothing has a submit button
 *    except the two places where committing an assertion *is* the move the
 *    fiction is about, and both of those are explicitly, diegetically a
 *    signature rather than a form.
 *  - Everything meaningful is written into `ctx.state` and saved, so a player
 *    who closes the bench mid-humidification comes back to a damp sheet.
 *  - Colour is never the only channel. Bands are hatched, states carry a
 *    glyph, and every readout says in words what it is showing.
 */

import type { PuzzleContext, PuzzleModule } from '@/engine/types';
import {
  makeDraggable,
  makeSlider,
  makeToggle,
  registerPuzzle,
} from '@/ui/puzzle-host';

// ===========================================================================
// Workshop stock — helpers shared by all four mechanisms
// ===========================================================================

type Attrs = Record<string, string>;

/** Element builder. Saves roughly four hundred lines of `createElement`. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  attrs: Attrs = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The same, for the SVG namespace. */
function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Deterministic noise, so a jigsaw cut in this session is the jigsaw the
 * player saw in the last one and a saved game reloads onto the same shapes.
 */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x1_0000_0000;
  };
}

// -- persisted-state readers -------------------------------------------------
// `ctx.state` is a bag off a JSON save file. It can hold anything, including
// what a previous build wrote, so every read is a coercion with a default
// rather than a cast.

const asNum = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const asBool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d);
const asStr = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNums = (v: unknown, len: number, d = 0): number[] => {
  const a = asList(v);
  return Array.from({ length: len }, (_, i) => asNum(a[i], d));
};
const asStrSet = (v: unknown): Set<string> =>
  new Set(asList(v).filter((x): x is string => typeof x === 'string'));

/**
 * Teardown ledger.
 *
 * A puzzle that leaks one rAF loop is a puzzle that keeps integrating a
 * hygrometer for the rest of the session, so every listener, timer, frame,
 * observer and primitive control is booked here on the way in and cancelled in
 * one call on the way out.
 */
class Bin {
  private ac = new AbortController();
  private jobs: (() => void)[] = [];
  private timers = new Set<number>();

  /** Pass to every `addEventListener` so the abort takes them all at once. */
  get signal(): AbortSignal {
    return this.ac.signal;
  }

  /** Books a primitive control (or anything with `destroy`) for teardown. */
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
   * A rAF loop yielding a clamped delta in milliseconds. The clamp matters:
   * a backgrounded tab returns with a delta of thirty seconds, and an
   * unclamped integrator would slam the hygrometer to its stop.
   */
  loop(fn: (dtMs: number, nowMs: number) => void) {
    let frame = 0;
    let last = performance.now();
    let live = true;
    const tick = (now: number) => {
      if (!live) return;
      const dt = Math.min(64, now - last);
      last = now;
      fn(dt, now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    this.jobs.push(() => {
      live = false;
      cancelAnimationFrame(frame);
    });
  }

  /** Re-runs `fn` whenever `target` changes size. Used by every canvas. */
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
        console.error('[cipher] teardown step threw', err);
      }
    }
  }
}

/**
 * Sizes a canvas's backing store to its laid-out box at device resolution and
 * returns a context already scaled to CSS pixels, so every `fillText` in this
 * file can be written in the units the layout is written in.
 */
function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const c2d = canvas.getContext('2d');
  if (!c2d) return null;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  return c2d;
}

/** CSS-pixel size of a canvas, i.e. what the drawing code should reason in. */
function cssSize(canvas: HTMLCanvasElement): { w: number; h: number } {
  const r = canvas.getBoundingClientRect();
  return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
}

/**
 * A brass plate of engraved instructions. Every mechanism in this file has a
 * readable, in-fiction source for its own solution somewhere on the bench —
 * the card in the kit lid, the instruction plate inside the case — because a
 * puzzle whose rule is only in the hint list is a puzzle that punishes the
 * player for not buying hints.
 */
function plate(title: string, lines: string[], extraClass = ''): HTMLElement {
  const box = el('div', `cx-plate ${extraClass}`.trim());
  box.appendChild(el('p', 'cx-plate-title', {}, title));
  const list = el('ul', 'cx-plate-list');
  for (const line of lines) list.appendChild(el('li', '', {}, line));
  box.appendChild(list);
  return box;
}

/** A pressable brass fitting. Not a `<button class=btn>`; a machined part. */
function stud(label: string, onPress: () => void, bin: Bin, extraClass = ''): HTMLButtonElement {
  const b = el('button', `cx-stud ${extraClass}`.trim(), { type: 'button' });
  b.appendChild(el('span', 'cx-stud-face', {}, label));
  b.addEventListener('click', onPress, { signal: bin.signal });
  return b;
}

/**
 * Rotation by wheel, right-drag and keyboard, in fixed detents.
 *
 * The host's `makeRotatable` owns an element's `transform` and claims the
 * primary pointer button, which is exactly the button `makeDraggable` needs on
 * a jigsaw piece. So the two gestures are split: the kit drags the piece, and
 * this turns it, on the secondary button, the wheel and the bracket keys — the
 * three things every real jigsaw-with-rotation has bound since 1996.
 */
function detentRotator(opts: {
  /** The element that receives the gesture (the piece). */
  host: HTMLElement;
  /** The element that actually turns (an inner wrapper). */
  spun: HTMLElement;
  stepDeg: number;
  angle: number;
  bin: Bin;
  feedback: PuzzleContext['feedback'];
  onChange(deg: number): void;
}): { get(): number; set(deg: number): void } {
  let angle = opts.angle;
  const apply = () => opts.spun.style.setProperty('--cx-rot', `${angle}deg`);

  const turn = (deltaDeg: number) => {
    const next = Math.round((angle + deltaDeg) / opts.stepDeg) * opts.stepDeg;
    if (next === angle) return;
    angle = ((next % 360) + 360) % 360;
    apply();
    opts.feedback('tick');
    opts.onChange(angle);
  };

  opts.host.addEventListener(
    'wheel',
    (ev: WheelEvent) => {
      ev.preventDefault();
      turn(Math.sign(ev.deltaY) * opts.stepDeg);
    },
    { signal: opts.bin.signal, passive: false },
  );

  // The secondary button spins rather than opening a menu. Suppressing the
  // context menu on the piece only — never on the bench — keeps the rest of
  // the page behaving like a page.
  opts.host.addEventListener('contextmenu', (ev) => ev.preventDefault(), {
    signal: opts.bin.signal,
  });

  let spinning = false;
  let lastY = 0;
  opts.host.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 2) return;
      ev.preventDefault();
      opts.host.setPointerCapture(ev.pointerId);
      spinning = true;
      lastY = ev.clientY;
    },
    { signal: opts.bin.signal },
  );
  opts.host.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (!spinning) return;
      const dy = ev.clientY - lastY;
      if (Math.abs(dy) < 6) return;
      lastY = ev.clientY;
      turn(Math.sign(dy) * opts.stepDeg);
    },
    { signal: opts.bin.signal },
  );
  const drop = (ev: PointerEvent) => {
    if (!spinning) return;
    spinning = false;
    if (opts.host.hasPointerCapture(ev.pointerId)) opts.host.releasePointerCapture(ev.pointerId);
  };
  opts.host.addEventListener('pointerup', drop, { signal: opts.bin.signal });
  opts.host.addEventListener('pointercancel', drop, { signal: opts.bin.signal });
  opts.host.addEventListener('lostpointercapture', drop, { signal: opts.bin.signal });

  opts.host.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      if (ev.key !== '[' && ev.key !== ']' && ev.key !== 'q' && ev.key !== 'e') return;
      ev.preventDefault();
      ev.stopPropagation();
      turn(ev.key === '[' || ev.key === 'q' ? -opts.stepDeg : opts.stepDeg);
    },
    { signal: opts.bin.signal },
  );

  apply();
  return {
    get: () => angle,
    set: (deg) => {
      angle = ((Math.round(deg / opts.stepDeg) * opts.stepDeg) % 360 + 360) % 360;
      apply();
    },
  };
}

/** Shortest signed distance between two bearings, in degrees. */
const angleGap = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

// ===========================================================================
// 1 — THE FUSED COMMISSION  (Act I, the cabin of the Ardent)
// ===========================================================================
//
// The only puzzle in the game whose difficulty is *patience*. Two leaves of
// Wren's own s.41 commission have dried together in salt spray. The kit is on
// the table, card 3 is legible in the lid, and the sheet will let go when it is
// ready and not one second before.
//
// Four movements: lay up, humidify, separate, press. The middle one is the
// mechanism — a needle to be held inside a five-point band with a vent lever
// while a sweep hand goes round once — and the third one is where hurrying
// costs. Hurrying does not fail. It tears, and the tear is written into the
// puzzle's saved state as `commissionScarred`, which the Act V board reads.

/** One full sweep of the cabin clock, in milliseconds. */
const SWEEP_MS = 26_000;
/** The band printed on the hygrometer dial, and on card 3. */
const RH_LO = 68;
const RH_HI = 72;
/** Above this the sheet cockles: not fatal, but it is the "NOT ABOVE" line. */
const RH_COCKLE = 77;
/** Client pixels per second above which the spatula is dragging fibre. */
const STROKE_SPEED_MAX = 155;
/** Deviation from the seam's centre line, in SVG units, that reaches a chain. */
const LANE_HALF = 22;

interface SeamGeom {
  /** Centre-line x, in the document SVG's 0..300 space. */
  x: number;
  y0: number;
  y1: number;
}

const SEAMS: SeamGeom[] = [
  { x: 38, y0: 34, y1: 176 },
  { x: 113, y0: 34, y1: 176 },
  { x: 188, y0: 34, y1: 176 },
];
/** Laid-paper chain lines. The spatula must not be dragged across one. */
const CHAIN_X = [75, 150, 225];

const KIT_TOOLS: { id: string; name: string; hint: string }[] = [
  { id: 'damp', name: 'Damp blotter', hint: 'Wetted and blotted back. Goes under.' },
  { id: 'membrane', name: 'Gore-Tex membrane', hint: 'Passes vapour, holds water. Goes over.' },
  { id: 'spatula', name: 'Microspatula', hint: 'Ground to two thou. Slow, or not at all.' },
  { id: 'dry', name: 'Dry blotter', hint: 'For afterwards. Never before.' },
  { id: 'glass', name: 'Glass plate', hint: 'Plate glass, ground edges.' },
  { id: 'weight', name: 'Lead weight', hint: 'Four pounds, felted.' },
];

function fusedCommission(): PuzzleModule {
  const bin = new Bin();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const S = ctx.state;

      // -- restored state -------------------------------------------------
      let rh = clamp(asNum(S.rh, 41), 20, 100);
      let hold = clamp(asNum(S.hold, 0), 0, SWEEP_MS);
      let vent = clamp(asNum(S.vent, 100), 0, 100);
      let laidDamp = asBool(S.laidDamp);
      let laidMembrane = asBool(S.laidMembrane);
      const seam = asNums(S.seams, 3, 0).map((v) => clamp(v, 0, 1));
      const tears = asNums(S.tears, asList(S.tears).length, 0);
      let torn = asBool(S.commissionScarred);
      const pressed = asStrSet(S.pressed);
      let stress = 0;
      let held: string | null = null;
      let solved = false;

      const save = () => {
        S.rh = Math.round(rh * 10) / 10;
        S.hold = Math.round(hold);
        S.vent = Math.round(vent);
        S.laidDamp = laidDamp;
        S.laidMembrane = laidMembrane;
        S.seams = seam.map((v) => Math.round(v * 1000) / 1000);
        S.tears = tears;
        S.commissionScarred = torn;
        S.pressed = [...pressed];
        ctx.save();
      };

      const seamsDone = () => seam.every((v) => v >= 0.999);
      const humidified = () => hold >= SWEEP_MS;

      // -- furniture --------------------------------------------------------
      const box = el('div', 'cx cx-commission');
      root.appendChild(box);

      const kit = el('aside', 'cx-kit');
      const middle = el('section', 'cx-doc-wrap');
      const instruments = el('aside', 'cx-instruments');
      const bench = el('div', 'cx-bench');
      bench.append(kit, middle, instruments);

      const step = el('p', 'cx-step', { 'aria-live': 'polite' });
      box.append(bench, step);

      // -- the kit lid ------------------------------------------------------
      kit.appendChild(el('p', 'cx-kit-brand', {}, 'Conservancy field kit, pattern 9'));
      kit.appendChild(
        plate('Card 3 — humidification and separation', [
          'Relative humidity 68–72. NOT ABOVE.',
          'Hold the band one full sweep of the clock.',
          'Separate from the tail edge inward, never across a chain line.',
          'The sheet tells you when. You do not tell the sheet.',
        ]),
      );
      // Halkett's covering note, tucked into the lid behind card 3. It is the
      // third hint, given away for nothing, because the lamp should be for
      // players who are stuck rather than for players who did not look.
      kit.appendChild(
        plate('Covering note — P. Halkett', [
          'If you find you are pulling, you are early.',
          'Put it down and count the clock.',
          'The paper will let go on its own or it will not let go at all.',
        ]),
      );

      const rack = el('div', 'cx-rack', { role: 'group', 'aria-label': 'Field kit tools' });
      const toolBtns = new Map<string, HTMLButtonElement>();
      for (const tool of KIT_TOOLS) {
        const b = el('button', 'cx-tool', {
          type: 'button',
          'aria-pressed': 'false',
          'data-tool': tool.id,
        });
        b.appendChild(el('span', 'cx-tool-glyph', { 'aria-hidden': 'true' }));
        b.appendChild(el('span', 'cx-tool-name', {}, tool.name));
        b.appendChild(el('span', 'cx-tool-hint', {}, tool.hint));
        b.addEventListener('click', () => take(tool.id), { signal: bin.signal });
        toolBtns.set(tool.id, b);
        rack.appendChild(b);
      }
      kit.appendChild(rack);

      function take(id: string) {
        held = held === id ? null : id;
        for (const [key, b] of toolBtns) b.setAttribute('aria-pressed', String(key === held));
        box.dataset.held = held ?? '';
        ctx.feedback('click');
        if (held) {
          const t = KIT_TOOLS.find((k) => k.id === held);
          ctx.note(`${t?.name} in hand.`);
        }
      }

      // -- the document -----------------------------------------------------
      const sheet = el('div', 'cx-sheet', {
        role: 'group',
        'aria-label': 'Leaves two and three of the commission, fused along three seams',
      });
      const blotter = el('div', 'cx-blotter', { 'aria-hidden': 'true' });
      const paper = el('div', 'cx-paper');
      const membrane = el('div', 'cx-membrane', { 'aria-hidden': 'true' });
      const glass = el('div', 'cx-glass', { 'aria-hidden': 'true' });
      const weight = el('div', 'cx-weight', { 'aria-hidden': 'true' });

      // Typed body of the commission, visible under the fused biscuit. It is
      // deliberately readable from the first frame: the player is restoring a
      // document they can already half-see, which is what makes the tear hurt.
      const body = el('div', 'cx-paper-body', { 'aria-hidden': 'true' });
      body.appendChild(el('p', 'cx-paper-head', {}, 'COASTAL SERVICES ACT 1997'));
      body.appendChild(el('p', 'cx-paper-sub', {}, 'Section 41 — Commission of Appraisal'));
      for (const line of [
        'To WREN ADARE, Assistant Archivist, of the Conservancy of Records,',
        'authority to enter, inspect, requisition and appraise the whole of the',
        'records of the Brannock Head Lighthouse Authority, series 1/A to 19/K',
        'inclusive, and to certify the same for preservation or for disposal.',
      ]) {
        body.appendChild(el('p', 'cx-paper-line', {}, line));
      }
      body.appendChild(el('p', 'cx-paper-sig', {}, 'P. HALKETT — Keeper of the Conservancy'));
      paper.appendChild(body);

      const overlay = svgEl('svg', {
        class: 'cx-seams',
        viewBox: '0 0 300 200',
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      });
      for (const cx of CHAIN_X) {
        overlay.appendChild(
          svgEl('line', {
            class: 'cx-chain',
            x1: String(cx),
            y1: '6',
            x2: String(cx),
            y2: '194',
          }),
        );
      }
      const seamTracks: SVGLineElement[] = [];
      const seamCuts: SVGLineElement[] = [];
      SEAMS.forEach((g, i) => {
        overlay.appendChild(
          svgEl('line', {
            class: 'cx-lane',
            x1: String(g.x),
            y1: String(g.y0),
            x2: String(g.x),
            y2: String(g.y1),
          }),
        );
        const track = svgEl('line', {
          class: 'cx-seam',
          x1: String(g.x),
          y1: String(g.y0),
          x2: String(g.x),
          y2: String(g.y1),
        });
        const cut = svgEl('line', {
          class: 'cx-cut',
          x1: String(g.x),
          y1: String(g.y0),
          x2: String(g.x),
          y2: String(g.y0),
        });
        overlay.append(track, cut);
        seamTracks[i] = track;
        seamCuts[i] = cut;
      });
      const tearGroup = svgEl('g', { class: 'cx-tears' });
      overlay.appendChild(tearGroup);
      paper.appendChild(overlay);

      // Seam grips: the thing the pointer takes hold of, and the thing the
      // keyboard tabs to. One per seam, parked at the head of its cut.
      const grips: HTMLButtonElement[] = SEAMS.map((g, i) => {
        const grip = el('button', 'cx-grip', {
          type: 'button',
          'aria-label': `Separate seam ${i + 1} of 3`,
          'aria-valuemin': '0',
          'aria-valuemax': '100',
          role: 'slider',
        });
        grip.style.left = `${(g.x / 300) * 100}%`;
        grip.appendChild(el('span', 'cx-grip-blade', { 'aria-hidden': 'true' }));
        paper.appendChild(grip);
        return grip;
      });

      sheet.append(blotter, paper, membrane, glass, weight);
      middle.appendChild(sheet);

      const stressWrap = el('div', 'cx-stress', {
        role: 'meter',
        'aria-label': 'Fibre stress',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      });
      const stressFill = el('span', 'cx-stress-fill', { 'aria-hidden': 'true' });
      stressWrap.append(stressFill, el('span', 'cx-stress-label', {}, 'Fibre'));
      middle.appendChild(stressWrap);

      // -- instruments ------------------------------------------------------
      // Hygrometer: a 240-degree arc with the 68–72 band drawn as a hatched
      // wedge rather than a coloured one, so it survives the colour-blind mode
      // with its meaning intact.
      const hygro = svgEl('svg', { class: 'cx-hygro', viewBox: '0 0 120 100' });
      const defs = svgEl('defs');
      const hatch = svgEl('pattern', {
        id: 'cx-hatch-band',
        width: '5',
        height: '5',
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(35)',
      });
      hatch.appendChild(svgEl('line', { x1: '0', y1: '0', x2: '0', y2: '5', class: 'cx-hatch' }));
      defs.appendChild(hatch);
      hygro.appendChild(defs);

      const ARC_R = 42;
      const ARC_CX = 60;
      const ARC_CY = 62;
      const arcAngle = (v: number) => (-210 + (clamp(v, 0, 100) / 100) * 240) * (Math.PI / 180);
      const arcPoint = (v: number, r: number) => {
        const a = arcAngle(v);
        return [ARC_CX + Math.cos(a) * r, ARC_CY + Math.sin(a) * r] as const;
      };
      const arcPath = (from: number, to: number, r: number) => {
        const [x0, y0] = arcPoint(from, r);
        const [x1, y1] = arcPoint(to, r);
        const large = ((to - from) / 100) * 240 > 180 ? 1 : 0;
        return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
      };
      hygro.appendChild(svgEl('path', { class: 'cx-hygro-face', d: arcPath(0, 100, ARC_R) }));
      hygro.appendChild(
        svgEl('path', {
          class: 'cx-hygro-band',
          d: arcPath(RH_LO, RH_HI, ARC_R),
          stroke: 'url(#cx-hatch-band)',
        }),
      );
      for (let v = 0; v <= 100; v += 10) {
        const [ax, ay] = arcPoint(v, ARC_R - 6);
        const [bx, by] = arcPoint(v, ARC_R + 1);
        hygro.appendChild(
          svgEl('line', {
            class: 'cx-hygro-tick',
            x1: String(ax),
            y1: String(ay),
            x2: String(bx),
            y2: String(by),
          }),
        );
      }
      const needle = svgEl('line', {
        class: 'cx-hygro-needle',
        x1: String(ARC_CX),
        y1: String(ARC_CY),
        x2: String(ARC_CX),
        y2: String(ARC_CY - ARC_R + 4),
      });
      hygro.append(needle, svgEl('circle', { class: 'cx-hygro-hub', cx: '60', cy: '62', r: '5' }));
      const hygroWrap = el('div', 'cx-instr');
      hygroWrap.append(hygro);
      const rhRead = el('p', 'cx-readout', {
        role: 'status',
        'aria-label': 'Relative humidity',
      });
      hygroWrap.appendChild(rhRead);
      hygroWrap.appendChild(el('p', 'cx-instr-cap', {}, 'Hygrometer · %RH'));
      instruments.appendChild(hygroWrap);

      // Cabin clock: sixty marks and one sweep hand, and the hand is the only
      // progress bar this mechanism has.
      const clock = svgEl('svg', { class: 'cx-clock', viewBox: '0 0 100 100' });
      clock.appendChild(svgEl('circle', { class: 'cx-clock-face', cx: '50', cy: '50', r: '44' }));
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const inner = i % 5 === 0 ? 34 : 39;
        clock.appendChild(
          svgEl('line', {
            class: i % 5 === 0 ? 'cx-clock-tick is-major' : 'cx-clock-tick',
            x1: String(50 + Math.cos(a) * inner),
            y1: String(50 + Math.sin(a) * inner),
            x2: String(50 + Math.cos(a) * 42),
            y2: String(50 + Math.sin(a) * 42),
          }),
        );
      }
      const sweep = svgEl('line', {
        class: 'cx-clock-hand',
        x1: '50',
        y1: '56',
        x2: '50',
        y2: '12',
      });
      clock.append(sweep, svgEl('circle', { class: 'cx-clock-hub', cx: '50', cy: '50', r: '3.2' }));
      const clockWrap = el('div', 'cx-instr');
      clockWrap.append(clock);
      const clockRead = el('p', 'cx-readout', { role: 'status', 'aria-label': 'Sweep held' });
      clockWrap.append(clockRead, el('p', 'cx-instr-cap', {}, 'Cabin clock · one sweep'));
      instruments.appendChild(clockWrap);

      const ventCtl = bin.own(
        makeSlider({
          label: 'Membrane vent',
          min: 0,
          max: 100,
          step: 1,
          value: vent,
          orientation: 'vertical',
          length: 'clamp(5rem, 20cqh, 9rem)',
          format: (v) => (v === 0 ? 'shut' : v === 100 ? 'wide' : `${v}%`),
          feedback: ctx.feedback,
          onChange: (v) => {
            vent = v;
            save();
          },
        }),
      );
      const ventWrap = el('div', 'cx-instr cx-vent');
      ventWrap.append(ventCtl.el, el('p', 'cx-instr-cap', {}, 'Vent · lift the corner'));
      instruments.appendChild(ventWrap);

      // -- laying up and pressing -------------------------------------------
      // One click target for the whole sheet. Which tool is in hand decides
      // what happens, and the wrong tool is answered in Wren's voice rather
      // than with a buzz.
      const applyTool = () => {
        if (!held) {
          ctx.note('Nothing in my hand.');
          return;
        }
        const t = held;
        if (t === 'damp') {
          if (laidDamp) return ctx.note('Already under it.');
          laidDamp = true;
          ctx.feedback('good');
          ctx.note('Damp blotter under. Wetted and blotted back, not wet.');
        } else if (t === 'membrane') {
          if (!laidDamp) {
            ctx.feedback('bad');
            return ctx.note('Membrane over dry paper does nothing at all. Blotter first.');
          }
          if (laidMembrane) return ctx.note('It is already over the corner.');
          laidMembrane = true;
          ctx.feedback('good');
          ctx.note('Membrane over the fused corner. Now the vent, and the clock.');
        } else if (t === 'spatula') {
          if (!humidified()) {
            ctx.feedback('bad');
            return ctx.note('If I am pulling, I am early. Count the clock.');
          }
          ctx.note('Take a seam by its head and draw down. Slowly.');
        } else if (t === 'dry' || t === 'glass' || t === 'weight') {
          if (!seamsDone()) {
            ctx.feedback('bad');
            return ctx.note('Not until all three seams are apart.');
          }
          const order = ['dry', 'glass', 'weight'];
          const next = order.find((k) => !pressed.has(k));
          if (t !== next) {
            ctx.feedback('bad');
            return ctx.note(
              next === 'dry'
                ? 'Blot it dry before anything goes on top of it.'
                : next === 'glass'
                  ? 'Glass before lead. Always.'
                  : 'Done.',
            );
          }
          pressed.add(t);
          ctx.feedback('good');
          ctx.note(
            t === 'dry'
              ? 'Blotted dry, both faces.'
              : t === 'glass'
                ? 'Under plate glass, ground edges, dead flat.'
                : 'Four felted pounds on top. That is the job.',
          );
        }
        held = null;
        for (const [, b] of toolBtns) b.setAttribute('aria-pressed', 'false');
        box.dataset.held = '';
        save();
        paint();
        checkWin();
      };

      sheet.addEventListener(
        'click',
        (ev) => {
          // A click that started on a seam grip belongs to the grip.
          if ((ev.target as HTMLElement).closest('.cx-grip')) return;
          applyTool();
        },
        { signal: bin.signal },
      );
      sheet.tabIndex = 0;
      sheet.addEventListener(
        'keydown',
        (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();
          ev.stopPropagation();
          applyTool();
        },
        { signal: bin.signal },
      );

      // -- the separating stroke ---------------------------------------------
      // Speed-gated and lane-gated. Neither gate fails the puzzle: they fill a
      // fibre-stress meter, and a full meter tears the sheet at the point the
      // spatula happens to be. The seam still separates. That is the whole
      // design — you cannot lose the commission, only mark it for life.
      const rectOf = () => paper.getBoundingClientRect();

      const tearAt = (index: number, at: number) => {
        torn = true;
        tears.push(index, Math.round(at * 1000) / 1000);
        stress = 0.34;
        ctx.feedback('bad');
        ctx.note('A fibre has lifted. That is permanent, and it is mine.');
        paintTears();
        save();
      };

      const advance = (index: number, to: number) => {
        const next = clamp(Math.max(seam[index], to), 0, 1);
        if (next === seam[index]) return;
        const wasDone = seam[index] >= 0.999;
        seam[index] = next;
        paintSeams();
        if (!wasDone && next >= 0.999) {
          ctx.feedback('good');
          const n = seam.filter((v) => v >= 0.999).length;
          ctx.note(
            n === 3
              ? 'Three of three. The leaves are apart. Blot, glass, weight.'
              : `${n === 1 ? 'One' : 'Two'} of three seams apart.`,
          );
          save();
        }
      };

      grips.forEach((grip, index) => {
        const geom = SEAMS[index];
        let stroking = false;
        let lastPt = { x: 0, y: 0, t: 0 };

        grip.addEventListener(
          'pointerdown',
          (ev: PointerEvent) => {
            if (ev.button !== 0 && ev.pointerType === 'mouse') return;
            if (!humidified()) {
              ctx.feedback('bad');
              ctx.note('The paper has not let go yet. Count the clock.');
              return;
            }
            if (seam[index] >= 0.999) return;
            ev.preventDefault();
            grip.setPointerCapture(ev.pointerId);
            stroking = true;
            lastPt = { x: ev.clientX, y: ev.clientY, t: performance.now() };
            grip.classList.add('is-stroking');
            ctx.feedback('click');
          },
          { signal: bin.signal },
        );

        grip.addEventListener(
          'pointermove',
          (ev: PointerEvent) => {
            if (!stroking) return;
            const now = performance.now();
            const dt = Math.max(8, now - lastPt.t);
            const dist = Math.hypot(ev.clientX - lastPt.x, ev.clientY - lastPt.y);
            const speed = (dist / dt) * 1000;
            lastPt = { x: ev.clientX, y: ev.clientY, t: now };

            const r = rectOf();
            const svgX = ((ev.clientX - r.left) / r.width) * 300;
            const svgY = ((ev.clientY - r.top) / r.height) * 200;
            const drift = Math.abs(svgX - geom.x);
            const frac = clamp((svgY - geom.y0) / (geom.y1 - geom.y0), 0, 1);

            let offending = false;
            if (speed > STROKE_SPEED_MAX) {
              offending = true;
              box.dataset.fault = 'fast';
            } else if (drift > LANE_HALF) {
              offending = true;
              box.dataset.fault = 'chain';
            } else {
              box.dataset.fault = '';
            }
            stress = clamp(stress + (offending ? dt / 900 : -dt / 2600), 0, 1);
            paintStress();
            if (stress >= 1) tearAt(index, frac);
            advance(index, frac);
          },
          { signal: bin.signal },
        );

        const endStroke = (ev: PointerEvent) => {
          if (!stroking) return;
          stroking = false;
          box.dataset.fault = '';
          if (grip.hasPointerCapture(ev.pointerId)) grip.releasePointerCapture(ev.pointerId);
          grip.classList.remove('is-stroking');
          save();
          checkWin();
        };
        grip.addEventListener('pointerup', endStroke, { signal: bin.signal });
        grip.addEventListener('pointercancel', endStroke, { signal: bin.signal });
        grip.addEventListener('lostpointercapture', endStroke, { signal: bin.signal });

        // The keyboard path is deliberately incapable of tearing: a player who
        // cannot make a slow drag gesture must not be the only player who ends
        // the game with a scarred commission.
        grip.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            const forward = ev.key === 'ArrowDown' || ev.key === 'ArrowRight';
            const back = ev.key === 'ArrowUp' || ev.key === 'ArrowLeft';
            if (!forward && !back) return;
            ev.preventDefault();
            ev.stopPropagation();
            if (!humidified()) {
              ctx.feedback('bad');
              ctx.note('The paper has not let go yet. Count the clock.');
              return;
            }
            if (forward) {
              ctx.feedback('tick');
              advance(index, seam[index] + 0.1);
              save();
              checkWin();
            } else if (back) {
              ctx.note('Back off, and start again from the tail edge.');
            }
          },
          { signal: bin.signal },
        );
      });

      // -- painting -----------------------------------------------------------
      function paintSeams() {
        SEAMS.forEach((g, i) => {
          const y = lerp(g.y0, g.y1, seam[i]);
          seamCuts[i].setAttribute('y2', String(y));
          seamTracks[i].classList.toggle('is-done', seam[i] >= 0.999);
          const grip = grips[i];
          grip.style.top = `${(y / 200) * 100}%`;
          grip.classList.toggle('is-done', seam[i] >= 0.999);
          grip.setAttribute('aria-valuenow', String(Math.round(seam[i] * 100)));
          grip.setAttribute(
            'aria-valuetext',
            seam[i] >= 0.999 ? 'separated' : `${Math.round(seam[i] * 100)} per cent separated`,
          );
        });
      }

      function paintTears() {
        tearGroup.textContent = '';
        for (let i = 0; i + 1 < tears.length; i += 2) {
          const g = SEAMS[clamp(Math.round(tears[i]), 0, 2)];
          const y = lerp(g.y0, g.y1, clamp(tears[i + 1], 0, 1));
          const rnd = seeded(1000 + i);
          let d = `M ${g.x} ${y}`;
          for (let k = 1; k <= 6; k++) {
            d += ` L ${g.x + (rnd() - 0.5) * 26} ${y + k * 3.4}`;
          }
          tearGroup.appendChild(svgEl('path', { class: 'cx-tear', d }));
        }
        box.dataset.torn = torn ? 'yes' : 'no';
      }

      function paintStress() {
        stressFill.style.setProperty('--fill', stress.toFixed(3));
        stressWrap.dataset.level = stress > 0.66 ? 'high' : stress > 0.3 ? 'mid' : 'low';
        stressWrap.setAttribute('aria-valuenow', String(Math.round(stress * 100)));
      }

      function paintInstruments() {
        const deg = -210 + (clamp(rh, 0, 100) / 100) * 240 + 90;
        needle.style.setProperty('--cx-rot', `${deg}deg`);
        const inBand = rh >= RH_LO && rh <= RH_HI;
        const word = inBand ? 'IN BAND' : rh < RH_LO ? 'LOW' : rh > RH_COCKLE ? 'COCKLING' : 'HIGH';
        rhRead.textContent = `${rh.toFixed(1)} %RH · ${word}`;
        rhRead.dataset.state = inBand ? 'band' : rh > RH_COCKLE ? 'over' : 'out';
        sweep.style.setProperty('--cx-rot', `${(hold / SWEEP_MS) * 360}deg`);
        const secs = Math.round((SWEEP_MS - hold) / 1000);
        clockRead.textContent = humidified()
          ? 'Sweep complete'
          : hold <= 0
            ? 'Hand at the top'
            : `${secs}s of sweep to run`;
      }

      function paint() {
        box.dataset.stage = !laidDamp
          ? 'lay'
          : !laidMembrane
            ? 'lay'
            : !humidified()
              ? 'humidify'
              : !seamsDone()
                ? 'separate'
                : 'press';
        box.dataset.damp = laidDamp ? 'yes' : 'no';
        box.dataset.membrane = laidMembrane ? 'yes' : 'no';
        box.dataset.pressed = [...pressed].join(' ');
        box.dataset.spatula = humidified() ? 'yes' : 'no';
        step.textContent = !laidDamp
          ? 'Damp blotter under the leaves.'
          : !laidMembrane
            ? 'Gore-Tex membrane over the fused corner.'
            : !humidified()
              ? 'Hold sixty-eight to seventy-two on the vent, one full sweep.'
              : !seamsDone()
                ? 'Draw each seam from the tail edge inward. Slowly, and in its own lane.'
                : !pressed.has('dry')
                  ? 'Dry blotter.'
                  : !pressed.has('glass')
                    ? 'Glass plate.'
                    : !pressed.has('weight')
                      ? 'Weight.'
                      : 'Done.';
        paintSeams();
        paintStress();
        paintInstruments();
      }

      function checkWin() {
        if (solved) return;
        if (!seamsDone() || !pressed.has('dry') || !pressed.has('glass') || !pressed.has('weight'))
          return;
        solved = true;
        save();
        ctx.feedback('good');
        ctx.note(
          torn
            ? 'Legible. Valid. And scarred down the second lane, where I hurried.'
            : 'Legible, valid, and not one fibre lifted across a chain line.',
        );
        ctx.solve();
      }

      // -- the humidification loop -------------------------------------------
      bin.loop((dt, now) => {
        if (laidMembrane && !humidified()) {
          // The drive is where the cabin's air *wants* to sit given how far the
          // membrane corner is lifted, plus two slow beats of drift so the band
          // has to be tended rather than set and abandoned.
          const drive =
            30 + 58 * (1 - vent / 100) + 3.4 * Math.sin(now / 4300) + 1.7 * Math.sin(now / 1610);
          rh += (drive - rh) * (1 - Math.exp(-dt / 2600));
          const inBand = rh >= RH_LO && rh <= RH_HI;
          hold = clamp(hold + (inBand ? dt : -dt * 0.55), 0, SWEEP_MS);
          if (rh > RH_COCKLE) stress = clamp(stress + dt / 26_000, 0, 0.9);
          if (humidified()) {
            ctx.feedback('good');
            ctx.note('One full sweep in the band. The paper has let go. Spatula.');
            paint();
            save();
          }
        } else if (!laidMembrane && rh > 40) {
          rh += (40 - rh) * (1 - Math.exp(-dt / 5200));
        }
        if (stress > 0) stress = clamp(stress - dt / 5200, 0, 1);
        paintInstruments();
        paintStress();
      });

      // Persisting a live integrator every frame would flood the save; once a
      // second is plenty to survive a reload.
      let sinceSave = 0;
      bin.loop((dt) => {
        sinceSave += dt;
        if (sinceSave < 1000) return;
        sinceSave = 0;
        if (laidMembrane && !humidified()) save();
      });

      paintTears();
      paint();
      checkWin();
      ctx.note(
        laidMembrane
          ? 'Where I left it: membrane down, and a needle to hold.'
          : 'Eleven months on a parish register. Do it the way it is done.',
      );
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// 2 — THE ASH GRATE  (Act I, the courtyard incinerator at 01:20, then the bench)
// ===========================================================================
//
// Three stages, and they are three different games about the same fourteen
// pieces of burnt paper.
//
//   A  THE GRATE      float fragments off a sodden brick of ash into cold
//                     water. Pull fast and the fragment goes. At most three
//                     may go, and the fourth over-hasty pull merely refuses —
//                     because a mechanism that can be driven into an
//                     unwinnable state is a bug wearing a costume.
//   B  THE LIGHT BOX  rotate-and-snap jigsaw. Text runs across the joins,
//                     because every fragment is a window onto the same sheet.
//   C  THE REGISTER   the Register of Notices Issued, 1974. Find the number
//                     that is not in it.
//
// The jigsaw is cut from a jittered lattice, so cells share vertices exactly
// and the assembled sheet has no seams of its own — only the cuts.

/** Columns and rows of the lattice the notice is cut on. */
const GRID_COLS = 4;
const GRID_ROWS = 4;
/** Two cells went up the flue. Corners, so the loss is at the margins. */
const LOST_CELLS = new Set(['3,0', '0,3']);
/** Fragments the bench can work with, out of fourteen. */
const FRAGMENTS_NEEDED = 11;
/** Client px/s above which a wet fragment starts to come apart in the fingers. */
const LIFT_SPEED_MAX = 105;
/** Never more than this many may be destroyed, whatever the player does. */
const MAX_CRUMBLES = 3;
/** Snap tolerances: centre offset in client px, rotation in degrees. */
const SNAP_PX = 20;
const SNAP_DEG = 5;

/** The recovered notice, as it reads once assembled. */
const NOTICE_LINES = [
  'BRANNOCK HEAD LIGHTHOUSE AUTHORITY',
  'NOTICE TO MARINERS  No. 74/119',
  'Drafted 15 August 1974',
  '',
  'MARINERS ARE ADVISED THAT THE LIGHT',
  'EXHIBITED FROM THE NINE BELLS BEACON',
  'MAY NOT BE RELIED UPON UNTIL FURTHER',
  'NOTICE.',
  '',
  'By order of the Warden.',
  '214 copies for distribution.',
];

interface Cell {
  key: string;
  /** Clip polygon, in per-cent of the fragment's own bounding box. */
  clip: string;
  /** Bounding box within the notice, 0..1. */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  /** How close to the outside edge this cell sits: drives the char. */
  char: number;
}

/** Cuts the notice into fourteen interlocking fragments, deterministically. */
function cutNotice(): Cell[] {
  const rnd = seeded(0x74119);
  // A jittered lattice. Interior vertices wander; the border stays square so
  // the assembled sheet still has straight edges.
  const V: { x: number; y: number }[][] = [];
  for (let i = 0; i <= GRID_COLS; i++) {
    V[i] = [];
    for (let j = 0; j <= GRID_ROWS; j++) {
      const edge = i === 0 || j === 0 || i === GRID_COLS || j === GRID_ROWS;
      const jx = edge ? 0 : (rnd() - 0.5) * 0.13;
      const jy = edge ? 0 : (rnd() - 0.5) * 0.13;
      V[i][j] = { x: i / GRID_COLS + jx, y: j / GRID_ROWS + jy };
    }
  }
  const cells: Cell[] = [];
  for (let i = 0; i < GRID_COLS; i++) {
    for (let j = 0; j < GRID_ROWS; j++) {
      const key = `${i},${j}`;
      if (LOST_CELLS.has(key)) continue;
      const pts = [V[i][j], V[i + 1][j], V[i + 1][j + 1], V[i][j + 1]];
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const bx = Math.min(...xs);
      const by = Math.min(...ys);
      const bw = Math.max(...xs) - bx;
      const bh = Math.max(...ys) - by;
      const clip = pts
        .map((p) => `${(((p.x - bx) / bw) * 100).toFixed(2)}% ${(((p.y - by) / bh) * 100).toFixed(2)}%`)
        .join(', ');
      // Paper curls toward the fire, so the blackest edge is the outside edge.
      const edgeness = Math.max(
        0,
        1 -
          2 *
            Math.min(
              Math.min(bx + bw / 2, 1 - (bx + bw / 2)),
              Math.min(by + bh / 2, 1 - (by + bh / 2)),
            ),
      );
      cells.push({ key, clip, bx, by, bw, bh, char: clamp(edgeness, 0, 1) });
    }
  }
  return cells;
}

/**
 * Where the assembled sheet sits inside the light box, in per-cent.
 *
 * Foolscap portrait, and narrow on purpose: a Notice to Mariners is a tall
 * sheet with a lot of white below the text, and the fragments have to read as
 * pieces of *that* rather than as tiles of an arbitrary rectangle. Everything
 * else — fragment size, home position, scatter — is derived from it, so this
 * is the only number to change if the proportion ever looks wrong.
 */
const FRAME = { left: 37.5, top: 5, width: 25, height: 90 };

function ashGrate(): PuzzleModule {
  const bin = new Bin();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const S = ctx.state;
      const cells = cutNotice();

      let stage = asStr(S.stage, 'grate');
      if (stage !== 'grate' && stage !== 'bench' && stage !== 'register') stage = 'grate';
      const saved = asStrSet(S.saved);
      const lost = asStrSet(S.lost);
      const placed = asStrSet(S.placed);
      let solved = false;

      const save = () => {
        S.stage = stage;
        S.saved = [...saved];
        S.lost = [...lost];
        S.placed = [...placed];
        ctx.save();
      };

      const box = el('div', 'cx cx-ashgrate');
      box.dataset.stage = stage;
      root.appendChild(box);

      // ------------------------------------------------------------------
      // STAGE A — the grate
      // ------------------------------------------------------------------
      const grateStage = el('section', 'cx-grate-stage');
      const grate = el('div', 'cx-grate', {
        role: 'group',
        'aria-label': 'The ash grate. Fourteen fragments in wet ash.',
      });
      grate.appendChild(el('div', 'cx-grate-bars', { 'aria-hidden': 'true' }));
      const tray = el('div', 'cx-tray', {
        role: 'group',
        'aria-label': 'Tray of cold water',
      });
      tray.appendChild(el('span', 'cx-tray-label', {}, 'Cold water'));
      tray.appendChild(el('div', 'cx-tray-shimmer', { 'aria-hidden': 'true' }));
      const grateHead = el('p', 'cx-step', { 'aria-live': 'polite' });
      const grateFoot = el('div', 'cx-foot');
      const toBench = stud(
        'Carry the tray to the Binding Room',
        () => {
          if (saved.size < FRAGMENTS_NEEDED && lost.size < MAX_CRUMBLES) {
            ctx.feedback('bad');
            ctx.note(`${saved.size} in the tray. Eleven is the fewest that will read.`);
            return;
          }
          stage = 'bench';
          save();
          ctx.feedback('click');
          enterBench();
        },
        bin,
        'is-major',
      );
      grateFoot.appendChild(toBench);
      grateStage.append(grateHead, grate, tray, grateFoot);
      box.appendChild(grateStage);

      // The hooded torch. It is not a mechanic — nothing is hidden by it — but
      // raking a cone of light over a wet grate at twenty past one in the
      // morning is most of what this stage is *for*.
      grate.addEventListener(
        'pointermove',
        (ev: PointerEvent) => {
          const r = grate.getBoundingClientRect();
          grate.style.setProperty('--torch-x', `${((ev.clientX - r.left) / r.width) * 100}%`);
          grate.style.setProperty('--torch-y', `${((ev.clientY - r.top) / r.height) * 100}%`);
        },
        { signal: bin.signal },
      );
      grate.addEventListener('pointerleave', () => grate.removeAttribute('style'), {
        signal: bin.signal,
      });

      const flakeEls = new Map<string, HTMLElement>();

      function grateNote() {
        grateHead.textContent =
          `Rake the grate and float each fragment off into the water. ` +
          `${saved.size} lifted, ${14 - saved.size - lost.size} left in the ash` +
          (lost.size ? `, ${lost.size} gone to dust` : '') +
          '.';
        toBench.disabled = saved.size < FRAGMENTS_NEEDED && lost.size < MAX_CRUMBLES;
        toBench.classList.toggle('is-ready', !toBench.disabled);
      }

      function buildGrate() {
        const rnd = seeded(0x0a54_1120);
        cells.forEach((cell, index) => {
          if (saved.has(cell.key) || lost.has(cell.key)) return;
          const flake = el('div', 'cx-flake', {
            'data-cell': cell.key,
            'aria-label': `Fragment ${index + 1} of 14, welded to the iron`,
          });
          flake.style.setProperty('--clip', cell.clip);
          flake.style.setProperty('--char', cell.char.toFixed(2));
          flake.style.left = `${5 + rnd() * 84}%`;
          flake.style.top = `${8 + rnd() * 72}%`;
          flake.style.setProperty('--tilt', `${(rnd() - 0.5) * 60}deg`);
          // Scraps, not sheets. A fourteen-piece heap of quarter-width flakes
          // is a black rectangle; at this size each one is a separate thing the
          // eye can pick out of the ash and the hand can get under.
          flake.style.width = `${4.4 + cell.bw * 8}%`;
          flake.style.aspectRatio = `${cell.bw} / ${cell.bh}`;
          flake.appendChild(el('span', 'cx-flake-crack', { 'aria-hidden': 'true' }));
          grate.appendChild(flake);
          flakeEls.set(cell.key, flake);
          armFlake(cell.key, flake);
        });
      }

      function armFlake(key: string, flake: HTMLElement) {
        let integrity = 1;
        let last = { x: 0, y: 0, t: 0 };

        const settle = () => {
          const fr = flake.getBoundingClientRect();
          const tr = tray.getBoundingClientRect();
          const cx = fr.left + fr.width / 2;
          const cy = fr.top + fr.height / 2;
          if (cx > tr.left && cx < tr.right && cy > tr.top && cy < tr.bottom) {
            saved.add(key);
            flake.remove();
            flakeEls.delete(key);
            ctx.feedback('good');
            ctx.note(`Floated off whole. ${saved.size} in the tray.`);
            grateNote();
            save();
          }
        };

        const crumble = () => {
          // The guard that makes this mechanism honest: three may be destroyed,
          // and the fourth over-hasty pull simply will not come.
          if (lost.size >= MAX_CRUMBLES) {
            integrity = 0.45;
            flake.style.setProperty('--integrity', '0.45');
            ctx.feedback('bad');
            ctx.note('It will not come like that. Slower, or it stays on the iron.');
            return;
          }
          lost.add(key);
          flake.classList.add('is-dust');
          ctx.feedback('bad');
          ctx.note('Gone. That one is ash and always was going to be.');
          bin.after(520, () => {
            flake.remove();
            flakeEls.delete(key);
          });
          grateNote();
          save();
        };

        const drag = bin.own(
          makeDraggable(flake, {
            bounds: grateStage,
            label: `Fragment ${key}`,
            feedback: ctx.feedback,
            onMove: () => {
              const now = performance.now();
              if (!last.t) {
                last = { x: 0, y: 0, t: now };
                return;
              }
              const p = drag.get();
              const dt = Math.max(8, now - last.t);
              const speed = (Math.hypot(p.x - last.x, p.y - last.y) / dt) * 1000;
              last = { x: p.x, y: p.y, t: now };
              if (speed > LIFT_SPEED_MAX) {
                integrity = clamp(integrity - dt / 700, 0, 1);
                flake.style.setProperty('--integrity', integrity.toFixed(3));
                flake.classList.add('is-straining');
                if (integrity <= 0) crumble();
              } else {
                flake.classList.remove('is-straining');
              }
            },
            onDrop: () => {
              last = { x: 0, y: 0, t: 0 };
              flake.classList.remove('is-straining');
              if (integrity > 0 || lost.size >= MAX_CRUMBLES) settle();
            },
          }),
        );

        // The accessible lift: a slow, safe, one-key float across to the water.
        flake.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter' && ev.key !== ' ') return;
            ev.preventDefault();
            ev.stopPropagation();
            if (flake.classList.contains('is-floating')) return;
            flake.classList.add('is-floating');
            ctx.feedback('click');
            const tr = tray.getBoundingClientRect();
            const fr = flake.getBoundingClientRect();
            const p = drag.get();
            drag.set(
              {
                x: p.x + (tr.left + tr.width * 0.5 - (fr.left + fr.width / 2)),
                y: p.y + (tr.top + tr.height * 0.5 - (fr.top + fr.height / 2)),
              },
              true,
            );
            bin.after(760, () => {
              flake.classList.remove('is-floating');
              settle();
            });
          },
          { signal: bin.signal },
        );
      }

      // ------------------------------------------------------------------
      // STAGE B — the light box
      // ------------------------------------------------------------------
      const benchStage = el('section', 'cx-bench-stage');
      const benchHead = el('p', 'cx-step', { 'aria-live': 'polite' });
      const lightbox = el('div', 'cx-lightbox', {
        role: 'group',
        'aria-label': 'Binding Room light box',
      });
      const frame = el('div', 'cx-assembly', { 'aria-hidden': 'true' });
      frame.style.left = `${FRAME.left}%`;
      frame.style.top = `${FRAME.top}%`;
      frame.style.width = `${FRAME.width}%`;
      frame.style.height = `${FRAME.height}%`;
      lightbox.appendChild(frame);
      const benchFoot = el('div', 'cx-foot');
      const toRegister = stud(
        'To the Long Registry, shelf 1/A/9',
        () => {
          stage = 'register';
          save();
          ctx.feedback('click');
          box.dataset.stage = stage;
          registerHead.focus({ preventScroll: true });
        },
        bin,
        'is-major',
      );
      toRegister.disabled = true;
      benchFoot.appendChild(toRegister);
      benchStage.append(benchHead, lightbox, benchFoot);
      box.appendChild(benchStage);

      let benchBuilt = false;

      function noticeSheet(cell: Cell): HTMLElement {
        // Every fragment carries the *whole* notice, offset and clipped. It is
        // why a typed line runs across a join instead of stopping at one.
        const win = el('div', 'cx-frag-win', { 'aria-hidden': 'true' });
        const inner = el('div', 'cx-notice');
        inner.style.width = `${100 / cell.bw}%`;
        inner.style.height = `${100 / cell.bh}%`;
        inner.style.left = `${(-cell.bx / cell.bw) * 100}%`;
        inner.style.top = `${(-cell.by / cell.bh) * 100}%`;
        for (const line of NOTICE_LINES) {
          inner.appendChild(el('p', line ? 'cx-notice-line' : 'cx-notice-gap', {}, line || ' '));
        }
        win.appendChild(inner);
        return win;
      }

      function enterBench() {
        box.dataset.stage = stage;
        if (!benchBuilt) buildBench();
        benchNote();
      }

      function benchNote() {
        const have = [...saved];
        const done = have.filter((k) => placed.has(k)).length;
        benchHead.textContent =
          `Lay the fragments down on their char pattern. Drag to move; wheel, right-drag or ` +
          `the bracket keys to turn in five-degree steps. ${done} of ${have.length} seated.`;
        const ready = done === have.length && have.length > 0;
        toRegister.disabled = !ready;
        toRegister.classList.toggle('is-ready', ready);
        frame.classList.toggle('is-complete', ready);
      }

      function buildBench() {
        benchBuilt = true;
        const rnd = seeded(0x11914);
        for (const cell of cells) {
          if (!saved.has(cell.key)) continue;
          const isPlaced = placed.has(cell.key);
          const frag = el('div', 'cx-frag', {
            'data-cell': cell.key,
            'aria-label': `Fragment ${cell.key}`,
          });
          frag.style.setProperty('--char', cell.char.toFixed(2));
          frag.style.width = `${FRAME.width * cell.bw}%`;
          frag.style.height = `${FRAME.height * cell.bh}%`;

          const homeLeft = FRAME.left + cell.bx * FRAME.width;
          const homeTop = FRAME.top + cell.by * FRAME.height;

          if (isPlaced) {
            frag.style.left = `${homeLeft}%`;
            frag.style.top = `${homeTop}%`;
          } else {
            // Scattered into the two margins the assembly frame leaves free.
            const leftSide = rnd() < 0.5;
            frag.style.left = `${leftSide ? 1 + rnd() * 26 : 70 + rnd() * 26}%`;
            frag.style.top = `${3 + rnd() * 78}%`;
          }

          const spun = el('div', 'cx-frag-spin');
          spun.style.setProperty('--clip', cell.clip);
          spun.appendChild(noticeSheet(cell));
          spun.appendChild(el('span', 'cx-frag-char', { 'aria-hidden': 'true' }));
          spun.appendChild(el('span', 'cx-frag-seat', { 'aria-hidden': 'true' }));
          frag.appendChild(spun);
          lightbox.appendChild(frag);

          if (isPlaced) {
            frag.classList.add('is-placed');
            frag.tabIndex = -1;
            frag.setAttribute('aria-disabled', 'true');
            continue;
          }

          const startRot = Math.round((rnd() * 360) / SNAP_DEG) * SNAP_DEG;
          const rotator = detentRotator({
            host: frag,
            spun,
            stepDeg: SNAP_DEG,
            angle: startRot,
            bin,
            feedback: ctx.feedback,
            onChange: () => trySnap(),
          });

          const drag = bin.own(
            makeDraggable(frag, {
              bounds: lightbox,
              label: `Fragment ${cell.key} of the notice`,
              feedback: ctx.feedback,
              onDrop: () => trySnap(),
            }),
          );

          function trySnap() {
            if (placed.has(cell.key)) return;
            const lb = lightbox.getBoundingClientRect();
            const fr = frag.getBoundingClientRect();
            const wantCx = lb.left + ((homeLeft + (FRAME.width * cell.bw) / 2) / 100) * lb.width;
            const wantCy = lb.top + ((homeTop + (FRAME.height * cell.bh) / 2) / 100) * lb.height;
            const gotCx = fr.left + fr.width / 2;
            const gotCy = fr.top + fr.height / 2;
            const off = Math.hypot(gotCx - wantCx, gotCy - wantCy);
            const rotOff = angleGap(rotator.get(), 0);
            frag.classList.toggle('is-near', off < SNAP_PX * 3 && rotOff <= SNAP_DEG);
            if (off > SNAP_PX || rotOff > SNAP_DEG) return;

            placed.add(cell.key);
            drag.set({ x: 0, y: 0 }, true);
            rotator.set(0);
            frag.style.left = `${homeLeft}%`;
            frag.style.top = `${homeTop}%`;
            frag.classList.remove('is-near');
            frag.classList.add('is-placed');
            frag.setAttribute('aria-disabled', 'true');
            frag.tabIndex = -1;
            drag.destroy();
            ctx.feedback('good');
            benchNote();
            save();
          }
        }
      }

      // ------------------------------------------------------------------
      // STAGE C — the register
      // ------------------------------------------------------------------
      const registerStage = el('section', 'cx-register-stage');
      const registerHead = el('p', 'cx-step', { 'aria-live': 'polite', tabindex: '-1' });
      registerHead.textContent =
        'Register of Notices Issued, 1974. Shelf 1/A/9. Find the number that is not in it.';
      const bookWrap = el('div', 'cx-book', {
        role: 'group',
        'aria-label': 'Register of Notices Issued 1974',
      });
      const bookPage = el('div', 'cx-book-page');
      const bookNav = el('div', 'cx-book-nav');
      registerStage.append(registerHead, bookWrap);
      bookWrap.append(bookPage, bookNav);
      box.appendChild(registerStage);

      const REGISTER_PAGES: { head: string; rows: (string | null)[] }[] = [
        {
          head: 'Notices Issued — January to April 1974',
          rows: [
            '74/101  4.1.74   Buoyage, Ivory Sound, winter marks lifted',
            '74/102  19.1.74  Fog signal, Sowens, out of action 2 days',
            '74/103  6.2.74   Wreck, Cardew Bar, marked by green conical',
            '74/104  28.2.74  Light dues, revised scale of charges',
            '74/105  14.3.74  Brannock Head, temporary character alteration',
            '74/106  2.4.74   Sowens beacon, repainted, no change of character',
          ],
        },
        {
          head: 'Notices Issued — May to July 1974',
          rows: [
            '74/107  11.5.74  Rossport approach, spoil ground extended',
            '74/108  23.5.74  Nine Bells, oil delivery suspended one relief',
            '74/109  9.6.74   St Bride’s, unlit tower, works in progress',
            '74/110  27.6.74  Buoyage revision, Ivory Sound, new legend',
            '74/111  8.7.74   Cadran Point, character confirmed Fl(3) W 15s',
            '74/112  30.7.74  Ferry track, Rossport to Brannock, amended',
          ],
        },
        {
          head: 'Notices Issued — August to October 1974',
          rows: [
            '74/113  2.8.74   Light dues, quarterly reminder to agents',
            '74/114  9.8.74   Nine Bells, relief keeper, no notice required',
            '74/115  14.8.74  Sowens shoal, soundings amended by survey',
            '74/116  15.8.74  Stores, Brannock Head, tender advertised',
            '74/117  16.8.74  Cardew Bar, green conical withdrawn',
            '74/118  16.8.74  Fog signal, Brannock Head, tested and passed',
            null,
            '74/120  4.9.74   Buoyage, Ivory Sound, autumn marks laid',
          ],
        },
        {
          head: 'Notices Issued — November to December 1974',
          rows: [
            '74/121  6.11.74  Wreck, Sowens shoal, position of the Pelagia',
            '74/122  8.11.74  Nine Bells, light re-exhibited, full character',
            '74/123  21.11.74 Buoyage, Cardew Bar, wreck buoy established',
            '74/124  17.12.74 Light dues, scale of charges for 1975',
          ],
        },
      ];

      let page = 2;

      function paintRegister() {
        bookPage.textContent = '';
        const spec = REGISTER_PAGES[page];
        bookPage.appendChild(el('p', 'cx-book-head', {}, spec.head));
        const list = el('ul', 'cx-book-rows');
        spec.rows.forEach((row, i) => {
          const li = el('li', row === null ? 'cx-book-row is-blank' : 'cx-book-row');
          if (row === null) {
            const gap = el('button', 'cx-book-gap', {
              type: 'button',
              'aria-label': 'The ruled line between 74/118 and 74/120, with nothing written on it',
            });
            gap.appendChild(el('span', 'cx-book-gap-rule', { 'aria-hidden': 'true' }));
            gap.appendChild(el('span', 'cx-book-gap-note', {}, 'nothing entered'));
            gap.addEventListener('click', () => finish(), { signal: bin.signal });
            li.appendChild(gap);
          } else {
            const entry = el('button', 'cx-book-entry', { type: 'button' });
            entry.textContent = row;
            entry.addEventListener(
              'click',
              () => {
                ctx.feedback('tick');
                ctx.note(
                  `${row.slice(0, 6)} is entered, cancelled by nobody, and no business of mine.`,
                );
              },
              { signal: bin.signal },
            );
            li.appendChild(entry);
          }
          list.appendChild(li);
          if (i === spec.rows.length - 1) list.appendChild(el('li', 'cx-book-rule'));
        });
        bookPage.appendChild(list);
        bookPage.appendChild(
          el('p', 'cx-book-foot', {}, `Register of Notices Issued, 1974 — folio ${page + 1} of 4`),
        );

        bookNav.textContent = '';
        const back = stud('◀ Back a folio', () => leaf(-1), bin, 'is-slim');
        const fwd = stud('Forward a folio ▶', () => leaf(1), bin, 'is-slim');
        back.disabled = page === 0;
        fwd.disabled = page === REGISTER_PAGES.length - 1;
        bookNav.append(back, fwd);
      }

      function leaf(dir: number) {
        page = clamp(page + dir, 0, REGISTER_PAGES.length - 1);
        ctx.feedback('tick');
        paintRegister();
      }

      function finish() {
        if (solved) return;
        solved = true;
        ctx.feedback('good');
        ctx.note(
          '74/117. 74/118. 74/120. No 74/119, no cancellation, no minute, no gap explained.',
        );
        save();
        ctx.solve();
      }

      // -- bring up whichever stage the save left us in ---------------------
      buildGrate();
      grateNote();
      if (stage === 'grate') {
        ctx.note('Cold water. Nothing warm, nothing quick. It has already been on fire once.');
      } else if (stage === 'bench') {
        enterBench();
      }
      paintRegister();
      if (stage === 'bench' && !benchBuilt) buildBench();
      if (stage !== 'grate') box.dataset.stage = stage;
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// 3 — PER PROCURATIONEM  (Act IV, the Chart Loft light table and the Muniment Room)
// ===========================================================================
//
// The twist, performed rather than narrated, in three movements:
//
//   A  THE SORT     forty-eight documents signed A. FERRIER, out of four
//                   separate custodies. Zoom past 150 per cent and a two-
//                   millimetre 2H pencil "p.p." is either in the bottom left
//                   corner or it is not. No counter of *correctness*, no colour
//                   coding, no running score — the design is explicit about
//                   that, so the only tally on the bench is how many have been
//                   filed, which is housekeeping rather than a score.
//   B  THE DATES    two dates, typed unaided, no list to choose from.
//   C  THE OFFSETS  the Order Book razored out at the gutter. Rake the lamp
//                   across the facing leaf and hold a shaving mirror over the
//                   offset ink, which is a mirror image of a page that no
//                   longer exists.

/** Cards whose date falls inside this window carry the pencil notation. */
const PP_FIRST = '11 August 1974';
const PP_LAST = '18 November 1974';

interface DocCard {
  id: string;
  /** Day offset from 1 August 1974, for ordering and for the date string. */
  dateLabel: string;
  title: string;
  custody: string;
  pp: boolean;
}

const CUSTODIES = ['Strongroom, 14/B', 'Pike’s cottage', 'Enid’s ledgers', 'Ottoline’s tin'];

const DOC_TITLES = [
  'Requisition slip, stores',
  'Order Book countersignature',
  'Light dues remittance advice',
  'Keeper’s wage sheet, certified',
  'Oil requisition, Nine Bells',
  'Notice to Mariners, draft approval',
  'Stationery return, quarterly',
  'Petty cash voucher',
  'Relief roster amendment',
  'Works order, minor repairs',
  'Bank mandate, counter-signature',
  'Board agenda, initialled',
  'Despatch docket, notices',
  'Superannuation return',
  'Tender acceptance, stores',
  'Ferry account, certified correct',
];

/** Formats a 1974 date the way the docket clerks did. */
function dateOf(dayFromAug1: number): string {
  const MONTHS = [
    ['August', 31],
    ['September', 30],
    ['October', 31],
    ['November', 30],
    ['December', 31],
  ] as const;
  let d = dayFromAug1;
  for (const [name, len] of MONTHS) {
    if (d < len) return `${d + 1} ${name} 1974`;
    d -= len;
  }
  return '31 December 1974';
}

/** The forty-eight, built the same way every time so a save reloads onto them. */
function buildDocs(): DocCard[] {
  const docs: DocCard[] = [];
  // The seven genuine, shaky, unmistakably male signatures.
  const genuineDays = [1, 4, 6, 8, 9, 109, 117]; // 2,5,7,9,10 Aug; 18, 26 Nov
  genuineDays.forEach((day, i) => {
    docs.push({
      id: `doc-g${i + 1}`,
      dateLabel: dateOf(day),
      title: DOC_TITLES[(i * 5 + 2) % DOC_TITLES.length],
      custody: CUSTODIES[i % CUSTODIES.length],
      pp: false,
    });
  });
  // Forty-one per procurationem, 11 August to 3 November inclusive.
  for (let i = 0; i < 41; i++) {
    const day = 10 + Math.round((i * 84) / 40);
    docs.push({
      id: `doc-p${i + 1}`,
      dateLabel: dateOf(day),
      title: DOC_TITLES[(i * 7 + 3) % DOC_TITLES.length],
      custody: CUSTODIES[(i * 3 + 1) % CUSTODIES.length],
      pp: true,
    });
  }
  // Shuffled deterministically: four custodies emptied onto one light table.
  const rnd = seeded(0x4148);
  for (let i = docs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [docs[i], docs[j]] = [docs[j], docs[i]];
  }
  return docs;
}

/** Accepts the handful of ways a person actually types a 1974 date. */
function readsAsDate(input: string, day: number, month: number): boolean {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return false;
  const MONTHS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  const name = MONTHS[month - 1];
  const abbr = name.slice(0, 3);
  const yr = '(?:1974|74)';
  const dd = `0?${day}`;
  const mm = `0?${month}`;
  const patterns = [
    `^${dd}(?:st|nd|rd|th)? (?:of )?(?:${name}|${abbr}\\.?) ${yr}$`,
    `^${dd}[./-]${mm}[./-]${yr}$`,
    `^1974[./-]${mm}[./-]${dd}$`,
    `^(?:${name}|${abbr}\\.?) ${dd}(?:st|nd|rd|th)?,? ${yr}$`,
  ];
  return patterns.some((p) => new RegExp(p).test(s));
}

function perProcurationem(): PuzzleModule {
  const bin = new Bin();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const S = ctx.state;
      const docs = buildDocs();
      const byId = new Map(docs.map((d) => [d.id, d]));

      const filed = new Map<string, 'signed' | 'pp'>();
      for (const entry of asList(S.filed)) {
        if (!Array.isArray(entry)) continue;
        const [id, tray] = entry as unknown[];
        if (typeof id === 'string' && (tray === 'signed' || tray === 'pp') && byId.has(id)) {
          filed.set(id, tray);
        }
      }
      let sortDone = asBool(S.sortDone);
      let datesDone = asBool(S.datesDone);
      const readPassages = asStrSet(S.readPassages);
      const citations = asStrSet(S.citations);
      let zoom = clamp(asNum(S.zoom, 100), 100, 220);
      let lampDeg = clamp(asNum(S.lampDeg, 62), 0, 180);
      let solved = false;

      const save = () => {
        S.filed = [...filed.entries()];
        S.sortDone = sortDone;
        S.datesDone = datesDone;
        S.readPassages = [...readPassages];
        S.citations = [...citations];
        S.zoom = Math.round(zoom);
        S.lampDeg = Math.round(lampDeg);
        ctx.save();
      };

      const box = el('div', 'cx cx-pp');
      root.appendChild(box);

      // -- stage rail --------------------------------------------------------
      const rail = el('nav', 'cx-rail', { role: 'tablist', 'aria-label': 'Stages' });
      const panels = el('div', 'cx-panels');
      box.append(rail, panels);

      const STAGES = [
        { id: 'sort', label: 'I · The sort' },
        { id: 'dates', label: 'II · Two dates' },
        { id: 'offsets', label: 'III · The offsets' },
      ];
      let active = sortDone ? (datesDone ? 'offsets' : 'dates') : 'sort';
      const tabs = new Map<string, HTMLButtonElement>();
      const pages = new Map<string, HTMLElement>();

      for (const s of STAGES) {
        const tab = el('button', 'cx-tab', {
          type: 'button',
          role: 'tab',
          id: `cx-tab-${s.id}`,
          'aria-controls': `cx-page-${s.id}`,
        });
        tab.appendChild(el('span', 'cx-tab-face', {}, s.label));
        tab.addEventListener('click', () => show(s.id), { signal: bin.signal });
        tabs.set(s.id, tab);
        rail.appendChild(tab);

        const pg = el('section', 'cx-page', {
          role: 'tabpanel',
          id: `cx-page-${s.id}`,
          'aria-labelledby': `cx-tab-${s.id}`,
        });
        pages.set(s.id, pg);
        panels.appendChild(pg);
      }

      function unlocked(id: string) {
        return id === 'sort' || (id === 'dates' && sortDone) || (id === 'offsets' && datesDone);
      }

      function show(id: string) {
        if (!unlocked(id)) {
          ctx.feedback('bad');
          ctx.note(
            id === 'dates'
              ? 'Not until the trays are ruled off.'
              : 'Not until the boundary dates are down on paper.',
          );
          return;
        }
        active = id;
        for (const [key, tab] of tabs) {
          const on = key === active;
          tab.setAttribute('aria-selected', String(on));
          tab.classList.toggle('is-on', on);
          tab.disabled = !unlocked(key);
          tab.classList.toggle('is-locked', !unlocked(key));
        }
        for (const [key, pg] of pages) pg.hidden = key !== active;
        box.dataset.stage = active;
        if (id === 'offsets') paintOffsets();
      }

      // ------------------------------------------------------------------
      // STAGE A — the sort
      // ------------------------------------------------------------------
      const sortPage = pages.get('sort')!;
      sortPage.appendChild(
        el(
          'p',
          'cx-step',
          { 'aria-live': 'polite', 'data-role': 'sort-step' },
          'Bottom left corner. Two millimetres. Every one of them, and no assuming.',
        ),
      );
      const sortStep = sortPage.querySelector<HTMLElement>('[data-role="sort-step"]')!;

      const sortBody = el('div', 'cx-sort-body');
      sortPage.appendChild(sortBody);

      const table = el('div', 'cx-table', {
        role: 'listbox',
        'aria-label': 'Forty-eight documents signed A. FERRIER',
        tabindex: '0',
      });
      const viewer = el('div', 'cx-viewer');
      sortBody.append(table, viewer);

      const cardEls = new Map<string, HTMLElement>();
      let cursor = 0;

      docs.forEach((doc, i) => {
        const card = el('button', 'cx-card', {
          type: 'button',
          role: 'option',
          'aria-selected': 'false',
          'data-doc': doc.id,
        });
        card.appendChild(el('span', 'cx-card-date', {}, doc.dateLabel));
        card.appendChild(el('span', 'cx-card-title', {}, doc.title));
        card.appendChild(el('span', 'cx-card-custody', {}, doc.custody));
        card.appendChild(el('span', 'cx-card-sig', { 'aria-hidden': 'true' }, 'A. Ferrier'));
        card.appendChild(el('span', 'cx-card-filed', { 'aria-hidden': 'true' }));
        card.tabIndex = i === 0 ? 0 : -1;
        card.addEventListener('click', () => select(i), { signal: bin.signal });
        cardEls.set(doc.id, card);
        table.appendChild(card);
      });

      // The zoom viewer. The pencil notation is drawn at native resolution into
      // a canvas, so it genuinely does not resolve below about 150 per cent —
      // the player is looking harder, not being told a fact.
      const glassWrap = el('div', 'cx-glass-wrap');
      const canvas = el('canvas', 'cx-corner-canvas', {
        role: 'img',
        'aria-label': 'The lower left corner of the selected document, magnified',
      });
      glassWrap.appendChild(canvas);
      glassWrap.appendChild(el('span', 'cx-glass-ring', { 'aria-hidden': 'true' }));
      const viewerCap = el('p', 'cx-viewer-cap', { 'aria-live': 'polite' });
      const zoomCtl = bin.own(
        makeSlider({
          label: 'Magnification',
          min: 100,
          max: 220,
          step: 2,
          value: zoom,
          length: 'clamp(7rem, 22cqw, 13rem)',
          format: (v) => `${v}%`,
          feedback: ctx.feedback,
          onChange: (v) => {
            zoom = v;
            drawCorner();
            save();
          },
        }),
      );
      const trays = el('div', 'cx-trays', { role: 'group', 'aria-label': 'Trays' });
      const traySigned = stud('File as SIGNED', () => file('signed'), bin, 'is-tray');
      const trayPp = stud('File as P.P.', () => file('pp'), bin, 'is-tray');
      trays.append(traySigned, trayPp);
      viewer.append(
        el('p', 'cx-viewer-head', {}, 'Light table, 4× glass'),
        glassWrap,
        zoomCtl.el,
        viewerCap,
        trays,
        plate('Standing Order 4 — Registry', [
          'If the Warden is absent her clerk may initial in her stead.',
          'The initialling is to be marked p.p. in the lower left corner.',
          'No entry is required of the name of the person initialling.',
        ]),
      );

      const ruleOff = stud(
        'Rule off the trays',
        () => {
          if (filed.size < docs.length) {
            ctx.feedback('bad');
            ctx.note(`${docs.length - filed.size} still on the table. All of them, or none.`);
            return;
          }
          const wrong = docs.filter((d) => filed.get(d.id) !== (d.pp ? 'pp' : 'signed'));
          if (wrong.length) {
            ctx.feedback('bad');
            ctx.note('The trays do not agree with the paper. Somewhere in here I have assumed.');
            return;
          }
          sortDone = true;
          save();
          ctx.feedback('good');
          ctx.note('Forty-one and seven. Nothing was forged.');
          show('dates');
        },
        bin,
        'is-major',
      );
      sortPage.appendChild(ruleOff);

      function select(i: number) {
        cursor = clamp(i, 0, docs.length - 1);
        docs.forEach((d, n) => {
          const c = cardEls.get(d.id)!;
          c.classList.toggle('is-selected', n === cursor);
          c.setAttribute('aria-selected', String(n === cursor));
          c.tabIndex = n === cursor ? 0 : -1;
        });
        drawCorner();
        cardEls.get(docs[cursor].id)!.focus({ preventScroll: true });
      }

      function file(tray: 'signed' | 'pp') {
        const doc = docs[cursor];
        filed.set(doc.id, tray);
        const card = cardEls.get(doc.id)!;
        card.dataset.tray = tray;
        card.querySelector('.cx-card-filed')!.textContent = tray === 'pp' ? 'p.p.' : 'signed';
        ctx.feedback('click');
        sortStep.textContent =
          filed.size === docs.length
            ? 'Forty-eight filed. Rule off the trays.'
            : `${filed.size} filed, ${docs.length - filed.size} to go.`;
        ctx.note(sortStep.textContent);
        save();
        // Advance to the next unfiled document: the housekeeping rhythm.
        const next = docs.findIndex((d, n) => n > cursor && !filed.has(d.id));
        const wrap = next >= 0 ? next : docs.findIndex((d) => !filed.has(d.id));
        if (wrap >= 0) select(wrap);
      }

      table.addEventListener(
        'keydown',
        (ev: KeyboardEvent) => {
          if (ev.key === '1' || ev.key === '2') {
            ev.preventDefault();
            ev.stopPropagation();
            file(ev.key === '1' ? 'signed' : 'pp');
            return;
          }
          const cols = 4;
          let next: number | null = null;
          if (ev.key === 'ArrowRight') next = cursor + 1;
          else if (ev.key === 'ArrowLeft') next = cursor - 1;
          else if (ev.key === 'ArrowDown') next = cursor + cols;
          else if (ev.key === 'ArrowUp') next = cursor - cols;
          else if (ev.key === 'Home') next = 0;
          else if (ev.key === 'End') next = docs.length - 1;
          if (next === null) return;
          ev.preventDefault();
          ev.stopPropagation();
          select(clamp(next, 0, docs.length - 1));
        },
        { signal: bin.signal },
      );

      function drawCorner() {
        const c2d = fitCanvas(canvas);
        if (!c2d) return;
        const { w, h } = cssSize(canvas);
        const doc = docs[cursor];
        const k = zoom / 100;
        /* The glass is a circle, so everything is laid out against the largest
           square that fits inside it, inset by the bezel. Drawing to the full
           canvas box puts the left margin of the document behind the rim. */
        const pad = w * 0.14;
        const L = pad;
        const R = w - pad;
        const IW = R - L;

        c2d.clearRect(0, 0, w, h);
        // Paper.
        const grad = c2d.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#efe3c6');
        grad.addColorStop(1, '#d9c8a2');
        c2d.fillStyle = grad;
        c2d.fillRect(0, 0, w, h);
        // Foxing, so the corner reads as an object rather than a swatch.
        const rnd = seeded(doc.id.length * 977 + doc.dateLabel.length * 31);
        c2d.globalAlpha = 0.09;
        for (let i = 0; i < 40; i++) {
          c2d.fillStyle = '#8a6b3d';
          const r = 2 + rnd() * 7 * k;
          c2d.beginPath();
          c2d.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
          c2d.fill();
        }
        c2d.globalAlpha = 1;

        // The typed foot of the document, and the signature.
        c2d.fillStyle = '#3a2e20';
        c2d.font = `${Math.min(IW * 0.052, 9 * k)}px "IBM Plex Mono", ui-monospace, monospace`;
        c2d.fillText(doc.title.toUpperCase(), L, h * 0.26);
        c2d.fillText(doc.dateLabel, L, h * 0.37);
        c2d.fillText(doc.custody, L, h * 0.48);

        c2d.save();
        c2d.translate(L + IW * 0.3, h * 0.7);
        c2d.rotate(-0.05);
        c2d.fillStyle = '#1d2a3a';
        c2d.font = `italic ${Math.min(IW * 0.13, 20 * k)}px "Cormorant Garamond", Georgia, serif`;
        c2d.fillText('A. Ferrier', 0, 0);
        // A genuine hand is shaky; a clerk's forgery-free initialling is not,
        // but the signature itself is the same signature in both trays, which is
        // the entire point of the puzzle. So the wobble is cosmetic only.
        c2d.restore();

        c2d.strokeStyle = 'rgba(60,44,26,0.5)';
        c2d.lineWidth = 1;
        c2d.beginPath();
        c2d.moveTo(L + IW * 0.28, h * 0.76);
        c2d.lineTo(R, h * 0.76);
        c2d.stroke();
        c2d.fillStyle = '#4a3a26';
        c2d.font = `${Math.min(IW * 0.042, 7 * k)}px "IBM Plex Mono", ui-monospace, monospace`;
        c2d.fillText('WARDEN', L + IW * 0.28, h * 0.83);

        // The two millimetres of 2H pencil. Alpha and stroke width both ramp
        // with magnification: below about 150 per cent it is a smudge in the
        // fibre and above it is unmistakably the letters p and p.
        if (doc.pp) {
          const reveal = clamp((zoom - 118) / 58, 0, 1);
          c2d.save();
          c2d.globalAlpha = 0.16 + reveal * 0.62;
          c2d.strokeStyle = '#4b4a46';
          c2d.lineWidth = Math.max(0.5, 0.55 * k);
          c2d.font = `${Math.min(IW * 0.04, 6.5 * k)}px "IBM Plex Mono", ui-monospace, monospace`;
          c2d.fillStyle = `rgba(63,62,58,${0.2 + reveal * 0.62})`;
          c2d.fillText('p.p.', L, h * 0.84);
          c2d.restore();
        }

        viewerCap.textContent =
          zoom < 150
            ? `${doc.dateLabel} · ${doc.custody} · at ${zoom}% the corner is fibre and nothing else.`
            : doc.pp
              ? `${doc.dateLabel} · ${doc.custody} · two millimetres of 2H pencil: p.p.`
              : `${doc.dateLabel} · ${doc.custody} · the corner is clean. Nothing pencilled at all.`;
      }

      bin.observe(canvas, drawCorner);

      // ------------------------------------------------------------------
      // STAGE B — two dates, typed unaided
      // ------------------------------------------------------------------
      const datesPage = pages.get('dates')!;
      datesPage.appendChild(
        el(
          'p',
          'cx-step',
          {},
          'The casebook wants the boundary dates. No list, no autocomplete: what the paper says, in my own hand.',
        ),
      );
      const casebook = el('div', 'cx-casebook');
      const fields: HTMLInputElement[] = [];
      const dateSpecs = [
        {
          label: 'First document initialled per procurationem',
          hint: 'the day the hand changes',
          day: 11,
          month: 8,
        },
        {
          label: 'First genuine signature after the window',
          hint: 'the day it changes back',
          day: 18,
          month: 11,
        },
      ];
      dateSpecs.forEach((spec, i) => {
        const rowEl = el('label', 'cx-date-row');
        rowEl.appendChild(el('span', 'cx-date-label', {}, spec.label));
        const input = el('input', 'cx-date-input', {
          type: 'text',
          inputmode: 'text',
          autocomplete: 'off',
          spellcheck: 'false',
          placeholder: 'e.g. 4 July 1974',
          'aria-describedby': `cx-date-hint-${i}`,
        });
        input.value = asStr(asList(S.dateEntries)[i], '');
        fields.push(input);
        rowEl.appendChild(input);
        rowEl.appendChild(el('span', 'cx-date-hint', { id: `cx-date-hint-${i}` }, spec.hint));
        rowEl.appendChild(el('span', 'cx-date-mark', { 'aria-hidden': 'true' }));
        casebook.appendChild(rowEl);
      });
      const spanNote = el('p', 'cx-span', { 'aria-live': 'polite' });
      casebook.appendChild(spanNote);
      datesPage.append(casebook);
      datesPage.appendChild(
        plate('Charter of 1811, Article 9 — Board Room charter case', [
          'The office of Warden is reserved to a man of full age.',
          'Whereby, for ninety-nine days in 1974, the Authority had no Warden at all',
          'and every act of it was lawful.',
        ]),
      );

      function checkDates(announce: boolean) {
        const ok = dateSpecs.map((spec, i) => readsAsDate(fields[i].value, spec.day, spec.month));
        fields.forEach((f, i) => {
          f.parentElement!.classList.toggle('is-right', ok[i]);
          f.parentElement!.classList.toggle('is-typed', f.value.trim().length > 0 && !ok[i]);
        });
        S.dateEntries = fields.map((f) => f.value);
        if (ok.every(Boolean)) {
          spanNote.textContent = `${PP_FIRST} to ${PP_LAST}. Ninety-nine days, taken off the paper.`;
          if (!datesDone) {
            datesDone = true;
            ctx.feedback('good');
            ctx.note('Both dates. Ninety-nine days, and nobody ever had to write down whose hand.');
            save();
            show('offsets');
            return;
          }
        } else {
          spanNote.textContent = ok.some(Boolean)
            ? 'One of the two agrees with the paper.'
            : 'Nothing yet.';
          if (announce) ctx.feedback('tick');
        }
        save();
      }

      for (const f of fields) {
        f.addEventListener('input', () => checkDates(false), { signal: bin.signal });
        f.addEventListener(
          'keydown',
          (ev: KeyboardEvent) => {
            // The bench swallows plain keys globally; a text field must keep them.
            ev.stopPropagation();
            if (ev.key === 'Enter') checkDates(true);
          },
          { signal: bin.signal },
        );
      }

      // ------------------------------------------------------------------
      // STAGE C — the offsets, a lamp and a shaving mirror
      // ------------------------------------------------------------------
      const OFFSET_PASSAGES = [
        {
          id: 'deferment',
          y: 0.30,
          text: 'RELIEF KEEPER DEFERRED 18.8.74 — WAGES TO CONTINUE',
          reading: 'The relief keeper deferred, 18 August 1974, wages to continue.',
        },
        {
          id: 'r741',
          y: 0.52,
          text: 'REQUISITION R.741 REFUSED — NO FUNDS THIS QUARTER',
          reading: 'R.741 refused. No funds this quarter.',
        },
        {
          id: 'r748',
          y: 0.72,
          text: 'REQUISITION R.748 REFUSED — SEE ENTRY ABOVE',
          reading: 'R.748 refused. See entry above.',
        },
      ];
      /** Degrees of lamp arm at which the offset ink stands out of the leaf. */
      const RAKE_BEST = 15;
      const RAKE_BAND = 9;

      const offsetsPage = pages.get('offsets')!;
      offsetsPage.appendChild(
        el(
          'p',
          'cx-step',
          { 'aria-live': 'polite', 'data-role': 'off-step' },
          'The leaves are razored out at the gutter. Rake the lamp low and hold the mirror over the offsets.',
        ),
      );
      const offStep = offsetsPage.querySelector<HTMLElement>('[data-role="off-step"]')!;

      const offBody = el('div', 'cx-off-body');
      const leaf = el('div', 'cx-leaf', {
        role: 'group',
        'aria-label': 'The facing leaf of the Order Book, 1972 to 1976',
      });
      const pageCanvas = el('canvas', 'cx-leaf-canvas', { 'aria-hidden': 'true' });
      const stubs = el('div', 'cx-stubs', { 'aria-hidden': 'true' });
      for (let i = 0; i < 7; i++) {
        const stub = el('span', 'cx-stub');
        stub.style.setProperty('--n', String(i));
        stubs.appendChild(stub);
      }
      const mirror = el('div', 'cx-mirror', {
        'aria-label': 'Shaving mirror. Drag it over the offset ink.',
      });
      const mirrorCanvas = el('canvas', 'cx-mirror-canvas', { 'aria-hidden': 'true' });
      mirror.append(mirrorCanvas, el('span', 'cx-mirror-rim', { 'aria-hidden': 'true' }));
      leaf.append(pageCanvas, stubs, mirror);

      const offSide = el('div', 'cx-off-side');
      const lampCtl = bin.own(
        makeSlider({
          label: 'Lamp arm',
          min: 0,
          max: 180,
          step: 1,
          value: lampDeg,
          length: 'clamp(6rem, 20cqw, 11rem)',
          format: (v) => `${v}°`,
          feedback: ctx.feedback,
          onChange: (v) => {
            lampDeg = v;
            paintOffsets();
            save();
          },
        }),
      );
      const readOff = stud('Read it off', () => transcribe(), bin, 'is-major');
      const transcript = el('ul', 'cx-transcript', {
        'aria-label': 'Passages recovered from the offsets',
      });
      offSide.append(
        el('p', 'cx-viewer-head', {}, 'Raking light'),
        lampCtl.el,
        readOff,
        el('p', 'cx-off-cap', { 'aria-live': 'polite', 'data-role': 'off-cap' }),
        transcript,
      );
      const offCap = offSide.querySelector<HTMLElement>('[data-role="off-cap"]')!;
      offBody.append(leaf, offSide);
      offsetsPage.appendChild(offBody);

      // Citation column — the three independent proofs of incapacity.
      const CITE_CHIPS = [
        { id: 'munn', label: 'Dr Munn’s locum mileage claims, from 12 August', right: true },
        { id: 'kilbride', label: 'Nurse Kilbride’s ledger: cannot hold pen', right: true },
        { id: 'offsets', label: 'The razored-leaf offsets themselves', right: true },
        { id: 'ferry', label: 'The ferry booking book, 14 September 1998', right: false },
        { id: 'charter', label: 'Article 9 of the Charter of 1811', right: false },
        { id: 'tin', label: 'Ottoline’s biscuit tin, four documents', right: false },
      ];
      const citeWrap = el('div', 'cx-cite');
      citeWrap.appendChild(
        el(
          'p',
          'cx-cite-head',
          {},
          'Casebook, citation column: three independent proofs that the Warden could not have signed.',
        ),
      );
      const citeSlots = el('div', 'cx-cite-slots', { 'aria-label': 'Three citation slots' });
      for (let i = 0; i < 3; i++) {
        citeSlots.appendChild(el('div', 'cx-cite-slot', { 'data-slot': String(i) }));
      }
      const citeList = el('div', 'cx-chips', { role: 'group', 'aria-label': 'Exhibits to hand' });
      for (const chip of CITE_CHIPS) {
        const b = el('button', 'cx-chip', { type: 'button', 'data-chip': chip.id });
        b.appendChild(el('span', 'cx-chip-face', {}, chip.label));
        b.addEventListener('click', () => cite(chip.id), { signal: bin.signal });
        citeList.appendChild(b);
      }
      citeWrap.append(citeSlots, citeList);
      offsetsPage.appendChild(citeWrap);

      function cite(id: string) {
        const chip = CITE_CHIPS.find((c) => c.id === id);
        if (!chip) return;
        if (citations.has(id)) {
          citations.delete(id);
          ctx.feedback('tick');
          ctx.note(`Struck out: ${chip.label}`);
        } else {
          if (citations.size >= 3) {
            ctx.feedback('bad');
            ctx.note('Three slots. Take one out before you put another in.');
            return;
          }
          citations.add(id);
          // No verdict on the way in. The column is read when it is full, the
          // way a citation column is, and never chip by chip.
          ctx.feedback('click');
          ctx.note(`Into the column: ${chip.label}`);
        }
        paintCitations();
        save();
        checkWin();
      }

      function paintCitations() {
        const slots = [...citeSlots.querySelectorAll<HTMLElement>('.cx-cite-slot')];
        const held = [...citations];
        slots.forEach((slot, i) => {
          const id = held[i];
          slot.textContent = '';
          slot.classList.toggle('is-filled', Boolean(id));
          if (!id) {
            slot.appendChild(el('span', 'cx-cite-empty', {}, '—'));
            return;
          }
          const chip = CITE_CHIPS.find((c) => c.id === id)!;
          const pinned = el('button', 'cx-cite-pinned', { type: 'button' }, chip.label);
          pinned.addEventListener('click', () => cite(id), { signal: bin.signal });
          slot.appendChild(pinned);
        });
        for (const b of citeList.querySelectorAll<HTMLElement>('.cx-chip')) {
          b.classList.toggle('is-cited', citations.has(b.dataset.chip ?? ''));
          b.setAttribute('aria-pressed', String(citations.has(b.dataset.chip ?? '')));
        }
      }

      // The mirror. Position is a drag translation on top of a percentage home,
      // exactly as the jigsaw does it, so a resized bench does not lose it.
      const mirrorDrag = bin.own(
        makeDraggable(mirror, {
          bounds: leaf,
          label: 'Shaving mirror',
          feedback: ctx.feedback,
          position: { x: asNum(S.mirrorX, 0), y: asNum(S.mirrorY, 0) },
          onMove: () => paintOffsets(),
          onDrop: () => {
            const p = mirrorDrag.get();
            S.mirrorX = Math.round(p.x);
            S.mirrorY = Math.round(p.y);
            save();
          },
        }),
      );

      /** How strongly the offset ink is standing out at the current lamp angle. */
      const rakeStrength = () => clamp(1 - Math.abs(lampDeg - RAKE_BEST) / RAKE_BAND, 0, 1);

      /** Which passage, if any, the mirror is sitting on. */
      function passageUnderMirror(): (typeof OFFSET_PASSAGES)[number] | null {
        const lr = leaf.getBoundingClientRect();
        const mr = mirror.getBoundingClientRect();
        const cy = mr.top + mr.height / 2 - lr.top;
        for (const p of OFFSET_PASSAGES) {
          if (Math.abs(cy - p.y * lr.height) < Math.max(18, mr.height * 0.45)) return p;
        }
        return null;
      }

      function drawLeaf(c2d: CanvasRenderingContext2D, w: number, h: number, flip: boolean) {
        const strength = rakeStrength();
        c2d.save();
        if (flip) {
          c2d.translate(w, 0);
          c2d.scale(-1, 1);
        }
        // The leaf: warm ledger paper with a low raking gradient across it.
        const g = c2d.createLinearGradient(0, 0, w * 0.4, h);
        g.addColorStop(0, '#e3d5b4');
        g.addColorStop(0.5, '#d8c8a4');
        g.addColorStop(1, '#c9b790');
        c2d.fillStyle = g;
        c2d.fillRect(0, 0, w, h);
        // Ruling.
        c2d.strokeStyle = 'rgba(90,110,120,0.22)';
        c2d.lineWidth = 1;
        for (let y = h * 0.1; y < h * 0.95; y += Math.max(11, h / 22)) {
          c2d.beginPath();
          c2d.moveTo(w * 0.06, y);
          c2d.lineTo(w * 0.94, y);
          c2d.stroke();
        }
        c2d.strokeStyle = 'rgba(150,60,50,0.3)';
        c2d.beginPath();
        c2d.moveTo(w * 0.14, 0);
        c2d.lineTo(w * 0.14, h);
        c2d.stroke();
        // The Order Book's own surviving entries, upright and useless.
        c2d.fillStyle = 'rgba(48,40,28,0.55)';
        c2d.font = `${Math.max(8, h * 0.026)}px "IBM Plex Mono", ui-monospace, monospace`;
        c2d.fillText('WARDEN’S ORDER BOOK 1972–76', w * 0.17, h * 0.075);
        c2d.fillText('LEAVES 214–220 REMOVED AT THE GUTTER', w * 0.17, h * 0.115);
        c2d.fillText('[remainder blank]', w * 0.17, h * 0.93);

        // The offsets: mirror-image ink pressed off the leaf that is gone. Drawn
        // reversed on the page itself, which is what makes the shaving mirror a
        // reading instrument rather than a gimmick.
        for (const p of OFFSET_PASSAGES) {
          const read = readPassages.has(p.id);
          c2d.save();
          c2d.globalAlpha = 0.1 + strength * 0.66;
          c2d.fillStyle = read ? 'rgba(38,34,26,0.9)' : 'rgba(58,52,40,0.85)';
          c2d.font = `${Math.max(9, h * 0.032)}px "IBM Plex Mono", ui-monospace, monospace`;
          // Offset ink is mirrored; the flip in the mirror widget undoes it.
          c2d.translate(w * 0.9, p.y * h);
          c2d.scale(-1, 1);
          c2d.fillText(p.text, 0, 0);
          c2d.restore();
        }
        c2d.restore();
      }

      function paintOffsets() {
        const pc = fitCanvas(pageCanvas);
        if (pc) {
          const { w, h } = cssSize(pageCanvas);
          pc.clearRect(0, 0, w, h);
          drawLeaf(pc, w, h, false);
        }
        const mc = fitCanvas(mirrorCanvas);
        if (mc) {
          const lr = leaf.getBoundingClientRect();
          const mr = mirror.getBoundingClientRect();
          const { w, h } = cssSize(mirrorCanvas);
          mc.clearRect(0, 0, w, h);
          mc.save();
          // Show the leaf as the mirror sees it: horizontally flipped, and
          // offset so the glass shows the paper directly beneath it.
          mc.translate(w, 0);
          mc.scale(-1, 1);
          mc.translate(-(mr.left - lr.left), -(mr.top - lr.top));
          drawLeaf(mc, lr.width, lr.height, false);
          mc.restore();
        }
        const strength = rakeStrength();
        leaf.dataset.rake = strength > 0.6 ? 'good' : strength > 0.2 ? 'some' : 'none';
        const under = passageUnderMirror();
        const legible = Boolean(under) && strength > 0.55 && !readPassages.has(under!.id);
        readOff.disabled = !legible;
        readOff.classList.toggle('is-ready', legible);
        offCap.textContent =
          strength <= 0.2
            ? `Lamp at ${lampDeg}°. Straight on, the leaf is blank paper. Rake it low.`
            : !under
              ? `Lamp at ${lampDeg}°. Something is standing out of the leaf. The mirror is not over it.`
              : readPassages.has(under.id)
                ? `Already transcribed: ${under.reading}`
                : legible
                  ? 'Reversed in the glass, it reads.'
                  : `Lamp at ${lampDeg}°. Nearly. A little lower.`;
        offStep.textContent = `${readPassages.size} of three passages recovered.`;
      }

      function transcribe() {
        const under = passageUnderMirror();
        if (!under || rakeStrength() <= 0.55 || readPassages.has(under.id)) {
          ctx.feedback('bad');
          return;
        }
        readPassages.add(under.id);
        ctx.feedback('good');
        ctx.note(under.reading);
        paintTranscript();
        paintOffsets();
        save();
        checkWin();
      }

      function paintTranscript() {
        transcript.textContent = '';
        for (const p of OFFSET_PASSAGES) {
          if (!readPassages.has(p.id)) continue;
          const li = el('li', 'cx-transcript-line');
          li.appendChild(el('span', 'cx-transcript-mark', { 'aria-hidden': 'true' }));
          li.appendChild(el('span', '', {}, p.reading));
          transcript.appendChild(li);
        }
      }

      function checkWin() {
        if (solved) return;
        if (!sortDone || !datesDone) return;
        if (readPassages.size < 3) return;
        if (citations.size !== 3) return;
        if (![...citations].every((id) => CITE_CHIPS.find((c) => c.id === id)?.right)) return;
        solved = true;
        save();
        ctx.feedback('good');
        ctx.note('Forty-one and seven, two dates, three passages, three proofs.');
        ctx.solve();
      }

      bin.observe(leaf, paintOffsets);

      // -- open on whatever the save left ------------------------------------
      for (const doc of docs) {
        const tray = filed.get(doc.id);
        if (!tray) continue;
        const card = cardEls.get(doc.id)!;
        card.dataset.tray = tray;
        card.querySelector('.cx-card-filed')!.textContent = tray === 'pp' ? 'p.p.' : 'signed';
      }
      if (filed.size) {
        sortStep.textContent =
          filed.size === docs.length
            ? 'Forty-eight filed. Rule off the trays.'
            : `${filed.size} filed, ${docs.length - filed.size} to go.`;
      }
      select(Math.max(0, docs.findIndex((d) => !filed.has(d.id))));
      checkDates(false);
      paintCitations();
      paintTranscript();
      show(active);
      paintOffsets();
      checkWin();
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// 4 — THE SEPTEMBER SPOOL  (Act IV, the Stationery Store and the bench)
// ===========================================================================
//
// The cipher, and the game's cleanest statement of its own thesis. A used
// fabric ribbon is a serial record: it holds every character struck on it,
// once, in order, and — because the type strikes through it — mirrored and
// running the wrong way. Two toggles orient it and a focus knob sharpens it,
// and none of that is the puzzle.
//
// The puzzle is the SEQUENCE. The words are not the evidence; the fact that one
// sentence has another sentence physically behind it on the same unbroken strip
// of fabric is the evidence. So the mechanism is: wind, find every splice and
// eyelet and colour break there is, pin a marker on each, pin the two dated
// passages, and only then commit an assertion about what lies between them.
//
// Committing "no ribbon change between" while a splice is still unmarked is
// deliberately possible. It solves the puzzle and it writes `unsafeAssertion`
// into the saved state, which the Board reads in Act V, where Pargeter strikes
// it in front of her.

/** Length of the spool, in ribbon millimetres. */
const RIBBON_MM = 1800;
/** Width of one struck character. */
const CHAR_MM = 1.7;
/** How much ribbon the magnifier shows at once. */
const WINDOW_MM = 250;
/** Pin tolerance when placing a marker, in millimetres. */
const PIN_MM = 16;
/** Millimetres of ribbon per degree of crank. */
const MM_PER_DEG = 0.62;

interface RibbonRun {
  mm: number;
  text: string;
  /** Set on the two dated passages the casebook wants. */
  passage?: 'a' | 'b';
  reading?: string;
}

const RIBBON_RUNS: RibbonRun[] = [
  { mm: 16, text: 'STATIONERY RETURNS QUARTER ENDED 31.8.98   E. CHARNOCK' },
  { mm: 180, text: 'MEMORANDUM TO CASHIER - PETTY CASH VOUCHER 41' },
  { mm: 400, text: 'BOARD OF DISSOLUTION: DRAFT AGENDA, ITEM 4, DISPOSAL OF THE RECORD' },
  { mm: 640, text: 'RIBBON SPLICED 8.9.98  E.C.' },
  { mm: 760, text: 'SCHEDULE OF OUTSTANDING LIABILITIES - ITEM 14' },
  {
    mm: 980,
    text: 'I KNOW WHAT YOU MEAN TO SEND. PLEASE DO NOT SEND IT. THERE IS NOTHING IN IT THAT CAN HELP ANYBODY NOW.  S.',
    passage: 'a',
    reading:
      '12.9.98 — ‘I know what you mean to send. Please do not send it. There is nothing in it that can help anybody now. S.’',
  },
  {
    mm: 1290,
    text: 'ACCIDENT REPORT 14.9.98 - DECEASED FOUND AT THE FOOT OF THE GALLERY STAIR AT 09.22 BY H. PIKE',
    passage: 'b',
    reading: '14.9.98 — the accident report. Same ribbon, same fabric, three hundred millimetres on.',
  },
  { mm: 1560, text: 'REQUISITION SLIP R.98/2404 - FOUR REAMS DUPLICATING' },
];

/** Physical features on the strip. Two splices, and both must be found. */
const RIBBON_FEATURES: { mm: number; kind: 'splice' | 'eyelet'; note: string }[] = [
  { mm: 0, kind: 'splice', note: 'A splice at the head, where the spool was made up on 2.9.98.' },
  { mm: 612, kind: 'splice', note: 'A splice at the eighth of September. Stitched, and unmistakable.' },
];

const MARKER_KINDS = [
  { id: 'splice', label: 'Splice', glyph: '▲' },
  { id: 'eyelet', label: 'Eyelet', glyph: '●' },
  { id: 'colour', label: 'Colour break', glyph: '▮' },
  { id: 'passage-a', label: 'Passage 12.9.98', glyph: '✦' },
  { id: 'passage-b', label: 'Passage 14.9.98', glyph: '✦' },
] as const;

type MarkerKind = (typeof MARKER_KINDS)[number]['id'];
interface Marker {
  mm: number;
  kind: MarkerKind;
}

function septemberSpool(): PuzzleModule {
  const bin = new Bin();

  return {
    mount(root: HTMLElement, ctx: PuzzleContext) {
      const S = ctx.state;

      let pos = clamp(asNum(S.pos, 0), 0, RIBBON_MM - WINDOW_MM);
      let mirrorOn = asBool(S.mirror);
      let reverseOn = asBool(S.reverse);
      let focus = clamp(asNum(S.focus, 20), 0, 100);
      let picked: MarkerKind = 'splice';
      const markers: Marker[] = asList(S.markers)
        .map((m) => {
          if (typeof m !== 'object' || m === null) return null;
          const rec = m as Record<string, unknown>;
          const kind = asStr(rec.kind) as MarkerKind;
          if (!MARKER_KINDS.some((k) => k.id === kind)) return null;
          return { mm: clamp(asNum(rec.mm, 0), 0, RIBBON_MM), kind };
        })
        .filter((m): m is Marker => m !== null);
      const readRuns = asStrSet(S.readRuns);
      let solved = false;

      const save = () => {
        S.pos = Math.round(pos);
        S.mirror = mirrorOn;
        S.reverse = reverseOn;
        S.focus = Math.round(focus);
        S.markers = markers.map((m) => ({ mm: Math.round(m.mm), kind: m.kind }));
        S.readRuns = [...readRuns];
        ctx.save();
      };

      const box = el('div', 'cx cx-spool');
      root.appendChild(box);

      // -- the deck ----------------------------------------------------------
      const deck = el('div', 'cx-deck');
      const spoolL = el('div', 'cx-spool-hub is-left', { 'aria-hidden': 'true' });
      const spoolR = el('div', 'cx-spool-hub is-right', { 'aria-hidden': 'true' });
      spoolL.appendChild(el('span', 'cx-spool-flange'));
      spoolR.appendChild(el('span', 'cx-spool-flange'));

      const gate = el('div', 'cx-gate', {
        role: 'img',
        'aria-label': 'The ribbon under the magnifier',
      });
      const strip = el('canvas', 'cx-strip', { 'aria-hidden': 'true' });
      const hair = el('span', 'cx-hair', { 'aria-hidden': 'true' });
      const magnifier = el('span', 'cx-magnifier', { 'aria-hidden': 'true' });
      gate.append(strip, hair, magnifier);
      deck.append(spoolL, gate, spoolR);
      box.appendChild(deck);

      const readLine = el('p', 'cx-spool-read', { 'aria-live': 'polite' });
      box.appendChild(readLine);

      // -- controls ----------------------------------------------------------
      const controls = el('div', 'cx-controls');

      // The crank. Angle accumulates; the delta is what feeds the ribbon, so a
      // player can wind for ever in one direction the way a real winder does.
      const crankWrap = el('div', 'cx-crank-wrap');
      const crank = el('div', 'cx-crank', {
        role: 'slider',
        tabindex: '0',
        'aria-label': 'Winder crank',
        'aria-valuemin': '0',
        'aria-valuemax': String(RIBBON_MM),
      });
      crank.appendChild(el('span', 'cx-crank-arm', { 'aria-hidden': 'true' }));
      crank.appendChild(el('span', 'cx-crank-knob', { 'aria-hidden': 'true' }));
      crankWrap.append(crank, el('p', 'cx-instr-cap', {}, 'Crank · wind the ribbon'));
      controls.appendChild(crankWrap);

      let crankDeg = 0;
      let winding = false;
      let lastBearing = 0;
      const bearingOf = (ev: PointerEvent) => {
        const r = crank.getBoundingClientRect();
        return (
          (Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) *
            180) /
          Math.PI
        );
      };
      const wind = (deltaDeg: number) => {
        crankDeg += deltaDeg;
        crank.style.setProperty('--cx-rot', `${crankDeg}deg`);
        const before = pos;
        pos = clamp(pos + deltaDeg * MM_PER_DEG, 0, RIBBON_MM - WINDOW_MM);
        if (Math.floor(before / 24) !== Math.floor(pos / 24)) ctx.feedback('tick');
        crank.setAttribute('aria-valuenow', String(Math.round(pos)));
        crank.setAttribute('aria-valuetext', `${Math.round(pos)} millimetres of ribbon`);
        paint();
      };
      crank.addEventListener(
        'pointerdown',
        (ev: PointerEvent) => {
          if (ev.button !== 0 && ev.pointerType === 'mouse') return;
          ev.preventDefault();
          crank.setPointerCapture(ev.pointerId);
          winding = true;
          lastBearing = bearingOf(ev);
          crank.classList.add('is-turning');
        },
        { signal: bin.signal },
      );
      crank.addEventListener(
        'pointermove',
        (ev: PointerEvent) => {
          if (!winding) return;
          const b = bearingOf(ev);
          let d = b - lastBearing;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          lastBearing = b;
          wind(d);
        },
        { signal: bin.signal },
      );
      const stopWind = (ev: PointerEvent) => {
        if (!winding) return;
        winding = false;
        if (crank.hasPointerCapture(ev.pointerId)) crank.releasePointerCapture(ev.pointerId);
        crank.classList.remove('is-turning');
        save();
      };
      crank.addEventListener('pointerup', stopWind, { signal: bin.signal });
      crank.addEventListener('pointercancel', stopWind, { signal: bin.signal });
      crank.addEventListener('lostpointercapture', stopWind, { signal: bin.signal });
      crank.addEventListener(
        'keydown',
        (ev: KeyboardEvent) => {
          const coarse = ev.shiftKey ? 8 : 1;
          let d = 0;
          if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') d = 15 * coarse;
          else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') d = -15 * coarse;
          else if (ev.key === 'Home') d = -RIBBON_MM / MM_PER_DEG;
          else if (ev.key === 'End') d = RIBBON_MM / MM_PER_DEG;
          else return;
          ev.preventDefault();
          ev.stopPropagation();
          wind(d);
          save();
        },
        { signal: bin.signal },
      );

      const toggles = el('div', 'cx-toggles');
      const mirrorCtl = bin.own(
        makeToggle({
          label: 'Mirror the impressions',
          value: mirrorOn,
          onLabel: 'Mirror on',
          offLabel: 'Mirror off',
          feedback: ctx.feedback,
          onChange: (v) => {
            mirrorOn = v;
            paint();
            save();
          },
        }),
      );
      const reverseCtl = bin.own(
        makeToggle({
          label: 'Reverse the travel',
          value: reverseOn,
          onLabel: 'Reverse on',
          offLabel: 'Reverse off',
          feedback: ctx.feedback,
          onChange: (v) => {
            reverseOn = v;
            paint();
            save();
          },
        }),
      );
      toggles.append(mirrorCtl.el, reverseCtl.el);
      controls.appendChild(toggles);

      const focusCtl = bin.own(
        makeSlider({
          label: 'Magnifier focus',
          min: 0,
          max: 100,
          step: 1,
          value: focus,
          length: 'clamp(6rem, 18cqw, 11rem)',
          format: (v) => `${v}`,
          feedback: ctx.feedback,
          onChange: (v) => {
            focus = v;
            paint();
            save();
          },
        }),
      );
      const focusWrap = el('div', 'cx-instr');
      focusWrap.append(focusCtl.el, el('p', 'cx-instr-cap', {}, 'Focus'));
      controls.appendChild(focusWrap);
      box.appendChild(controls);

      // -- the timeline ------------------------------------------------------
      const timeline = el('div', 'cx-timeline', {
        role: 'group',
        'aria-label': 'Ribbon timeline. Click to pin the selected marker.',
      });
      const rule = el('button', 'cx-rule', {
        type: 'button',
        'aria-label': 'Ribbon rule, eighteen hundred millimetres. Click to pin a marker.',
      });
      const pins = el('div', 'cx-pins', { 'aria-hidden': 'true' });
      const window0 = el('span', 'cx-window', { 'aria-hidden': 'true' });
      rule.append(pins, window0);
      timeline.appendChild(rule);
      box.appendChild(timeline);

      const palette = el('div', 'cx-palette', { role: 'group', 'aria-label': 'Marker tin' });
      const paletteBtns = new Map<MarkerKind, HTMLButtonElement>();
      for (const kind of MARKER_KINDS) {
        const b = el('button', 'cx-marker-pick', {
          type: 'button',
          'data-kind': kind.id,
          'aria-pressed': 'false',
        });
        b.appendChild(el('span', 'cx-marker-glyph', { 'aria-hidden': 'true' }, kind.glyph));
        b.appendChild(el('span', 'cx-marker-label', {}, kind.label));
        b.addEventListener(
          'click',
          () => {
            picked = kind.id;
            ctx.feedback('click');
            paintPalette();
          },
          { signal: bin.signal },
        );
        paletteBtns.set(kind.id, b);
        palette.appendChild(b);
      }
      const pinNow = stud('Pin at the hairline', () => pin(pos + WINDOW_MM / 2), bin, 'is-slim');
      palette.appendChild(pinNow);
      box.appendChild(palette);

      // -- the assertion -----------------------------------------------------
      const assertWrap = el('div', 'cx-assert');
      assertWrap.appendChild(
        el(
          'p',
          'cx-assert-head',
          {},
          'Casebook. Between the two dated passages, this spool shows:',
        ),
      );
      const ASSERTIONS = [
        { id: 'none', label: 'No ribbon change between', right: true },
        { id: 'change', label: 'A ribbon change between', right: false },
        { id: 'cannot', label: 'Cannot say on this evidence', right: false },
      ];
      const assertRow = el('div', 'cx-assert-row');
      for (const a of ASSERTIONS) {
        const b = stud(a.label, () => commit(a.id, a.right), bin, 'is-assert');
        b.dataset.assert = a.id;
        assertRow.appendChild(b);
      }
      assertWrap.appendChild(assertRow);
      const assertNote = el('p', 'cx-assert-note', { 'aria-live': 'polite' });
      assertWrap.appendChild(assertNote);
      box.appendChild(assertWrap);

      box.appendChild(
        plate(
          'Stationery ledger, rule 4 — E. Charnock, 1968',
          [
            'No new ribbon to be issued until the used spool is returned.',
            'Docket tied to this spool: IMPERIAL 66 — W.O. — fitted 2.9.98 — returned 21.9.98.',
            'A fabric ribbon strikes once, in order, and cannot be re-used.',
          ],
          'cx-plate-wide',
        ),
      );

      // -- geometry ----------------------------------------------------------
      /**
       * Ribbon millimetre to a fraction across the magnifier window.
       *
       * `reverse` flips the mapping, which is the honest model: the impressions
       * run the other way along the physical strip, so with REVERSE off the
       * characters of a word arrive right to left. Combined with the per-glyph
       * flip that MIRROR undoes, only both switches together read.
       */
      const mmToFrac = (mm: number) => {
        const local = (mm - pos) / WINDOW_MM;
        return reverseOn ? local : 1 - local;
      };
      const fracToMm = (frac: number) => pos + (reverseOn ? frac : 1 - frac) * WINDOW_MM;

      function paintStrip() {
        const c2d = fitCanvas(strip);
        if (!c2d) return;
        const { w, h } = cssSize(strip);
        // Focus: the band is narrow and off-centre, so the knob has to be found
        // rather than parked at a default.
        const blur = clamp(Math.abs(focus - 61) / 5.5, 0, 5);
        c2d.clearRect(0, 0, w, h);

        // Fabric. Black nylon over a woven weft, lit from the upper left.
        const g = c2d.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#20242a');
        g.addColorStop(0.42, '#12161a');
        g.addColorStop(1, '#0a0d10');
        c2d.fillStyle = g;
        c2d.fillRect(0, 0, w, h);
        c2d.globalAlpha = 0.22;
        c2d.strokeStyle = '#39414a';
        c2d.lineWidth = 1;
        for (let x = ((-pos * (w / WINDOW_MM)) % 4 + 4) % 4; x < w; x += 4) {
          c2d.beginPath();
          c2d.moveTo(x, 0);
          c2d.lineTo(x, h);
          c2d.stroke();
        }
        c2d.globalAlpha = 1;

        c2d.save();
        c2d.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';

        const pxPerMm = w / WINDOW_MM;
        const baseline = h * 0.62;
        const charPx = CHAR_MM * pxPerMm;
        /* The type pitch is a property of the ribbon, not of the panel: a
           monospace advance is 0.6em, so the only font size that puts one glyph
           in one character's worth of fabric is this one. Sizing it off the
           gate height instead is what makes ribbon text overlap itself. */
        const glyphPx = Math.max(6, Math.min(h * 0.44, charPx / 0.6));
        c2d.font = `${glyphPx}px "IBM Plex Mono", ui-monospace, monospace`;
        c2d.textBaseline = 'alphabetic';

        for (const run of RIBBON_RUNS) {
          for (let i = 0; i < run.text.length; i++) {
            const mm = run.mm + i * CHAR_MM;
            const frac = mmToFrac(mm);
            if (frac < -0.05 || frac > 1.05) continue;
            const x = frac * w;
            c2d.save();
            c2d.translate(x, baseline);
            // The impression is a mirror image of the glyph. MIRROR undoes it.
            if (!mirrorOn) c2d.scale(-1, 1);
            // Struck characters are where ink was lifted off the fabric, so they
            // are lighter than the ribbon, not darker.
            c2d.fillStyle = 'rgba(226,214,186,0.86)';
            c2d.fillText(run.text[i], 0, 0);
            c2d.restore();
            // A faint halo of fabric bruised around each strike. Kept low: at
            // any real strength these merge into one lit bar and the ribbon
            // stops looking like cloth.
            c2d.globalAlpha = 0.07;
            c2d.fillStyle = '#c9b48a';
            c2d.fillRect(x, baseline - glyphPx * 0.78, charPx * 0.96, glyphPx * 1.02);
            c2d.globalAlpha = 1;
          }
        }

        // The physical features. These are visible whatever the toggles say —
        // fabric does not care which way up you hold it.
        for (const f of RIBBON_FEATURES) {
          const frac = mmToFrac(f.mm);
          if (frac < -0.02 || frac > 1.02) continue;
          const x = frac * w;
          c2d.save();
          c2d.strokeStyle = 'rgba(206,190,152,0.72)';
          c2d.lineWidth = 1.4;
          if (f.kind === 'splice') {
            // An overlapped, stitched join: two diagonals and a row of stitches.
            c2d.beginPath();
            c2d.moveTo(x - h * 0.22, h);
            c2d.lineTo(x + h * 0.22, 0);
            c2d.stroke();
            c2d.beginPath();
            c2d.moveTo(x - h * 0.05, h);
            c2d.lineTo(x + h * 0.39, 0);
            c2d.stroke();
            c2d.setLineDash([2, 3]);
            c2d.beginPath();
            c2d.moveTo(x - h * 0.14, h * 0.5);
            c2d.lineTo(x + h * 0.3, h * 0.5);
            c2d.stroke();
          } else {
            c2d.beginPath();
            c2d.arc(x, h * 0.5, h * 0.16, 0, Math.PI * 2);
            c2d.stroke();
          }
          c2d.restore();
        }
        c2d.restore();

        // Pinned markers, drawn on the gate glass rather than on the fabric.
        for (const m of markers) {
          const frac = mmToFrac(m.mm);
          if (frac < 0 || frac > 1) continue;
          const x = frac * w;
          const kind = MARKER_KINDS.find((k) => k.id === m.kind)!;
          c2d.save();
          c2d.fillStyle = 'rgba(245,201,111,0.92)';
          c2d.font = `${Math.max(8, h * 0.26)}px var(--font-ui, sans-serif)`;
          c2d.textAlign = 'center';
          c2d.fillText(kind.glyph, x, h * 0.2);
          c2d.strokeStyle = 'rgba(245,201,111,0.5)';
          c2d.setLineDash([3, 3]);
          c2d.beginPath();
          c2d.moveTo(x, h * 0.24);
          c2d.lineTo(x, h);
          c2d.stroke();
          c2d.restore();
        }
      }

      function paintPins() {
        pins.textContent = '';
        for (const m of markers) {
          const kind = MARKER_KINDS.find((k) => k.id === m.kind)!;
          const p = el('button', 'cx-pin', {
            type: 'button',
            'data-kind': m.kind,
            'aria-label': `${kind.label} at ${Math.round(m.mm)} millimetres. Activate to take it out.`,
          });
          p.style.left = `${(m.mm / RIBBON_MM) * 100}%`;
          p.appendChild(el('span', 'cx-pin-glyph', { 'aria-hidden': 'true' }, kind.glyph));
          p.addEventListener(
            'click',
            (ev) => {
              ev.stopPropagation();
              const at = markers.indexOf(m);
              if (at >= 0) markers.splice(at, 1);
              ctx.feedback('tick');
              paint();
              save();
            },
            { signal: bin.signal },
          );
          pins.appendChild(p);
        }
        window0.style.left = `${(pos / RIBBON_MM) * 100}%`;
        window0.style.width = `${(WINDOW_MM / RIBBON_MM) * 100}%`;
      }

      function paintPalette() {
        for (const [id, b] of paletteBtns) {
          b.setAttribute('aria-pressed', String(id === picked));
          b.classList.toggle('is-on', id === picked);
        }
      }

      const legible = () => mirrorOn && reverseOn && Math.abs(focus - 61) <= 6;

      function paint() {
        box.dataset.legible = legible() ? 'yes' : 'no';
        paintStrip();
        paintPins();
        paintPalette();

        // Reading is a consequence of winding, not of a button: whichever run is
        // under the hairline, correctly oriented and in focus, transcribes.
        const centre = pos + WINDOW_MM / 2;
        const run = RIBBON_RUNS.find(
          (r) => centre >= r.mm - 20 && centre <= r.mm + r.text.length * CHAR_MM + 20,
        );
        if (!legible()) {
          readLine.textContent = !mirrorOn && !reverseOn
            ? 'Mirrored and running backwards. Two switches and a focus knob.'
            : !mirrorOn
              ? 'The letters are the right way round in the wrong order, or the wrong way round. One switch out.'
              : !reverseOn
                ? 'Upright, but the words arrive back to front. The travel is reversed.'
                : 'Oriented, and out of focus.';
        } else if (run) {
          readLine.textContent = run.text;
          if (!readRuns.has(String(run.mm))) {
            readRuns.add(String(run.mm));
            ctx.feedback('good');
            if (run.reading) ctx.note(run.reading);
            save();
          }
        } else {
          readLine.textContent = 'Bare fabric. Wind on.';
        }

        const marked = (kind: MarkerKind) => markers.some((m) => m.kind === kind);
        const passagesPinned = marked('passage-a') && marked('passage-b');
        for (const b of assertRow.querySelectorAll('button')) {
          (b as HTMLButtonElement).disabled = !passagesPinned;
          b.classList.toggle('is-ready', passagesPinned);
        }
        assertNote.textContent = passagesPinned
          ? 'Both passages pinned. The assertion is a signature: it will be read out at the Board.'
          : 'Pin both dated passages before asserting anything about what is between them.';
      }

      function pin(mm: number) {
        const at = clamp(mm, 0, RIBBON_MM);
        // One pin per kind for the two passages; the physical kinds may repeat.
        if (picked === 'passage-a' || picked === 'passage-b') {
          const existing = markers.findIndex((m) => m.kind === picked);
          if (existing >= 0) markers.splice(existing, 1);
        }
        markers.push({ mm: at, kind: picked });
        const kind = MARKER_KINDS.find((k) => k.id === picked)!;

        // Confirmation is physical, not evaluative: the pin either sits on a
        // feature the fabric actually has or it sits on bare ribbon, and Wren
        // says which. She never says "correct".
        const feature = RIBBON_FEATURES.find((f) => Math.abs(f.mm - at) <= PIN_MM);
        const run = RIBBON_RUNS.find(
          (r) => r.passage && Math.abs(r.mm - at) <= r.text.length * CHAR_MM,
        );
        if (
          (picked === 'splice' || picked === 'eyelet') &&
          feature &&
          feature.kind === picked
        ) {
          ctx.feedback('good');
          ctx.note(feature.note);
        } else if (
          (picked === 'passage-a' && run?.passage === 'a') ||
          (picked === 'passage-b' && run?.passage === 'b')
        ) {
          ctx.feedback('good');
          ctx.note(`${kind.label} pinned at ${Math.round(at)}mm.`);
        } else {
          ctx.feedback('tick');
          ctx.note(`${kind.label} pinned at ${Math.round(at)}mm. Bare fabric, as far as I can see.`);
        }
        paint();
        save();
      }

      rule.addEventListener(
        'click',
        (ev: MouseEvent) => {
          const r = rule.getBoundingClientRect();
          pin(((ev.clientX - r.left) / r.width) * RIBBON_MM);
        },
        { signal: bin.signal },
      );

      // Clicking the strip itself pins at the pointer, which is what a hand
      // reaches for first. The mapping runs back through the toggles, so a pin
      // dropped while the ribbon is reversed still lands on the right fabric.
      gate.addEventListener(
        'click',
        (ev: MouseEvent) => {
          const r = gate.getBoundingClientRect();
          pin(fracToMm((ev.clientX - r.left) / r.width));
        },
        { signal: bin.signal },
      );

      function commit(id: string, right: boolean) {
        if (solved) return;
        if (!right) {
          ctx.feedback('bad');
          ctx.note(
            id === 'change'
              ? 'There is no join between them. I have wound it four times and there is no join.'
              : '‘Cannot say’ is what you write when you have not looked. I have looked.',
          );
          return;
        }
        // The one place in this file where a wrong answer is *accepted*. Every
        // unmarked splice is recorded, and Act V reads it.
        const missing = RIBBON_FEATURES.filter(
          (f) => !markers.some((m) => m.kind === f.kind && Math.abs(m.mm - f.mm) <= PIN_MM),
        );
        const strayBetween = markers.filter(
          (m) =>
            (m.kind === 'splice' || m.kind === 'eyelet' || m.kind === 'colour') &&
            m.mm > 980 &&
            m.mm < 1290,
        );
        S.unsafeAssertion = missing.length > 0 || strayBetween.length > 0;
        S.assertion = 'none';
        solved = true;
        save();
        ctx.feedback('good');
        ctx.note(
          missing.length
            ? `Committed — and there are ${missing.length === 1 ? 'a splice' : 'splices'} on this spool I have not marked. That will be asked about.`
            : 'Two splices found and marked, neither between the passages. Unbroken fabric.',
        );
        ctx.solve();
      }

      bin.observe(gate, paintStrip);
      paintPalette();
      paint();
      ctx.note(
        markers.length
          ? 'Where I left it: the spool on the winder, and pins in the rule.'
          : 'A ribbon is a serial record. It has no memory of what it was for and no reason to lie about the order.',
      );
    },

    unmount() {
      bin.empty();
    },
  };
}

// ===========================================================================
// Registration
// ===========================================================================

/**
 * Registers the cipher, decoding and document-restoration bench.
 *
 * Called once, from the puzzle index, at import time. Registration is by id
 * against `src/game/puzzles.ts`, so a typo here degrades to the host's readable
 * placard with the bail-out armed rather than to a broken door.
 */
export function registerCipherPuzzles(): void {
  registerPuzzle('puz-fused-commission', fusedCommission);
  registerPuzzle('puz-ash-grate', ashGrate);
  registerPuzzle('puz-per-procurationem', perProcurationem);
  registerPuzzle('puz-september-spool', septemberSpool);
}
