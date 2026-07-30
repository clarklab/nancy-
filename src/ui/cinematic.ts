/**
 * The cinematic player: the game's cutscenes.
 *
 * A cinematic is a sequence of painted stills with a slow move across each one
 * and a line or two of text. The rules that make it read as film rather than as
 * a slideshow are all about *never cutting*: the letterbox bars slide in before
 * the first image and out after the last, one beat cross-dissolves into the
 * next while its Ken Burns move is still running, and the next image is decoded
 * before the dissolve starts so a beat can never pop in half-painted.
 *
 * Skipping is deliberately two-tier. Click or Space steps a beat, because
 * readers read at different speeds and that is not a story decision. Escape
 * abandons the whole scene — and because that *is* a story decision, it must be
 * held down against a filling ring rather than fired by a stray keypress.
 */

import { preload } from '@/engine/scene-view';
import type { Cinematic, CinematicBeat } from '@/engine/types';

/* Sequencing lives in JS, so these mirror the --dur-* tokens by hand and are
   collapsed for reduced motion at the point of use. */
const MS_BARS = 620;
const MS_CROSSFADE = 620;
const MS_OUT = 460;
/** A beat must survive long enough to be looked at, whatever its text says. */
const MS_BEAT_MIN = 2200;
/** Reading pace, per character, when the content declares no duration. */
const MS_PER_CHAR = 46;
/** Entrance stagger per line, so a stanza rises rather than appearing. */
const MS_LINE_STAGGER = 260;
/** How long Escape must be held. Long enough to be a decision, not a slip. */
const MS_HOLD_SKIP = 900;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const lines = (t: string | string[] | undefined) =>
  t === undefined ? [] : Array.isArray(t) ? t : [t];

export interface CinematicCallbacks {
  /** Named cue from the shared SFX table, for `beat.sound`. */
  onSound?(name: string): void;
  /** Music bed for the whole cinematic, from `c.music`. */
  onMusic?(name: string): void;
}

/**
 * Full-bleed cutscene overlay. Construct once per session, `mount` it into the
 * overlay layer, and drive it one cinematic at a time with
 * {@link CinematicPlayer.play}.
 */
export class CinematicPlayer {
  readonly el: HTMLElement;

  private cb: CinematicCallbacks;

  private captionEl!: HTMLElement;
  private speakerEl!: HTMLElement;
  private liveEl!: HTMLElement;
  private skipEl!: HTMLButtonElement;
  private skipRing!: HTMLElement;
  /** Two stacked frames so a beat dissolves into the next instead of cutting. */
  private frames!: [HTMLElement, HTMLElement];
  private front = 0;

  private active = false;
  /** Resolver for the beat on screen; calling it early is "advance". */
  private advanceBeat: (() => void) | null = null;
  /** Set once the player has held Escape to the end of the ring. */
  private abandoned = false;
  private skippable = true;

  private holdFrom = 0;
  private holdRaf = 0;
  private timers = new Set<number>();
  private restoreFocus: HTMLElement | null = null;

  constructor(cb: CinematicCallbacks = {}) {
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.className = 'cine-root';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Cutscene');
    this.el.tabIndex = -1;

    this.el.innerHTML = `
      <div class="cine-frames" aria-hidden="true">
        <div class="cine-frame is-front"></div>
        <div class="cine-frame"></div>
      </div>
      <div class="cine-scrim" aria-hidden="true"></div>

      <div class="cine-bar is-top" aria-hidden="true"></div>
      <div class="cine-bar is-bottom" aria-hidden="true"></div>

      <div class="cine-caption" aria-hidden="true">
        <p class="cine-speaker"></p>
        <div class="cine-lines"></div>
      </div>

      <button class="cine-skip" type="button" aria-label="Hold to skip this scene">
        <span class="cine-skip-ring" aria-hidden="true"></span>
        <span class="cine-skip-label">Hold <kbd>Esc</kbd> to skip</span>
      </button>

      <p class="cine-live sr-only" role="status" aria-live="polite"></p>`;

    this.frames = [...this.el.querySelectorAll<HTMLElement>('.cine-frame')] as [
      HTMLElement,
      HTMLElement,
    ];
    this.captionEl = this.q('.cine-lines');
    this.speakerEl = this.q('.cine-speaker');
    this.liveEl = this.q('.cine-live');
    this.skipEl = this.q('.cine-skip');
    this.skipRing = this.q('.cine-skip-ring');

    // Anywhere that is not the skip badge steps the scene on.
    this.el.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('.cine-skip')) return;
      this.advance();
    });

    // The badge is the pointer equivalent of holding Escape.
    this.skipEl.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this.skipEl.setPointerCapture(ev.pointerId);
      this.beginHold();
    });
    const drop = (ev: PointerEvent) => {
      if (this.skipEl.hasPointerCapture(ev.pointerId)) {
        this.skipEl.releasePointerCapture(ev.pointerId);
      }
      this.endHold();
    };
    this.skipEl.addEventListener('pointerup', drop);
    this.skipEl.addEventListener('pointercancel', drop);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.el);
    // Captured: while a cutscene is running it outranks every other binding in
    // the game, and Escape here must never also open the pause menu.
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  /**
   * Plays one cinematic to its end. Resolves once the bars have travelled back
   * out, so the caller can restore the HUD on the next line without overlap.
   *
   * A re-entrant call is refused rather than queued: a cinematic started from
   * inside another cinematic's effects would deadlock the chain awaiting it.
   */
  async play(c: Cinematic): Promise<void> {
    if (this.active) {
      console.warn(`[cinematic] ignoring re-entrant play of "${c.id}"`);
      return;
    }

    this.active = true;
    this.abandoned = false;
    this.skippable = c.skippable !== false;
    this.restoreFocus = (document.activeElement as HTMLElement | null) ?? null;

    this.el.dataset.cinematic = c.id;
    this.el.classList.toggle('is-skippable', this.skippable);
    this.skipEl.hidden = !this.skippable;
    if (c.music) this.cb.onMusic?.(c.music);

    // Decode the opening still behind the bars so the first frame is painted
    // the instant the letterbox finishes travelling.
    const first = c.beats[0]?.image;
    if (first) await preload(first);

    await this.openBars();

    for (let i = 0; i < c.beats.length && !this.abandoned; i++) {
      await this.showBeat(c.beats[i], c.beats[i + 1]);
    }

    await this.closeBars();
    this.active = false;
    delete this.el.dataset.cinematic;
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.clearTimers();
    cancelAnimationFrame(this.holdRaf);
    // Settle anything still awaiting us so a teardown can never hang a caller.
    this.abandoned = true;
    this.advanceBeat?.();
    this.active = false;
    this.el.remove();
  }

  // -- beats -----------------------------------------------------------------

  /**
   * Runs one beat: dissolve the still in, rise the text, hold, and warm the
   * next image while the player is reading this one.
   */
  private async showBeat(beat: CinematicBeat, next: CinematicBeat | undefined) {
    const hold = beatDuration(beat);

    this.paint(beat, hold);
    this.writeCaption(beat);

    // The dissolve into the *next* beat needs its art already decoded; doing it
    // now costs nothing because the player is reading.
    if (next?.image) void preload(next.image);

    if (beat.sound) this.cb.onSound?.(beat.sound);

    await this.holdBeat(hold);
  }

  /** Cross-dissolves the back frame to the front, carrying its Ken Burns move. */
  private paint(beat: CinematicBeat, hold: number) {
    if (!beat.image) return;

    const back = this.frames[this.front === 0 ? 1 : 0];
    const front = this.frames[this.front];

    back.style.backgroundImage = `url("${beat.image}")`;
    back.dataset.move = beat.move ?? 'none';
    // The move must outlast the beat by the dissolve, or the image would come
    // to a stop a moment before the next one starts and the drift would read
    // as a stutter.
    back.style.setProperty('--kb-dur', `${hold + MS_CROSSFADE}ms`);
    // Restart the animation on a frame that has already been used once.
    back.classList.remove('is-moving');
    void back.offsetWidth;
    back.classList.add('is-moving', 'is-front');
    front.classList.remove('is-front');

    this.front = this.front === 0 ? 1 : 0;
  }

  /** Text lands as centred display type, one line rising after the last. */
  private writeCaption(beat: CinematicBeat) {
    const text = lines(beat.text);
    this.captionEl.textContent = '';
    this.speakerEl.textContent = beat.speaker ?? '';
    this.el.classList.toggle('has-caption', text.length > 0);
    if (!text.length) return;

    text.forEach((line, i) => {
      const p = document.createElement('p');
      p.className = 'cine-line';
      p.textContent = line;
      p.style.setProperty('--line-delay', `${reduced() ? 0 : i * MS_LINE_STAGGER}ms`);
      this.captionEl.appendChild(p);
      requestAnimationFrame(() => p.classList.add('is-in'));
    });

    // One announcement for the whole beat: a live region fed line by line
    // during a dissolve is unreadable.
    this.liveEl.textContent = [beat.speaker, ...text].filter(Boolean).join(': ');
  }

  /** Waits out a beat, unless the player steps it on or abandons the scene. */
  private holdBeat(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const done = () => {
        if (!this.advanceBeat) return;
        this.advanceBeat = null;
        this.clearTimer(timer);
        resolve();
      };
      this.advanceBeat = done;
      const timer = this.after(ms, done);
    });
  }

  private advance() {
    if (!this.active) return;
    this.advanceBeat?.();
  }

  // -- letterbox -------------------------------------------------------------

  private openBars(): Promise<void> {
    this.el.hidden = false;
    // Reflow so the bars animate from their off-screen position.
    void this.el.offsetHeight;
    this.el.classList.add('is-open');
    this.el.focus({ preventScroll: true });
    return this.wait(reduced() ? 0 : MS_BARS);
  }

  private async closeBars(): Promise<void> {
    this.el.classList.add('is-ending');
    this.el.classList.remove('has-caption');
    await this.wait(reduced() ? 0 : MS_OUT);

    this.el.classList.remove('is-open', 'is-ending');
    this.el.hidden = true;
    this.captionEl.textContent = '';
    this.speakerEl.textContent = '';
    this.liveEl.textContent = '';
    for (const f of this.frames) {
      f.classList.remove('is-moving');
      f.style.removeProperty('background-image');
    }
    this.endHold();

    if (this.restoreFocus?.isConnected) this.restoreFocus.focus({ preventScroll: true });
    this.restoreFocus = null;
  }

  // -- hold to skip ----------------------------------------------------------

  /**
   * Fills the ring while the key or the badge is held. Driven by rAF rather
   * than a CSS animation because the ring is a readout of how long is left,
   * not decoration, and it has to keep meaning that when motion is reduced.
   */
  private beginHold() {
    if (!this.active || !this.skippable || this.holdFrom) return;
    this.holdFrom = performance.now();
    this.el.classList.add('is-holding');

    const tick = (now: number) => {
      const t = Math.min(1, (now - this.holdFrom) / MS_HOLD_SKIP);
      this.skipRing.style.setProperty('--hold', t.toFixed(3));
      if (t < 1) {
        this.holdRaf = requestAnimationFrame(tick);
      } else {
        this.endHold();
        this.abandon();
      }
    };
    this.skipRing.style.setProperty('--hold', '0');
    this.holdRaf = requestAnimationFrame(tick);
  }

  /** Releasing early retracts the ring; the scene keeps playing. */
  private endHold() {
    if (!this.holdFrom) return;
    this.holdFrom = 0;
    cancelAnimationFrame(this.holdRaf);
    this.el.classList.remove('is-holding');
    this.skipRing.style.setProperty('--hold', '0');
  }

  private abandon() {
    if (this.abandoned) return;
    this.abandoned = true;
    this.liveEl.textContent = 'Scene skipped.';
    this.advanceBeat?.();
  }

  // -- keyboard --------------------------------------------------------------

  private onKeyDown(ev: KeyboardEvent) {
    if (!this.active) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.skippable && !ev.repeat) this.beginHold();
      return;
    }

    // Chords belong to the browser — never swallow a reload or a devtools key.
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    // Everything the game binds is meaningless during a cutscene, and a stray
    // J opening the journal behind one would be worse than meaningless.
    ev.stopPropagation();
    if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.advance();
    }
  }

  private onKeyUp(ev: KeyboardEvent) {
    if (!this.active) return;
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      this.endHold();
    }
  }

  // -- plumbing --------------------------------------------------------------

  private q<T extends HTMLElement>(sel: string): T {
    return this.el.querySelector<T>(sel)!;
  }

  private after(ms: number, fn: () => void): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  private clearTimer(id: number) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.after(ms, resolve));
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

/**
 * How long a beat stays up when the content does not say.
 *
 * Derived from the text so a one-line sting does not linger and a paragraph is
 * not snatched away, with a floor that keeps a wordless establishing shot on
 * screen long enough to actually establish anything.
 */
function beatDuration(beat: CinematicBeat): number {
  if (beat.durationMs !== undefined) return Math.max(0, beat.durationMs);
  const chars = lines(beat.text).reduce((n, l) => n + l.length, 0);
  return Math.max(MS_BEAT_MIN, chars * MS_PER_CHAR);
}
