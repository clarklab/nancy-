/**
 * The conversation view: where the cast performs.
 *
 * Everything else in the game is a room you look at; this is the one surface
 * where another person looks back. So the scene is not replaced, only pushed
 * out of focus — the player is still standing in the room, they have simply
 * stopped noticing it. The portrait stands on the floor of the frame, breathes,
 * and is lit from the same side the room is; the reply lands on paper; and the
 * player's own lines are physical plates you press.
 *
 * The view owns presentation and nothing else. It never decides what a line
 * *means*: `availableIf` is asked of {@link GameState.check}, effects are handed
 * straight back to {@link GameState.run}, and the only state it writes is the
 * `usedDialogueNodes` bookkeeping the content schema requires.
 */

import { preload } from '@/engine/scene-view';
import type { GameState } from '@/engine/state';
import type { Character, Condition, DialogueNode, DialogueTree } from '@/engine/types';

export interface DialogueCallbacks {
  /** Named cue from the shared SFX table, e.g. `click-brass`. */
  onSound?(name: string): void;
}

/* Motion constants mirror the --dur-* tokens. They live here because the
   conversation is sequenced in JS and cannot read a CSS duration reliably. */
const MS_OPEN = 620;
const MS_CLOSE = 460;
/** Beat between pressing a plate and the reply starting, so the press lands. */
const MS_PICK = 190;
/** Per-plate entrance stagger — the stack deals itself out rather than popping. */
const MS_PLATE_STAGGER = 55;
/** ~30ms/char reads as speech without testing patience. Matches narration. */
const MS_PER_CHAR = 30;
/** Only every third glyph ticks, and never faster than this. */
const TICK_EVERY = 3;
const MS_TICK_MIN = 52;

/** Digits that select a plate directly. Ten plates would need a two-key combo. */
const HOTKEYS = '123456789';

/**
 * Used when a tree omits `exhausted`. Deliberately in the detective's voice and
 * deliberately not final — "not yet" tells the player to come back with more.
 */
const DEFAULT_EXHAUSTED = 'There is nothing more to press them on. Not yet.';
const LEAVE_LABEL = 'End conversation';

/**
 * Sentinel returned by the chooser for the leave plate, so "the player asked to
 * go" and "the player chose a topic" are the same code path.
 */
const LEAVE_NODE: DialogueNode = { id: '__leave', playerLine: LEAVE_LABEL, reply: '' };

/** Moods tried, in order, when a confrontation lands and the art exists. */
const CONFRONT_MOODS = ['angry', 'defensive', 'guarded', 'shaken'];

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const lines = (t: string | string[]) => (Array.isArray(t) ? t : [t]);

/**
 * Full-screen conversation overlay. Construct once per session, `mount` it into
 * the overlay layer, and drive it one conversation at a time with
 * {@link DialogueView.converse}.
 */
export class DialogueView {
  readonly el: HTMLElement;

  private cb: DialogueCallbacks;

  private nameEl!: HTMLElement;
  private roleEl!: HTMLElement;
  private speechEl!: HTMLElement;
  private echoEl!: HTMLElement;
  private textEl!: HTMLElement;
  private liveEl!: HTMLElement;
  private choicesEl!: HTMLElement;
  /** Two stacked faces so a mood change dissolves instead of cutting. */
  private faces!: [HTMLImageElement, HTMLImageElement];
  private face = 0;

  /** True from the first frame of `converse` until the overlay is gone. */
  private active = false;
  /** Set while text is still revealing, so a click completes instead of advancing. */
  private completeReveal: (() => void) | null = null;
  /** Resolver for the line currently on screen. */
  private advanceLine: (() => void) | null = null;
  /** Resolver for the choice currently being offered. */
  private settleChoice: ((node: DialogueNode | null) => void) | null = null;
  /** Set by Escape: unwinds the whole conversation without the farewell. */
  private aborted = false;

  private plates: HTMLButtonElement[] = [];
  private cursor = 0;
  private restoreFocus: HTMLElement | null = null;
  private timers = new Set<number>();

  constructor(cb: DialogueCallbacks = {}) {
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.className = 'dialogue-root';
    this.el.dataset.mode = 'idle';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Conversation');
    this.el.tabIndex = -1;
    this.el.hidden = true;

    this.el.innerHTML = `
      <div class="dialogue-scrim" aria-hidden="true"></div>
      <div class="dialogue-stage stage-box">
        <div class="dialogue-bay">
          <div class="dialogue-keylight" aria-hidden="true"></div>
          <div class="dialogue-portrait">
            <img class="dialogue-face is-front" alt="" draggable="false" />
            <img class="dialogue-face" alt="" draggable="false" />
          </div>
          <div class="dialogue-nameplate">
            <span class="dialogue-name"></span>
            <span class="dialogue-role"></span>
          </div>
        </div>

        <div class="dialogue-speech" aria-hidden="true">
          <p class="dialogue-echo"></p>
          <p class="dialogue-text"></p>
          <span class="dialogue-caret" aria-hidden="true"></span>
        </div>

        <div class="dialogue-tray">
          <div class="dialogue-choices" role="menu" aria-label="What to say"></div>
          <p class="dialogue-hint" aria-hidden="true">
            <span>1&ndash;9 choose</span><span>&uarr;&darr; move</span><span>Enter say it</span><span>Esc leave</span>
          </p>
        </div>
      </div>
      <p class="dialogue-live sr-only" role="status" aria-live="polite"></p>`;

    this.nameEl = this.q('.dialogue-name');
    this.roleEl = this.q('.dialogue-role');
    this.speechEl = this.q('.dialogue-speech');
    this.echoEl = this.q('.dialogue-echo');
    this.textEl = this.q('.dialogue-text');
    this.liveEl = this.q('.dialogue-live');
    this.choicesEl = this.q('.dialogue-choices');
    this.faces = [...this.el.querySelectorAll<HTMLImageElement>('.dialogue-face')] as [
      HTMLImageElement,
      HTMLImageElement,
    ];

    // Clicking anywhere that is not a plate advances the line being spoken.
    this.el.addEventListener('click', (ev) => {
      if (this.el.dataset.mode !== 'speaking') return;
      if ((ev.target as HTMLElement).closest('.dialogue-plate')) return;
      this.advance();
    });

    this.onKey = this.onKey.bind(this);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.el);
    // Captured, because a conversation outranks every other key binding in the
    // game while it is up — Escape here must never also open the pause menu.
    window.addEventListener('keydown', this.onKey, true);
  }

  /**
   * Runs one conversation to its end. Resolves once the overlay has finished
   * closing, so the caller can safely restore the HUD on the next line.
   *
   * Conversations are strictly sequential: a re-entrant call (a `talk` effect
   * fired from inside a node's own effects) is refused rather than queued,
   * because queueing it would deadlock the very chain it is waiting on.
   */
  async converse(character: Character, tree: DialogueTree, state: GameState): Promise<void> {
    if (this.active) {
      console.warn(`[dialogue] ignoring re-entrant conversation with ${character.id}`);
      return;
    }

    this.active = true;
    this.aborted = false;
    this.restoreFocus = (document.activeElement as HTMLElement | null) ?? null;

    await this.dress(character);
    await this.open();

    this.cb.onSound?.('page-turn');
    await this.speak(lines(tree.greeting), character.name);

    await this.branch(tree.nodes, tree, character, state, true);

    if (!this.aborted && tree.farewell) {
      await this.speak(lines(tree.farewell), character.name);
    }

    this.cb.onSound?.('latch');
    await this.close();
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey, true);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    // Settle anything still awaiting us so a teardown can never hang a caller.
    this.completeReveal = null;
    this.advanceLine?.();
    this.settleChoice?.(null);
    this.active = false;
    this.el.remove();
  }

  // -- conversation flow -----------------------------------------------------

  /**
   * Walks one list of nodes. The root list loops until the player leaves; a
   * child list returns to its caller as soon as it runs dry, which is what
   * makes a follow-up thread fall back to the main topics on its own.
   */
  private async branch(
    nodes: DialogueNode[],
    tree: DialogueTree,
    character: Character,
    state: GameState,
    root: boolean,
  ): Promise<void> {
    while (this.active && !this.aborted) {
      const available = nodes.filter((n) => this.isAvailable(n, state));

      if (!available.length) {
        if (!root) return;
        await this.speak([tree.exhausted ?? DEFAULT_EXHAUSTED], character.name);
        // Still make the player press something: an ending should be chosen.
        await this.offer([], state, true);
        return;
      }

      const chosen = await this.offer(available, state, root);
      if (!chosen || chosen === LEAVE_NODE) return;

      this.showEcho(chosen.playerLine);
      // Effects first, per the content contract: a node may hand over a clue
      // or set a flag that its own reply then refers to as already true.
      await state.run(chosen.effects);
      state.usedDialogueNodes.add(chosen.id);
      state.notify();

      if (chosen.isConfrontation) this.setMood(character, CONFRONT_MOODS);
      if (this.aborted) return;

      await this.speak(lines(chosen.reply), character.name);

      if (chosen.children?.length) {
        await this.branch(chosen.children, tree, character, state, false);
      }
    }
  }

  /**
   * A node is offerable when its condition holds and it has not been spent.
   * `once` defaults to true because most lines are story beats; only content
   * that opts out with `once: false` may be asked twice.
   */
  private isAvailable(node: DialogueNode, state: GameState): boolean {
    if (!state.check(node.availableIf)) return false;
    if (node.once !== false && state.usedDialogueNodes.has(node.id)) return false;
    return true;
  }

  // -- speech ----------------------------------------------------------------

  /** Reveals each line in turn, waiting for the player between them. */
  private async speak(text: string[], speaker: string) {
    this.choicesEl.textContent = '';
    this.plates = [];
    for (const line of text) {
      if (this.aborted || !this.active) return;
      await this.speakLine(line, speaker);
    }
  }

  private speakLine(line: string, speaker: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.el.dataset.mode = 'speaking';
      this.speechEl.classList.add('is-visible');
      this.speechEl.classList.remove('is-ready');
      this.textEl.textContent = '';
      // Announce the whole line at once; a live region fed one character at a
      // time is unusable with a screen reader.
      this.liveEl.textContent = `${speaker}: ${line}`;

      const done = () => {
        this.advanceLine = null;
        this.completeReveal = null;
        this.speechEl.classList.remove('is-ready');
        resolve();
      };

      this.completeReveal = this.typewrite(line, () => {
        this.completeReveal = null;
        this.speechEl.classList.add('is-ready');
      });
      this.advanceLine = done;
    });
  }

  /** The chosen line, kept above the reply so the exchange reads as a pair. */
  private showEcho(playerLine: string) {
    this.echoEl.textContent = playerLine;
    this.speechEl.classList.add('has-echo');
  }

  /** First input completes the reveal; the next one moves on. */
  private advance() {
    if (this.completeReveal) {
      this.completeReveal();
      this.completeReveal = null;
      return;
    }
    this.advanceLine?.();
  }

  /**
   * Reveals text character by character into the speech panel. Returns a
   * function that completes the reveal immediately — the "click to finish the
   * line" affordance every adventure game needs.
   */
  private typewrite(text: string, onDone: () => void): () => void {
    if (reduced()) {
      this.textEl.textContent = text;
      onDone();
      return () => {};
    }

    let i = 0;
    let raf = 0;
    let last = performance.now();
    let lastTick = 0;

    const tick = (now: number) => {
      const due = Math.floor((now - last) / MS_PER_CHAR);
      if (due > 0) {
        const before = i;
        i = Math.min(text.length, i + due);
        last = now;
        this.textEl.textContent = text.slice(0, i);
        // One tick per few glyphs, rate-limited, and never for whitespace —
        // otherwise a fast machine machine-guns the sound channel.
        if (
          Math.floor(i / TICK_EVERY) !== Math.floor(before / TICK_EVERY) &&
          now - lastTick > MS_TICK_MIN &&
          text[i - 1]?.trim()
        ) {
          lastTick = now;
          this.cb.onSound?.('typewriter');
        }
      }
      if (i < text.length) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      this.textEl.textContent = text;
      onDone();
    };
  }

  // -- choices ---------------------------------------------------------------

  /**
   * Deals out the choice plates and waits. Resolves with the chosen node,
   * {@link LEAVE_NODE} for a deliberate goodbye, or `null` when the player
   * escaped out.
   */
  private offer(
    nodes: DialogueNode[],
    state: GameState,
    withLeave: boolean,
  ): Promise<DialogueNode | null> {
    return new Promise((resolve) => {
      this.choicesEl.textContent = '';
      this.plates = [];
      this.cursor = 0;
      this.el.dataset.mode = 'choosing';

      const settle = (node: DialogueNode | null) => {
        if (!this.settleChoice) return;
        this.settleChoice = null;
        for (const p of this.plates) p.disabled = true;
        this.el.dataset.mode = 'busy';
        this.after(reduced() ? 0 : MS_PICK, () => resolve(node));
      };
      this.settleChoice = settle;

      nodes.forEach((node, i) => {
        const clue = findClue(node.availableIf);
        const plate = this.buildPlate({
          index: i,
          label: node.playerLine,
          kind: node.isConfrontation ? 'confront' : 'topic',
          clue: clue ? (state.content.clues[clue]?.name ?? clue) : null,
          pick: () => {
            this.cb.onSound?.(node.isConfrontation ? 'match-strike' : 'click-brass');
            plate.classList.add('is-chosen');
            settle(node);
          },
        });
      });

      if (withLeave) {
        const plate = this.buildPlate({
          index: nodes.length,
          label: LEAVE_LABEL,
          kind: 'leave',
          clue: null,
          pick: () => {
            this.cb.onSound?.('click-soft');
            plate.classList.add('is-chosen');
            settle(LEAVE_NODE);
          },
        });
      }

      this.focusPlate(0);
    });
  }

  private buildPlate(opts: {
    index: number;
    label: string;
    kind: 'topic' | 'confront' | 'leave';
    clue: string | null;
    pick: () => void;
  }): HTMLButtonElement {
    const plate = document.createElement('button');
    plate.type = 'button';
    plate.className = `dialogue-plate is-${opts.kind}`;
    plate.setAttribute('role', 'menuitem');
    plate.tabIndex = -1;
    plate.style.setProperty('--plate-delay', `${opts.index * MS_PLATE_STAGGER}ms`);

    const key = HOTKEYS[opts.index] ?? '';
    plate.innerHTML = `
      <span class="dialogue-key" aria-hidden="true">${key}</span>
      <span class="dialogue-line"></span>
      ${opts.clue ? '<span class="dialogue-clue" aria-hidden="true"></span>' : ''}`;
    plate.querySelector('.dialogue-line')!.textContent = opts.label;

    // The visible plate is a bare line of dialogue; the accessible name has to
    // carry everything the styling says silently.
    const spoken = [
      opts.label,
      opts.kind === 'confront' ? 'accusation' : '',
      opts.clue ? `presents evidence: ${opts.clue}` : '',
    ].filter(Boolean);
    plate.setAttribute('aria-label', spoken.join('. '));
    if (opts.clue) plate.title = `Presents evidence: ${opts.clue}`;

    const index = this.plates.length;
    plate.addEventListener('click', (ev) => {
      ev.stopPropagation();
      opts.pick();
    });
    plate.addEventListener('pointerenter', () => {
      if (this.cursor === index) return;
      this.focusPlate(index, false);
      this.cb.onSound?.('click-soft');
    });
    plate.addEventListener('focus', () => this.setCursor(index));

    this.plates.push(plate);
    this.choicesEl.appendChild(plate);
    requestAnimationFrame(() => plate.classList.add('is-in'));
    return plate;
  }

  /** Roving tabindex: exactly one plate is ever in the tab order. */
  private setCursor(index: number) {
    this.cursor = index;
    this.plates.forEach((p, i) => {
      p.tabIndex = i === index ? 0 : -1;
      p.classList.toggle('is-cursor', i === index);
    });
  }

  private focusPlate(index: number, move = true) {
    if (!this.plates.length) return;
    const i = (index + this.plates.length) % this.plates.length;
    this.setCursor(i);
    if (move) this.plates[i].focus();
  }

  // -- keyboard --------------------------------------------------------------

  private onKey(ev: KeyboardEvent) {
    if (!this.active) return;
    const mode = this.el.dataset.mode;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.requestEnd();
      return;
    }

    if (mode === 'speaking') {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        ev.stopPropagation();
        this.advance();
      }
      return;
    }

    if (mode !== 'choosing' || !this.plates.length) return;

    // Tab is trapped rather than blocked: the plates are the only things worth
    // reaching while a conversation is up.
    if (ev.key === 'Tab') {
      ev.preventDefault();
      ev.stopPropagation();
      this.focusPlate(this.cursor + (ev.shiftKey ? -1 : 1));
      return;
    }

    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      ev.stopPropagation();
      this.focusPlate(this.cursor + 1);
      this.cb.onSound?.('click-soft');
      return;
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      ev.stopPropagation();
      this.focusPlate(this.cursor - 1);
      this.cb.onSound?.('click-soft');
      return;
    }
    if (ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault();
      ev.stopPropagation();
      this.focusPlate(ev.key === 'Home' ? 0 : this.plates.length - 1);
      return;
    }

    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.stopPropagation();
      this.plates[this.cursor]?.click();
      return;
    }

    const hot = HOTKEYS.indexOf(ev.key);
    if (hot >= 0 && hot < this.plates.length) {
      ev.preventDefault();
      ev.stopPropagation();
      this.focusPlate(hot);
      this.plates[hot].click();
    }
  }

  /**
   * Escape. Deliberately an abort and not the leave plate: a player reaching
   * for the exit key should not then have to sit through a goodbye speech.
   */
  private requestEnd() {
    this.aborted = true;
    this.completeReveal = null;
    if (this.settleChoice) this.settleChoice(null);
    else this.advanceLine?.();
  }

  // -- staging ---------------------------------------------------------------

  /** Loads the portrait and sets everything that is per-character. */
  private async dress(character: Character) {
    this.nameEl.textContent = character.name;
    this.roleEl.textContent = character.role;
    this.el.dataset.side = sideFor(character.id);
    this.el.style.setProperty('--dlg-accent', character.color ?? 'var(--lamp-300)');
    this.el.setAttribute('aria-label', `Conversation with ${character.name}`);

    this.echoEl.textContent = '';
    this.textEl.textContent = '';
    this.liveEl.textContent = '';
    this.speechEl.classList.remove('is-visible', 'has-echo', 'is-ready');
    this.choicesEl.textContent = '';
    this.plates = [];

    // Decode first: a portrait that pops in one frame late reads as a glitch.
    await preload(character.portrait);
    this.face = 0;
    this.faces[0].src = character.portrait;
    this.faces[0].classList.add('is-front');
    this.faces[1].classList.remove('is-front');
    this.faces[1].removeAttribute('src');
    // The name is on the nameplate, so the portrait itself is decoration.
    this.faces[0].alt = '';
  }

  /**
   * Swaps to the first mood the character actually has art for, dissolving
   * between the two face layers. Silently does nothing when the content only
   * ships one portrait, which is the common case.
   */
  private setMood(character: Character, candidates: string[]) {
    const name = candidates.find((m) => character.moods?.[m]);
    const src = name ? character.moods![name] : null;
    if (!src) return;

    const next = this.faces[this.face === 0 ? 1 : 0];
    const current = this.faces[this.face];
    if (next.src.endsWith(src)) return;

    void preload(src).then(() => {
      next.src = src;
      next.classList.add('is-front');
      current.classList.remove('is-front');
      this.face = this.face === 0 ? 1 : 0;
    });
  }

  private open(): Promise<void> {
    this.el.hidden = false;
    this.el.dataset.mode = 'speaking';
    // Reflow so the entrance transition actually runs from its closed state.
    void this.el.offsetHeight;
    this.el.classList.add('is-open');
    this.el.focus({ preventScroll: true });
    return this.wait(reduced() ? 0 : MS_OPEN);
  }

  private async close(): Promise<void> {
    this.el.classList.remove('is-open');
    this.el.classList.add('is-closing');
    await this.wait(reduced() ? 0 : MS_CLOSE);

    this.el.classList.remove('is-closing');
    this.el.dataset.mode = 'idle';
    this.el.hidden = true;
    this.choicesEl.textContent = '';
    this.plates = [];
    this.speechEl.classList.remove('is-visible', 'has-echo', 'is-ready');
    this.active = false;

    // Hand the caret back to whatever the player was using before they talked.
    if (this.restoreFocus?.isConnected) this.restoreFocus.focus({ preventScroll: true });
    this.restoreFocus = null;
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
}

/**
 * Which side of the frame a character stands on. Hashed from the id rather than
 * toggled per conversation: the cast should not all live on the left, but a
 * given suspect must stand in the same place every time you meet them, or the
 * player loses the spatial memory that makes a face recognisable.
 */
function sideFor(id: string): 'left' | 'right' {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? 'left' : 'right';
}

/**
 * The clue a line is gated on, if any. A topic the player can only raise
 * because they are holding evidence gets the glyph — that is the whole tell
 * that they are about to spend something.
 */
function findClue(cond: Condition | undefined): string | null {
  if (!cond) return null;
  switch (cond.kind) {
    case 'hasClue':
      return cond.clue;
    case 'all':
    case 'any':
      for (const c of cond.of) {
        const found = findClue(c);
        if (found) return found;
      }
      return null;
    default:
      // `not` is deliberately not followed: "does not have the clue" is the
      // opposite of presenting it.
      return null;
  }
}
