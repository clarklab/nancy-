/**
 * The puzzle host: the workbench every minigame is played on.
 *
 * A minigame is a mechanism, not a screen. So the host builds the *furniture*
 * around it — a leather-topped bench in a brass frame, lit by a lamp somewhere
 * off to the upper left — and hands the mechanism a bare, correctly-lit surface
 * to live on. Puzzles therefore never draw a title, a close button, a hint
 * affordance or a failure flash of their own; they get those for free and, more
 * importantly, they get them *identically*, so the player learns the chrome once
 * and then only ever has to learn the mechanism.
 *
 * The host is also the boundary between content and code. Content declares a
 * {@link PuzzleDefinition} (name, premise, three hints, what solving does);
 * code registers a {@link PuzzleModule} under the same id with
 * {@link registerPuzzle}. Neither knows about the other, and a definition whose
 * module has not been written yet degrades into a readable placard with the
 * bail-out enabled rather than a locked door.
 *
 * The lower half of this file is the shared primitive kit — draggables, dials,
 * sliders, toggles, keypads. Those exist so that ten puzzles written by ten
 * different hands still feel like ten mechanisms built by the same workshop:
 * same detent weight, same keyboard contract, same brass.
 */

import type { GameState } from '@/engine/state';
import type { PuzzleContext, PuzzleDefinition, PuzzleModule } from '@/engine/types';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Factories, not instances: every opening gets a mechanism with fresh guts. */
const registry = new Map<string, () => PuzzleModule>();

/**
 * Declares which code implements a content-declared puzzle id.
 *
 * Modules register themselves at import time (`src/puzzles/index.ts` imports
 * them all), which keeps the wiring next to the mechanism instead of in a
 * central table that every new puzzle has to edit.
 */
export function registerPuzzle(id: string, factory: () => PuzzleModule): void {
  if (registry.has(id)) {
    // Almost always a copy-pasted id rather than a deliberate override, and it
    // would otherwise present as "the wrong puzzle opened", which is baffling.
    console.warn(`[puzzle] "${id}" is registered twice — the later module wins`);
  }
  registry.set(id, factory);
}

/**
 * Builds the module registered for `id`, or `null` when content declares a
 * puzzle no code implements yet. Each call returns a new instance: a module may
 * hold arbitrary internal state and must never be re-entered.
 */
export function getPuzzle(id: string): PuzzleModule | null {
  const factory = registry.get(id);
  return factory ? factory() : null;
}

/** Every registered id. Used by the smoke harness to sweep the puzzle set. */
export function registeredPuzzles(): string[] {
  return [...registry.keys()];
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/* Sequencing lives in JS, so these mirror the --dur-* tokens by hand. Each one
   is collapsed for reduced motion at the point of use, never here. */
const MS_OPEN = 620;
const MS_CLOSE = 380;
/** The victory beat: long enough to feel earned, short enough not to nag. */
const MS_SOLVE_HOLD = 900;
/** Lifetime of a good/bad flash before the surface returns to neutral. */
const MS_FLASH = 560;
/**
 * Enforced pause between hints. A hint the player can spam is a walkthrough;
 * a hint they have to wait a beat for is a decision.
 */
const MS_HINT_COOLDOWN = 14_000;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/** Keys the game binds globally that must not reach it while a puzzle is up. */
const SWALLOWED_KEYS = new Set(['j', 'i', 'm', 'h', 'l', ' ']);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Instance counter for the `id`s the dialog points `aria-labelledby` at.
 * Hard-coded ids would collide the moment the smoke harness mounts a second
 * host, and a dialog labelled by the *other* host's title is worse than one
 * with no label at all.
 */
let hostSeq = 0;

export interface PuzzleHostCallbacks {
  /** Named cue from the shared SFX table, e.g. `puzzle-correct`. */
  onSound?(name: string): void;
}

// ---------------------------------------------------------------------------
// The host
// ---------------------------------------------------------------------------

/**
 * Modal workbench overlay. Construct once per session, `mount` it into the
 * overlay layer, and drive it one puzzle at a time with {@link PuzzleHost.open}.
 */
export class PuzzleHost {
  readonly el: HTMLElement;

  private cb: PuzzleHostCallbacks;

  private panel!: HTMLElement;
  private titleEl!: HTMLElement;
  private placardEl!: HTMLElement;
  private premiseEl!: HTMLElement;
  private stageEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private liveEl!: HTMLElement;
  private railEl!: HTMLElement;
  private lampEl!: HTMLButtonElement;
  private lampCountEl!: HTMLElement;
  private closeEl!: HTMLButtonElement;
  private skipEl!: HTMLButtonElement;

  /** True from the first frame of `open` until the overlay is gone. */
  private active = false;
  /** Resolver for the puzzle currently on the bench; nulled once settled. */
  private settle: ((solved: boolean) => void) | null = null;
  private def: PuzzleDefinition | null = null;
  private module: PuzzleModule | null = null;
  private solved = false;

  private hintsShown = 0;
  private hintReadyAt = 0;
  private hintRaf = 0;

  private timers = new Set<number>();
  private restoreFocus: HTMLElement | null = null;
  /** Latched by `destroy`, so an `open` still unwinding cannot re-arm anything. */
  private dead = false;

  constructor(cb: PuzzleHostCallbacks = {}) {
    this.cb = cb;

    const uid = `puzzle-${++hostSeq}`;

    this.el = document.createElement('div');
    this.el.className = 'puzzle-root';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', `${uid}-title`);
    this.el.setAttribute('aria-describedby', `${uid}-premise`);

    this.el.innerHTML = `
      <div class="puzzle-backdrop" aria-hidden="true"></div>

      <div class="puzzle-bench stage-box">
        <div class="puzzle-panel" tabindex="-1">
          <div class="puzzle-rake" aria-hidden="true"></div>
          <span class="puzzle-corner is-tl" aria-hidden="true"></span>
          <span class="puzzle-corner is-tr" aria-hidden="true"></span>
          <span class="puzzle-corner is-bl" aria-hidden="true"></span>
          <span class="puzzle-corner is-br" aria-hidden="true"></span>

          <header class="puzzle-head">
            <h2 class="puzzle-title" id="${uid}-title"></h2>
            <button class="puzzle-close" type="button" aria-label="Leave this alone for now">
              <span class="puzzle-close-glyph" aria-hidden="true"></span>
            </button>
          </header>

          <div class="puzzle-placard">
            <p class="puzzle-premise" id="${uid}-premise"></p>
          </div>

          <div class="puzzle-surface">
            <div class="puzzle-stage"></div>
          </div>

          <footer class="puzzle-foot">
            <button class="puzzle-lamp" type="button" aria-label="Turn up the lamp for a hint">
              <span class="puzzle-lamp-flame" aria-hidden="true"></span>
              <span class="puzzle-lamp-ring" aria-hidden="true"></span>
              <span class="puzzle-lamp-label" aria-hidden="true">Hint</span>
              <span class="puzzle-lamp-count" aria-hidden="true"></span>
            </button>
            <p class="puzzle-status" aria-hidden="true"></p>
            <button class="puzzle-skip" type="button" tabindex="-1" aria-hidden="true">
              Set this aside
            </button>
          </footer>
        </div>

        <!-- Pinned hints are a *record*, not an announcement: a player who
             missed the live region has to be able to go back and read them,
             so the rail is a real list rather than decoration. -->
        <aside class="puzzle-rail" role="list" aria-label="Hints given"></aside>
      </div>

      <p class="puzzle-live sr-only" role="status" aria-live="polite"></p>`;

    this.panel = this.q('.puzzle-panel');
    this.titleEl = this.q('.puzzle-title');
    this.placardEl = this.q('.puzzle-placard');
    this.premiseEl = this.q('.puzzle-premise');
    this.stageEl = this.q('.puzzle-stage');
    this.statusEl = this.q('.puzzle-status');
    this.liveEl = this.q('.puzzle-live');
    this.railEl = this.q('.puzzle-rail');
    this.lampEl = this.q('.puzzle-lamp');
    this.lampCountEl = this.q('.puzzle-lamp-count');
    this.closeEl = this.q('.puzzle-close');
    this.skipEl = this.q('.puzzle-skip');

    this.closeEl.addEventListener('click', () => {
      this.cb.onSound?.('click-soft');
      this.finish(false);
    });
    this.lampEl.addEventListener('click', () => this.requestHint());
    this.skipEl.addEventListener('click', () => {
      this.cb.onSound?.('drawer-open');
      this.panel.classList.add('is-set-aside');
      this.finish(true);
    });

    this.onKey = this.onKey.bind(this);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.el);
    /* Bubble phase, deliberately. The mechanism's own handlers sit on elements
       inside the panel and have already run by the time an event reaches the
       window, so stopping here silences the game's global hotkeys without ever
       stealing a key from the puzzle. `stopImmediatePropagation` is what
       actually does it: the game's own window listener is registered after
       ours, so cancelling the rest of this target's list is enough. */
    window.addEventListener('keydown', this.onKey);
  }

  /**
   * Puts one puzzle on the bench and runs it to its conclusion. Resolves `true`
   * when the player solved it (or accepted the bail-out, which the caller is
   * meant to treat as a solve), `false` when they walked away.
   *
   * Re-entrant calls are refused rather than queued: a puzzle opened from
   * inside another puzzle's effects would deadlock the chain it is waiting on.
   */
  async open(def: PuzzleDefinition, state: GameState): Promise<boolean> {
    if (this.dead) return false;
    if (this.active) {
      console.warn(`[puzzle] ignoring re-entrant open of "${def.id}"`);
      return false;
    }

    this.active = true;
    this.def = def;
    this.solved = false;
    this.restoreFocus = (document.activeElement as HTMLElement | null) ?? null;

    this.dress(def);

    // Claim the resolver before anything can settle: a module that solves
    // itself on mount, or a player hammering Escape, must still land here.
    const outcome = new Promise<boolean>((resolve) => {
      this.settle = resolve;
    });

    /* Build the mechanism *before* the entrance runs, for two reasons: the
       player never watches an empty bench fade up and then have its contents
       pop in a frame later, and a module that measures itself at mount time
       (a canvas, a board that lays pieces out from a rect) gets a real,
       laid-out, unscaled box to measure. `is-arming` is what buys the second:
       the frame is in the tree and at full size, but still invisible and
       still in its neutral pose. */
    this.el.hidden = false;
    this.el.classList.add('is-arming');

    const ctx = this.buildContext(def, state);
    this.module = getPuzzle(def.id);

    if (this.module) {
      this.module.mount(this.stageEl, ctx);
    } else {
      // Content is ahead of code. Say so plainly and open the escape hatch,
      // rather than trapping the player in an empty frame.
      this.renderMissing(def.id);
    }

    this.armSkip(def);
    await this.openPanel();

    const solved = await outcome;

    this.module?.unmount?.();
    this.module = null;
    this.def = null;
    await this.closePanel();
    this.active = false;

    return solved;
  }

  destroy() {
    this.dead = true;
    window.removeEventListener('keydown', this.onKey);
    this.clearTimers();
    cancelAnimationFrame(this.hintRaf);
    this.module?.unmount?.();
    this.module = null;
    // Never leave a caller awaiting a host that no longer exists.
    this.finish(false, true);
    this.active = false;
    this.def = null;
    this.restoreFocus = null;
    this.el.remove();
  }

  // -- staging ---------------------------------------------------------------

  /** Resets every piece of chrome to its opening state for a new puzzle. */
  private dress(def: PuzzleDefinition) {
    this.el.dataset.puzzle = def.id;
    this.titleEl.textContent = def.name ?? '';

    // Content is data and data is sometimes thin: a puzzle with no premise
    // gets no placard rather than an empty card of paper floating on the frame.
    const premise = def.premise?.trim() ?? '';
    this.premiseEl.textContent = premise;
    this.placardEl.hidden = premise.length === 0;

    this.stageEl.textContent = '';
    this.railEl.textContent = '';
    this.statusEl.textContent = '';
    this.statusEl.classList.remove('is-in');
    this.liveEl.textContent = '';

    this.panel.classList.remove('is-solved', 'is-set-aside', 'fx-good', 'fx-bad');
    this.lampEl.classList.remove('is-refused');
    this.hintsShown = 0;
    this.hintReadyAt = 0;
    cancelAnimationFrame(this.hintRaf);
    this.lampEl.style.setProperty('--hint-charge', '1');
    this.lampEl.dataset.state = this.hints(def).length ? 'ready' : 'spent';
    this.updateLamp();

    this.skipEl.hidden = false;
    this.skipEl.classList.remove('is-in');
    this.skipEl.tabIndex = -1;
    this.skipEl.setAttribute('aria-hidden', 'true');
  }

  /**
   * The declared hints, defensively. `hints` is a fixed triple in the schema,
   * but content is authored by hand and a puzzle with two — or none — must
   * still open rather than throw on the first press of the lamp.
   */
  private hints(def: PuzzleDefinition): readonly string[] {
    return Array.isArray(def.hints) ? def.hints.filter((h) => typeof h === 'string' && h) : [];
  }

  private openPanel(): Promise<void> {
    /* Three steps, and all three are load-bearing. Swap the neutral arming pose
       for the closed one with transitions still suppressed; force a reflow so
       that closed pose is what the browser has actually committed; only then
       release the transition and open. Collapse any two of these and the panel
       either animates from the wrong pose or does not animate at all. */
    this.el.classList.remove('is-arming');
    this.el.classList.add('is-shut');
    void this.el.offsetHeight;
    this.el.classList.remove('is-shut');
    this.el.classList.add('is-open');
    this.cb.onSound?.('drawer-open');
    this.panel.focus({ preventScroll: true });
    return this.wait(reduced() ? 0 : MS_OPEN);
  }

  private async closePanel(): Promise<void> {
    this.el.classList.remove('is-open');
    this.el.classList.add('is-closing');
    await this.wait(reduced() ? 0 : MS_CLOSE);

    this.el.classList.remove('is-closing', 'is-arming', 'is-shut');
    this.el.hidden = true;
    this.stageEl.textContent = '';
    this.railEl.textContent = '';
    this.panel.classList.remove('is-solved', 'is-set-aside', 'fx-good', 'fx-bad');
    delete this.el.dataset.puzzle;

    // Only reclaim focus if nothing else has: a puzzle that ends by walking the
    // player somewhere new must not yank them back to the hotspot they left.
    const back = this.restoreFocus;
    this.restoreFocus = null;
    if (back?.isConnected && !this.el.contains(document.activeElement)) {
      const here = document.activeElement;
      if (here === null || here === document.body) back.focus({ preventScroll: true });
    }
  }

  private renderMissing(id: string) {
    const card = document.createElement('p');
    card.className = 'puzzle-missing';
    card.textContent = 'This mechanism has not been built yet.';
    card.title = id;
    this.stageEl.appendChild(card);
    this.revealSkip();
  }

  // -- the context handed to modules ----------------------------------------

  /**
   * Builds the {@link PuzzleContext} for one opening. Every method is an arrow
   * function so a module can destructure the context — or hand `ctx.feedback`
   * straight to a primitive — without losing `this`.
   */
  private buildContext(def: PuzzleDefinition, state: GameState): PuzzleContext {
    // Progress is stored on the save under the puzzle's own id, so a mechanism
    // left half-worked is still half-worked after a reload. A slot holding
    // anything other than a plain bag is a corrupt or stale save; discard it
    // rather than hand a module a `null` it will dereference on its first line.
    const existing = state.puzzleState[def.id];
    const bag =
      existing !== null && typeof existing === 'object' && !Array.isArray(existing)
        ? existing
        : (state.puzzleState[def.id] = {});

    return {
      state: bag,
      save: () => {
        // The bag is already live on the state object; notifying is what makes
        // the next autosave (and any listening UI) see the change.
        state.notify();
      },
      solve: () => this.playSolve(),
      close: () => this.finish(false),
      feedback: (kind) => this.feedback(kind),
      note: (text) => this.note(text),
      hasItem: (item) => state.hasItem(item),
      hasClue: (clue) => state.hasClue(clue),
    };
  }

  /** Idempotent victory: the frame takes a breath of gold, then we are done. */
  private playSolve() {
    if (this.solved || !this.settle) return;
    this.solved = true;
    this.panel.classList.add('is-solved');
    this.cb.onSound?.('puzzle-solved');
    this.liveEl.textContent = 'Solved.';
    this.after(reduced() ? 160 : MS_SOLVE_HOLD, () => this.finish(true));
  }

  private feedback(kind: 'good' | 'bad' | 'click' | 'tick') {
    switch (kind) {
      case 'good':
        this.flash('fx-good');
        this.cb.onSound?.('puzzle-correct');
        break;
      case 'bad':
        this.flash('fx-bad');
        this.cb.onSound?.('puzzle-wrong');
        break;
      case 'click':
        this.cb.onSound?.('click-brass');
        break;
      case 'tick':
        this.cb.onSound?.('click-soft');
        break;
    }
  }

  /** Restartable flash: re-triggering mid-flash replays from the top. */
  private flash(cls: 'fx-good' | 'fx-bad') {
    this.panel.classList.remove('fx-good', 'fx-bad');
    void this.panel.offsetWidth;
    this.panel.classList.add(cls);
    this.after(MS_FLASH, () => this.panel.classList.remove(cls));
  }

  private note(text: string) {
    this.statusEl.textContent = text;
    this.statusEl.classList.remove('is-in');
    void this.statusEl.offsetWidth;
    this.statusEl.classList.add('is-in');
    this.liveEl.textContent = text;
  }

  // -- hints -----------------------------------------------------------------

  /**
   * One press, one hint — the next of the three the content author escalated.
   * Pressing during the cooldown refuses rather than queues, so the player
   * always knows exactly how much help they have spent.
   */
  private requestHint() {
    const def = this.def;
    if (!def || !this.settle) return;
    const hints = this.hints(def);

    if (this.hintsShown >= hints.length) {
      this.cb.onSound?.('lock-refuse');
      this.refuseLamp();
      this.note('The lamp has nothing else to show me.');
      return;
    }

    if (performance.now() < this.hintReadyAt) {
      this.cb.onSound?.('lock-refuse');
      this.refuseLamp();
      this.note('Let the wick catch up.');
      return;
    }

    const text = hints[this.hintsShown];
    this.hintsShown += 1;
    this.cb.onSound?.('match-strike');
    this.pinNote(text, this.hintsShown);
    this.liveEl.textContent = `Hint ${this.hintsShown}: ${text}`;
    this.updateLamp();

    if (this.hintsShown < hints.length) this.startCooldown();
    else this.lampEl.dataset.state = 'spent';
  }

  /** Restartable refusal shudder: a second press mid-shake replays it. */
  private refuseLamp() {
    this.lampEl.classList.remove('is-refused');
    void this.lampEl.offsetWidth;
    this.lampEl.classList.add('is-refused');
  }

  /** A hint arrives as a note in the detective's own hand, pinned to the frame. */
  private pinNote(text: string, index: number) {
    const card = document.createElement('div');
    card.className = 'puzzle-hint-note';
    card.setAttribute('role', 'listitem');
    // Deterministic tilt: the same hint always hangs at the same angle, so the
    // rail reads as three pinned papers rather than a shuffling deck.
    card.style.setProperty('--note-tilt', `${[-2.4, 1.7, -1.1][(index - 1) % 3]}deg`);
    card.innerHTML = `
      <span class="puzzle-pin" aria-hidden="true"></span>
      <span class="puzzle-hint-index" aria-hidden="true"></span>
      <p class="puzzle-hint-text"></p>`;
    card.querySelector('.puzzle-hint-index')!.textContent = String(index);
    card.querySelector('.puzzle-hint-text')!.textContent = text;
    this.railEl.appendChild(card);
    requestAnimationFrame(() => card.classList.add('is-in'));
  }

  /**
   * Burns the lamp down and back up again. Driven by rAF rather than a CSS
   * animation because the ring is a readout of a game rule, not decoration —
   * it has to keep meaning the same thing when motion is reduced.
   */
  private startCooldown() {
    const start = performance.now();
    this.hintReadyAt = start + MS_HINT_COOLDOWN;
    this.lampEl.dataset.state = 'cooling';

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / MS_HINT_COOLDOWN);
      this.lampEl.style.setProperty('--hint-charge', t.toFixed(3));
      if (t < 1) {
        this.hintRaf = requestAnimationFrame(tick);
      } else if (this.active) {
        this.lampEl.dataset.state = 'ready';
        this.lampEl.classList.remove('is-refused');
      }
    };
    this.lampEl.style.setProperty('--hint-charge', '0');
    this.hintRaf = requestAnimationFrame(tick);
  }

  private updateLamp() {
    const total = this.def ? this.hints(this.def).length : 0;
    const left = Math.max(0, total - this.hintsShown);
    this.lampCountEl.textContent = left ? '·'.repeat(left) : '';
    this.lampEl.setAttribute(
      'aria-label',
      left
        ? `Turn up the lamp for a hint (${left} of ${total} remaining)`
        : 'No hints remain',
    );
    /* `aria-disabled`, never `disabled`: the button must stay focusable and
       still answer, because "why can't I have another hint" is exactly the
       question the refusal line exists to answer. */
    this.lampEl.setAttribute('aria-disabled', left ? 'false' : 'true');
  }

  // -- the bail-out ----------------------------------------------------------

  /**
   * `allowSkipAfterMs` is an accessibility promise, not a difficulty setting:
   * the player who cannot see the pattern, or cannot make the gesture, still
   * gets to see the rest of the story. It appears quietly and late.
   */
  private armSkip(def: PuzzleDefinition) {
    if (def.allowSkipAfterMs === undefined) return;
    // Guarded by identity, not by a flag: a puzzle closed before its timer
    // fires must not offer the bail-out on whatever is opened next.
    this.after(Math.max(0, def.allowSkipAfterMs), () => {
      if (this.def === def) this.revealSkip();
    });
  }

  private revealSkip() {
    // `settle`, not `active`: during the closing fade the host is still active
    // but nothing on it is offerable any more.
    if (!this.active || !this.settle) return;
    this.skipEl.classList.add('is-in');
    this.skipEl.tabIndex = 0;
    this.skipEl.removeAttribute('aria-hidden');
  }

  // -- settling --------------------------------------------------------------

  /** Resolves the open promise exactly once. */
  private finish(solved: boolean, silent = false) {
    const settle = this.settle;
    if (!settle) return;
    this.settle = null;
    cancelAnimationFrame(this.hintRaf);
    if (!silent) this.cb.onSound?.(solved ? 'lock-click' : 'drawer-open');
    settle(solved);
  }

  // -- keyboard --------------------------------------------------------------

  private onKey(ev: KeyboardEvent) {
    if (!this.active || this.el.hidden) return;

    // Browser and OS chords are never ours: a puzzle must not eat Ctrl+R.
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      this.cb.onSound?.('click-soft');
      this.finish(false);
      return;
    }

    if (ev.key === 'Tab') {
      // Trapped rather than blocked: while the bench is up, its own fittings
      // are the only things in the document worth reaching.
      ev.preventDefault();
      ev.stopImmediatePropagation();
      this.cycleFocus(ev.shiftKey ? -1 : 1);
      return;
    }

    // The mechanism has already seen this key. Stop the game from also acting
    // on it and opening the journal behind an open puzzle.
    if (SWALLOWED_KEYS.has(ev.key.toLowerCase())) ev.stopImmediatePropagation();
  }

  /**
   * Moves focus one stop around the bench, wrapping at both ends.
   *
   * The filter is deliberately stricter than the selector: a `<button>` still
   * matches `button:not([disabled])` after JS has set `tabIndex = -1` on it, so
   * the bail-out — which is present in the layout from the first frame and only
   * *becomes* reachable later — would otherwise be a focus stop the player can
   * hit before it has been offered to them.
   */
  private cycleFocus(dir: 1 | -1) {
    const nodes = [...this.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) =>
        n.tabIndex >= 0 &&
        n.offsetParent !== null &&
        !n.hasAttribute('inert') &&
        n.getAttribute('aria-hidden') !== 'true' &&
        n.closest('[aria-hidden="true"], [hidden]') === null,
    );
    if (!nodes.length) {
      this.panel.focus({ preventScroll: true });
      return;
    }
    const here = nodes.indexOf(document.activeElement as HTMLElement);
    // Focus parked on the panel itself (or lost entirely) enters at whichever
    // end the player is travelling towards, rather than one short of it.
    const next = here < 0 ? (dir === 1 ? 0 : nodes.length - 1) : (here + dir + nodes.length) % nodes.length;
    nodes[next].focus({ preventScroll: true });
  }

  // -- plumbing --------------------------------------------------------------

  private q<T extends HTMLElement>(sel: string): T {
    return this.el.querySelector<T>(sel)!;
  }

  private after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.after(ms, resolve));
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

// ===========================================================================
// Shared puzzle primitives
// ---------------------------------------------------------------------------
// Every control below follows the same three rules, because a player should
// only ever have to learn them once:
//
//   1. Pointer events only — one code path covers mouse, touch and pen, and
//      pointer capture means a fast drag never escapes the control.
//   2. Keyboard equivalent for every gesture. Arrow keys nudge, Shift makes it
//      coarse, Home/End go to the extremes, Enter/Space commits.
//   3. All styling comes from `puzzle.css`; the JS sets values and classes and
//      never writes a colour, a duration or a font.
//
// They all return a {@link Control}, so a puzzle can hold a heterogeneous list
// of its parts, read them, restore them from `ctx.state`, and tear them down.
// ===========================================================================

/** A point in CSS pixels, relative to whatever the control anchors against. */
export interface Point {
  x: number;
  y: number;
}

/** Feedback sink, shaped so a puzzle can pass `ctx.feedback` in directly. */
export type FeedbackFn = PuzzleContext['feedback'];

/**
 * The uniform handle every primitive returns.
 *
 * `set` takes a `silent` flag because restoring a saved position and being
 * dragged to it are the same state change but very different events: the
 * former must not fire the `onChange` that would re-persist or re-score it.
 */
export interface Control<T> {
  readonly el: HTMLElement;
  get(): T;
  set(value: T, silent?: boolean): void;
  destroy(): void;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const snap = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);

/** Shorthand for building a styled element without a wall of assignments. */
function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// -- draggable ---------------------------------------------------------------

export interface DraggableOptions {
  /** Snap increment in px; a pair snaps the axes independently. */
  grid?: number | [number, number];
  /** Element the dragged thing may not leave. Usually the puzzle stage. */
  bounds?: HTMLElement | null;
  axis?: 'x' | 'y' | 'both';
  /** Keyboard nudge in px. Defaults to the grid, or 8px when free-floating. */
  step?: number;
  /** Starting offset, e.g. one restored from `ctx.state`. */
  position?: Point;
  /** Grab area, when only part of the element should start a drag. */
  handle?: HTMLElement;
  /** Accessible name. Required for anything the player can actually move. */
  label?: string;
  feedback?: FeedbackFn;
  onMove?(p: Point): void;
  /** Fires once when the piece is let go — the moment to score or persist. */
  onDrop?(p: Point): void;
}

/**
 * Makes an element draggable by pointer or keyboard.
 *
 * The position is expressed as a *translation* from wherever CSS already put
 * the element, which is what lets content lay pieces out in percentages and
 * still get pixel-exact dragging. The primitive owns the element's `transform`;
 * wrap the element if you need a transform of your own.
 */
export function makeDraggable(el: HTMLElement, opts: DraggableOptions = {}): Control<Point> {
  const ac = new AbortController();
  const { signal } = ac;
  const axis = opts.axis ?? 'both';
  const gx = Array.isArray(opts.grid) ? opts.grid[0] : (opts.grid ?? 0);
  const gy = Array.isArray(opts.grid) ? opts.grid[1] : (opts.grid ?? 0);
  const step = opts.step ?? (gx || 8);
  const grip = opts.handle ?? el;

  let pos: Point = { x: opts.position?.x ?? 0, y: opts.position?.y ?? 0 };
  let limits: { minX: number; maxX: number; minY: number; maxY: number } | null = null;

  el.classList.add('pz-draggable');
  if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  if (opts.label) el.setAttribute('aria-label', opts.label);
  el.setAttribute('aria-roledescription', 'draggable piece');
  grip.classList.add('pz-grip');

  const apply = () => {
    el.style.setProperty('--drag-x', `${pos.x}px`);
    el.style.setProperty('--drag-y', `${pos.y}px`);
  };

  /**
   * Bounds are resolved in translation space at the moment of the gesture, not
   * at construction: the stage can be resized, and the piece may have been
   * moved by code since the last drag.
   */
  const measure = () => {
    const box = opts.bounds;
    if (!box) {
      limits = null;
      return;
    }
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const minX = pos.x + (b.left - r.left);
    const maxX = pos.x + (b.right - r.right);
    const minY = pos.y + (b.top - r.top);
    const maxY = pos.y + (b.bottom - r.bottom);
    // A piece larger than its bounds would otherwise get a reversed range and
    // snap to a corner; pinning it where it stands is the honest fallback.
    limits = {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minY: Math.min(minY, maxY),
      maxY: Math.max(minY, maxY),
    };
  };

  const place = (x: number, y: number, notify: boolean) => {
    let nx = axis === 'y' ? pos.x : snap(x, gx);
    let ny = axis === 'x' ? pos.y : snap(y, gy);
    if (limits) {
      nx = clamp(nx, limits.minX, limits.maxX);
      ny = clamp(ny, limits.minY, limits.maxY);
    }
    if (nx === pos.x && ny === pos.y) return;
    pos = { x: nx, y: ny };
    apply();
    if (notify) opts.onMove?.(pos);
  };

  let from: Point | null = null;
  let origin: Point = { x: 0, y: 0 };

  grip.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.preventDefault();
      grip.setPointerCapture(ev.pointerId);
      from = { x: ev.clientX, y: ev.clientY };
      origin = { ...pos };
      measure();
      el.classList.add('is-dragging');
      el.focus({ preventScroll: true });
      opts.feedback?.('click');
    },
    { signal },
  );

  grip.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (!from) return;
      place(origin.x + (ev.clientX - from.x), origin.y + (ev.clientY - from.y), true);
    },
    { signal },
  );

  const release = (ev: PointerEvent) => {
    if (!from) return;
    from = null;
    if (grip.hasPointerCapture(ev.pointerId)) grip.releasePointerCapture(ev.pointerId);
    el.classList.remove('is-dragging');
    opts.onDrop?.(pos);
  };
  grip.addEventListener('pointerup', release, { signal });
  grip.addEventListener('pointercancel', release, { signal });
  /* Capture can be revoked out from under us — the element is removed, another
     pointer takes over, the browser cancels the gesture. Without this the piece
     stays glued to the cursor with `is-dragging` stuck on. */
  grip.addEventListener('lostpointercapture', release, { signal });

  /** True between the first arrow keydown and the matching keyup. */
  let nudging = false;

  el.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      const d = ev.shiftKey ? step * 4 : step;
      let dx = 0;
      let dy = 0;
      if (ev.key === 'ArrowLeft') dx = -d;
      else if (ev.key === 'ArrowRight') dx = d;
      else if (ev.key === 'ArrowUp') dy = -d;
      else if (ev.key === 'ArrowDown') dy = d;
      else return;
      ev.preventDefault();
      ev.stopPropagation();
      measure();
      const before = pos;
      place(pos.x + dx, pos.y + dy, true);
      // Silence at the boundary: a tick per keypress against a wall is the
      // control lying about having moved.
      if (pos !== before) {
        nudging = true;
        opts.feedback?.('tick');
      }
    },
    { signal },
  );

  // One commit per burst of key presses, matching "let go of the mouse".
  el.addEventListener(
    'keyup',
    (ev: KeyboardEvent) => {
      if (!nudging || !ev.key.startsWith('Arrow')) return;
      nudging = false;
      opts.onDrop?.(pos);
    },
    { signal },
  );

  apply();

  return {
    el,
    get: () => ({ ...pos }),
    set: (p, silent) => {
      pos = { x: p.x, y: p.y };
      apply();
      if (!silent) opts.onMove?.(pos);
    },
    destroy: () => {
      ac.abort();
      el.classList.remove('pz-draggable', 'is-dragging');
      grip.classList.remove('pz-grip');
      el.removeAttribute('aria-roledescription');
      el.style.removeProperty('--drag-x');
      el.style.removeProperty('--drag-y');
    },
  };
}

// -- rotatable ---------------------------------------------------------------

export interface RotatableOptions {
  /** Starting angle in degrees. */
  angle?: number;
  /** Detent spacing in degrees. 0 rotates freely. */
  detent?: number;
  /** Travel limits in degrees. Omit both for a freely spinning part. */
  min?: number;
  max?: number;
  /** Keyboard increment. Defaults to one detent, or 15 degrees when free. */
  step?: number;
  label?: string;
  feedback?: FeedbackFn;
  onChange?(deg: number): void;
  /** Fires when the hand comes off — the moment to test the combination. */
  onCommit?(deg: number): void;
}

/**
 * Drag-to-rotate with detents.
 *
 * Angle is tracked as an unwrapped running total rather than as a compass
 * bearing, so a dial can be wound through several turns and a detent index
 * stays monotonic — which is exactly what a combination lock needs.
 */
export function makeRotatable(el: HTMLElement, opts: RotatableOptions = {}): Control<number> {
  const ac = new AbortController();
  const { signal } = ac;
  const detent = opts.detent ?? 0;
  const step = opts.step ?? (detent || 15);

  let angle = opts.angle ?? 0;
  let lastDetent = detent ? Math.round(angle / detent) : 0;
  /** Unwrapped running total the gesture accumulates into. */
  let raw = angle;

  el.classList.add('pz-rotatable');
  if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  if (opts.label) el.setAttribute('aria-label', opts.label);

  const apply = () => el.style.setProperty('--rot', `${angle}deg`);

  /**
   * Commits a running angle to the visible one.
   *
   * The running total is clamped *as well as* the committed angle, and that is
   * the whole point: if only the output were clamped, winding past a stop would
   * keep piling degrees into `raw`, and the player would then have to unwind
   * every one of them before the part moved again — a control that feels
   * broken precisely when you have hit its limit.
   */
  const place = (running: number, notify: boolean) => {
    let r = running;
    if (opts.min !== undefined && r < opts.min) r = opts.min;
    if (opts.max !== undefined && r > opts.max) r = opts.max;
    raw = r;

    let next = detent ? snap(r, detent) : r;
    // Snapping can step back outside the travel (a 45° detent against a 337°
    // stop rounds to 360), so the limits get the last word.
    if (opts.min !== undefined && next < opts.min) next = opts.min;
    if (opts.max !== undefined && next > opts.max) next = opts.max;
    if (next === angle) return;
    angle = next;
    apply();
    if (detent) {
      const idx = Math.round(angle / detent);
      if (idx !== lastDetent) {
        lastDetent = idx;
        opts.feedback?.('tick');
      }
    }
    if (notify) opts.onChange?.(angle);
  };

  /** Pointer bearing from the element's centre, in degrees. */
  const bearing = (ev: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return (
      (Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) *
        180) /
      Math.PI
    );
  };

  let dragging = false;
  let lastBearing = 0;

  el.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      dragging = true;
      raw = angle;
      lastBearing = bearing(ev);
      el.classList.add('is-turning');
      el.focus({ preventScroll: true });
    },
    { signal },
  );

  el.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (!dragging) return;
      const b = bearing(ev);
      // Unwrap across the ±180 seam so a drag past due-west keeps counting up.
      let d = b - lastBearing;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastBearing = b;
      place(raw + d, true);
    },
    { signal },
  );

  const release = (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    el.classList.remove('is-turning');
    opts.onCommit?.(angle);
  };
  el.addEventListener('pointerup', release, { signal });
  el.addEventListener('pointercancel', release, { signal });
  el.addEventListener('lostpointercapture', release, { signal });

  el.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      let d = 0;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') d = step;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') d = -step;
      else if (ev.key === 'Home' && opts.min !== undefined) d = opts.min - angle;
      else if (ev.key === 'End' && opts.max !== undefined) d = opts.max - angle;
      else return;
      ev.preventDefault();
      ev.stopPropagation();
      place(angle + d, true);
      opts.onCommit?.(angle);
    },
    { signal },
  );

  apply();

  return {
    el,
    get: () => angle,
    set: (deg, silent) => {
      angle = deg;
      raw = deg;
      lastDetent = detent ? Math.round(deg / detent) : 0;
      apply();
      if (!silent) opts.onChange?.(angle);
    },
    destroy: () => {
      ac.abort();
      el.classList.remove('pz-rotatable', 'is-turning');
      el.style.removeProperty('--rot');
    },
  };
}

// -- dial --------------------------------------------------------------------

export interface DialOptions {
  /** Accessible name, e.g. "First dial". */
  label: string;
  /** Positions around the face. */
  steps: number;
  value?: number;
  /** Face legends, one per step. Defaults to the step number. */
  labels?: string[];
  /** Whether turning past the last position wraps to the first. Default true. */
  wrap?: boolean;
  /** Any CSS length; drives `--dial-size`. */
  size?: string;
  feedback?: FeedbackFn;
  /** `committed` is false while the hand is still on the dial. */
  onChange?(value: number, committed: boolean): void;
}

/**
 * A rendered rotary dial: brass bezel, engraved ticks, knurled knob.
 *
 * Values are step *indices*, not angles — a lock cares which number is under
 * the mark, never how many times you went round to get there.
 */
export function makeDial(opts: DialOptions): Control<number> {
  const steps = Math.max(2, Math.floor(opts.steps));
  const per = 360 / steps;
  const wrap = opts.wrap ?? true;

  const el = make('div', 'pz-dial');
  if (opts.size) el.style.setProperty('--dial-size', opts.size);

  const bezel = make('div', 'pz-dial-bezel', { 'aria-hidden': 'true' });
  for (let i = 0; i < steps; i++) {
    const tick = make('span', 'pz-dial-tick');
    tick.style.setProperty('--tick-angle', `${i * per}deg`);
    const legend = make('span', 'pz-dial-legend');
    legend.textContent = opts.labels?.[i] ?? String(i);
    tick.appendChild(legend);
    bezel.appendChild(tick);
  }

  const knob = make('div', 'pz-dial-knob', {
    role: 'spinbutton',
    tabindex: '0',
    'aria-valuemin': '0',
    'aria-valuemax': String(steps - 1),
  });
  for (let i = 0; i < 12; i++) {
    const grip = make('span', 'pz-dial-knurl', { 'aria-hidden': 'true' });
    grip.style.setProperty('--tick-angle', `${i * 30}deg`);
    knob.appendChild(grip);
  }
  knob.appendChild(make('span', 'pz-dial-index', { 'aria-hidden': 'true' }));

  const readout = make('span', 'pz-dial-readout', { 'aria-hidden': 'true' });

  /* The face is its own square box so the engraved readout underneath takes up
     real room in the layout. Hanging it off the bottom of a round element with
     a negative offset looks fine alone and collides the moment a puzzle puts
     four dials in a row. */
  const face = make('div', 'pz-dial-face');
  face.append(bezel, knob);
  el.append(face, readout);

  let value = clamp(Math.round(opts.value ?? 0), 0, steps - 1);

  const legendFor = (v: number) => opts.labels?.[v] ?? String(v);

  const show = (v: number, committed: boolean, notify: boolean) => {
    const changed = v !== value;
    value = v;
    knob.setAttribute('aria-valuenow', String(value));
    knob.setAttribute('aria-valuetext', legendFor(value));
    readout.textContent = legendFor(value);
    // A commit always reports, even unchanged: "the hand came off the dial" is
    // the event a lock listens for. Mid-turn frames only report real movement.
    if (notify && (changed || committed)) opts.onChange?.(value, committed);
  };

  const rot = makeRotatable(knob, {
    angle: value * per,
    detent: per,
    min: wrap ? undefined : 0,
    max: wrap ? undefined : (steps - 1) * per,
    label: opts.label,
    feedback: opts.feedback,
    onChange: (deg) => show(indexOf(deg), false, true),
    onCommit: (deg) => show(indexOf(deg), true, true),
  });

  /** Unwrapped angle to a canonical 0..steps-1 index. */
  function indexOf(deg: number): number {
    const i = Math.round(deg / per) % steps;
    return i < 0 ? i + steps : i;
  }

  show(value, true, false);

  return {
    el,
    get: () => value,
    set: (v, silent) => {
      const next = clamp(Math.round(v), 0, steps - 1);
      rot.set(next * per, true);
      show(next, true, !silent);
    },
    destroy: () => {
      rot.destroy();
      el.remove();
    },
  };
}

// -- slider ------------------------------------------------------------------

export interface SliderOptions {
  label: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  orientation?: 'horizontal' | 'vertical';
  /** Any CSS length; drives `--slider-length` along the travel axis. */
  length?: string;
  /** Turns the raw number into the readout and the spoken value. */
  format?(v: number): string;
  feedback?: FeedbackFn;
  onChange?(v: number, committed: boolean): void;
}

/**
 * A brass lever in a sunk track. Pointer anywhere on the track jumps the thumb
 * there — hunting for an 8px handle is not a puzzle, it is an eye test.
 */
export function makeSlider(opts: SliderOptions): Control<number> {
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  const step = opts.step ?? 1;
  const vertical = opts.orientation === 'vertical';
  const fmt = opts.format ?? ((v: number) => String(v));

  const el = make('div', 'pz-slider');
  el.dataset.orient = vertical ? 'vertical' : 'horizontal';
  if (opts.length) el.style.setProperty('--slider-length', opts.length);

  const track = make('div', 'pz-slider-track', { 'aria-hidden': 'true' });
  track.appendChild(make('span', 'pz-slider-fill'));
  const thumb = make('div', 'pz-slider-thumb', {
    role: 'slider',
    tabindex: '0',
    'aria-label': opts.label,
    'aria-valuemin': String(min),
    'aria-valuemax': String(max),
    'aria-orientation': vertical ? 'vertical' : 'horizontal',
  });
  const readout = make('span', 'pz-slider-readout', { 'aria-hidden': 'true' });
  el.append(track, thumb, readout);

  let value = clamp(opts.value ?? min, min, max);
  const ac = new AbortController();
  const { signal } = ac;

  const apply = () => {
    const frac = (value - min) / (max - min || 1);
    el.style.setProperty('--slider-frac', frac.toFixed(4));
    thumb.setAttribute('aria-valuenow', String(value));
    thumb.setAttribute('aria-valuetext', fmt(value));
    readout.textContent = fmt(value);
  };

  /**
   * Detents are audible, but a fine-grained lever swept end to end would fire
   * a hundred of them and turn into a rattle. One tick per this many
   * milliseconds still reads as "the lever is stepping"; beyond that it is just
   * noise, and it is the noise a cheap web widget makes.
   */
  const MS_TICK_GAP = 45;
  let lastTick = 0;

  const place = (v: number, committed: boolean) => {
    const next = clamp(snap(v - min, step) + min, min, max);
    if (next === value) return;
    value = next;
    apply();
    const now = performance.now();
    if (now - lastTick > MS_TICK_GAP) {
      lastTick = now;
      opts.feedback?.('tick');
    }
    opts.onChange?.(value, committed);
  };

  const fromPointer = (ev: PointerEvent) => {
    const r = track.getBoundingClientRect();
    // Vertical sliders read "up is more", which is the opposite of screen Y.
    const frac = vertical
      ? 1 - (ev.clientY - r.top) / (r.height || 1)
      : (ev.clientX - r.left) / (r.width || 1);
    return min + clamp(frac, 0, 1) * (max - min);
  };

  let dragging = false;

  el.addEventListener(
    'pointerdown',
    (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      dragging = true;
      el.classList.add('is-sliding');
      thumb.focus({ preventScroll: true });
      place(fromPointer(ev), false);
    },
    { signal },
  );

  el.addEventListener(
    'pointermove',
    (ev: PointerEvent) => {
      if (dragging) place(fromPointer(ev), false);
    },
    { signal },
  );

  const release = (ev: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    el.classList.remove('is-sliding');
    opts.onChange?.(value, true);
  };
  el.addEventListener('pointerup', release, { signal });
  el.addEventListener('pointercancel', release, { signal });
  el.addEventListener('lostpointercapture', release, { signal });

  thumb.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      const coarse = ev.shiftKey ? step * 5 : step;
      let next: number | null = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') next = value + coarse;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') next = value - coarse;
      else if (ev.key === 'PageUp') next = value + step * 10;
      else if (ev.key === 'PageDown') next = value - step * 10;
      else if (ev.key === 'Home') next = min;
      else if (ev.key === 'End') next = max;
      if (next === null) return;
      ev.preventDefault();
      ev.stopPropagation();
      place(next, true);
    },
    { signal },
  );

  apply();

  return {
    el,
    get: () => value,
    set: (v, silent) => {
      value = clamp(snap(v - min, step) + min, min, max);
      apply();
      if (!silent) opts.onChange?.(value, true);
    },
    destroy: () => {
      ac.abort();
      el.remove();
    },
  };
}

// -- toggle ------------------------------------------------------------------

export interface ToggleOptions {
  label: string;
  value?: boolean;
  /** Legends engraved either side of the well. */
  onLabel?: string;
  offLabel?: string;
  feedback?: FeedbackFn;
  onChange?(v: boolean): void;
}

/** A sprung brass switch. Reports as `role="switch"`, so it reads as one too. */
export function makeToggle(opts: ToggleOptions): Control<boolean> {
  const el = make('button', 'pz-toggle', {
    type: 'button',
    role: 'switch',
    'aria-label': opts.label,
  });
  const well = make('span', 'pz-toggle-well', { 'aria-hidden': 'true' });
  well.append(make('span', 'pz-toggle-lever'));
  const legend = make('span', 'pz-toggle-legend', { 'aria-hidden': 'true' });
  el.append(well, legend);

  let value = opts.value ?? false;
  const ac = new AbortController();

  const apply = () => {
    el.setAttribute('aria-checked', String(value));
    el.classList.toggle('is-on', value);
    legend.textContent = value ? (opts.onLabel ?? 'On') : (opts.offLabel ?? 'Off');
  };

  el.addEventListener(
    'click',
    () => {
      value = !value;
      apply();
      opts.feedback?.('click');
      opts.onChange?.(value);
    },
    { signal: ac.signal },
  );

  apply();

  return {
    el,
    get: () => value,
    set: (v, silent) => {
      value = v;
      apply();
      if (!silent) opts.onChange?.(value);
    },
    destroy: () => {
      ac.abort();
      el.remove();
    },
  };
}

// -- keypad ------------------------------------------------------------------

export interface KeypadOptions {
  label: string;
  /** Key faces, in reading order. Defaults to 1-9 then 0. */
  keys?: string[];
  columns?: number;
  /** Entry length. Reaching it auto-submits unless `autoSubmit` is false. */
  length?: number;
  autoSubmit?: boolean;
  /** Render the entry as pips rather than glyphs, for a combination. */
  mask?: boolean;
  feedback?: FeedbackFn;
  onChange?(entry: string): void;
  /** Called with the finished entry. The pad clears itself afterwards. */
  onSubmit?(entry: string): void;
}

const DEFAULT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * A keypad with a readout above it.
 *
 * Arrow keys walk the grid with a roving tabindex — one stop in the tab order
 * for the whole pad, because tabbing through twelve buttons to reach the last
 * digit is not accessibility, it is punishment. Typing a key face on the
 * physical keyboard presses that key directly.
 */
export function makeKeypad(opts: KeypadOptions): Control<string> {
  // An empty face list would leave the roving cursor doing modulo zero, which
  // is NaN, which is a keypad that throws the first time it is arrowed into.
  const keys = opts.keys?.length ? opts.keys : DEFAULT_KEYS;
  const columns = Math.max(1, Math.floor(opts.columns ?? 3));
  const autoSubmit = opts.autoSubmit ?? opts.length !== undefined;

  const el = make('div', 'pz-keypad', { role: 'group', 'aria-label': opts.label });
  el.style.setProperty('--keypad-columns', String(columns));

  const readout = make('output', 'pz-keypad-readout', { 'aria-live': 'polite' });
  const grid = make('div', 'pz-keypad-grid');
  const foot = make('div', 'pz-keypad-foot');
  el.append(readout, grid, foot);

  let entry = '';
  const ac = new AbortController();
  const { signal } = ac;
  const buttons: HTMLButtonElement[] = [];
  let cursor = 0;

  const apply = () => {
    if (opts.mask) {
      readout.textContent = '·'.repeat(entry.length) || '—';
    } else {
      const pad = opts.length ? Math.max(0, opts.length - entry.length) : 0;
      readout.textContent = (entry + '_'.repeat(pad)) || '—';
    }
    readout.setAttribute('aria-label', entry ? `Entered ${entry.split('').join(' ')}` : 'Empty');
  };

  const submit = () => {
    if (!entry) return;
    const done = entry;
    entry = '';
    apply();
    opts.onSubmit?.(done);
  };

  const press = (face: string) => {
    if (opts.length !== undefined && entry.length >= opts.length) return;
    entry += face;
    apply();
    opts.feedback?.('click');
    opts.onChange?.(entry);
    if (autoSubmit && opts.length !== undefined && entry.length === opts.length) submit();
  };

  const focusKey = (i: number) => {
    cursor = (i + buttons.length) % buttons.length;
    buttons.forEach((b, n) => (b.tabIndex = n === cursor ? 0 : -1));
    buttons[cursor].focus({ preventScroll: true });
  };

  keys.forEach((face, i) => {
    const key = make('button', 'pz-keypad-key', { type: 'button' });
    key.textContent = face;
    key.tabIndex = i === 0 ? 0 : -1;
    key.addEventListener('click', () => press(face), { signal });
    buttons.push(key);
    grid.appendChild(key);
  });

  const clearBtn = make('button', 'pz-keypad-aux', { type: 'button' });
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener(
    'click',
    () => {
      entry = '';
      apply();
      opts.feedback?.('tick');
      opts.onChange?.(entry);
    },
    { signal },
  );
  foot.appendChild(clearBtn);

  if (!autoSubmit) {
    const enterBtn = make('button', 'pz-keypad-aux is-enter', { type: 'button' });
    enterBtn.textContent = 'Enter';
    enterBtn.addEventListener('click', submit, { signal });
    foot.appendChild(enterBtn);
  }

  grid.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      let next: number | null = null;
      if (ev.key === 'ArrowRight') next = cursor + 1;
      else if (ev.key === 'ArrowLeft') next = cursor - 1;
      else if (ev.key === 'ArrowDown') next = cursor + columns;
      else if (ev.key === 'ArrowUp') next = cursor - columns;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = buttons.length - 1;
      else if (ev.key === 'Backspace') {
        ev.preventDefault();
        ev.stopPropagation();
        entry = entry.slice(0, -1);
        apply();
        opts.feedback?.('tick');
        opts.onChange?.(entry);
        return;
      } else {
        const hit = keys.indexOf(ev.key);
        if (hit < 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        buttons[hit].click();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      focusKey(next);
    },
    { signal },
  );

  apply();

  return {
    el,
    get: () => entry,
    set: (v, silent) => {
      entry = opts.length === undefined ? v : v.slice(0, opts.length);
      apply();
      if (!silent) opts.onChange?.(entry);
    },
    destroy: () => {
      ac.abort();
      el.remove();
    },
  };
}
