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
  /**
   * Requests the recorded read of a line, if one exists.
   *
   * Voice-over is an enhancement, never a dependency: only some lines are
   * recorded, so this returns a handle that resolves immediately when there is
   * no audio. The conversation waits for the longer of the text reveal and the
   * audio, and `stop()` lets a player who clicks ahead cut the read off.
   */
  onSpeak?(lineId: string): { done: Promise<void>; stop(): void };
}

/**
 * Mirrors the slug in `tools/build-voice-manifest.mjs`. The two must agree or
 * a recorded line will never be found for its node.
 */
function voiceSlug(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
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
const BACK_LABEL = 'Something else';

/**
 * Sentinels returned by the chooser, so "the player asked to go", "the player
 * backed out of a follow-up thread" and "the player chose a topic" are all the
 * same code path.
 *
 * `BACK_NODE` is not a nicety. A follow-up list whose nodes are all `once:
 * false` never drains, so without an explicit way out the only escape from a
 * repeatable thread would be Escape — which aborts the entire conversation.
 */
const LEAVE_NODE: DialogueNode = { id: '__leave', playerLine: LEAVE_LABEL, reply: '' };
const BACK_NODE: DialogueNode = { id: '__back', playerLine: BACK_LABEL, reply: '' };

/** Moods tried, in order, when a confrontation lands and the art exists. */
const CONFRONT_MOODS = ['angry', 'defensive', 'guarded', 'shaken'];

/** Which tail plate a list gets: the way out, or the way back up a level. */
type Tail = 'leave' | 'back';

/** A reveal in flight. `complete` fills the line now; `cancel` throws it away. */
interface Reveal {
  complete(): void;
  cancel(): void;
}

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
  private echoLineEl!: HTMLElement;
  private textEl!: HTMLElement;
  private liveEl!: HTMLElement;
  private choicesEl!: HTMLElement;
  /** Two stacked faces so a mood change dissolves instead of cutting. */
  private faces!: [HTMLImageElement, HTMLImageElement];
  private face = 0;

  /** True from the first frame of `converse` until the overlay is gone. */
  private active = false;
  private mounted = false;
  private destroyed = false;
  /**
   * Bumped once per conversation. Every async continuation that outlives its
   * own conversation (a mood portrait still decoding when the player walks
   * away) checks it before touching the DOM.
   */
  private epoch = 0;

  /** Non-null only while text is still revealing, so a click completes first. */
  private reveal: Reveal | null = null;
  /** Resolver for the line currently on screen. */
  private advanceLine: (() => void) | null = null;
  /** Resolver for the choice currently being offered. */
  private settleChoice: ((node: DialogueNode | null) => void) | null = null;
  /** Set by Escape: unwinds the whole conversation without the farewell. */
  private aborted = false;

  private plates: HTMLButtonElement[] = [];
  private cursor = 0;
  private restoreFocus: HTMLElement | null = null;
  /**
   * Pending timeouts *with* their payloads. Teardown has to be able to fire
   * them rather than drop them: every one of them is holding a promise that
   * `converse()`'s caller is awaiting, and a dropped timer hangs the game.
   */
  private timers = new Map<number, () => void>();

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
          <div class="dialogue-sheet">
            <p class="dialogue-echo">
              <span class="dialogue-echo-label">You</span>
              <span class="dialogue-echo-line"></span>
            </p>
            <p class="dialogue-text"></p>
            <span class="dialogue-caret" aria-hidden="true"></span>
          </div>
        </div>

        <div class="dialogue-tray">
          <div class="dialogue-choices scrollable" role="menu" aria-label="What to say"></div>
          <p class="dialogue-hint" aria-hidden="true">
            <span>1&ndash;9 choose</span><span>&uarr;&darr; move</span><span>Enter say it</span><span>Esc leave</span>
          </p>
        </div>
      </div>
      <p class="dialogue-live sr-only" role="status" aria-live="polite"></p>`;

    this.nameEl = this.q('.dialogue-name');
    this.roleEl = this.q('.dialogue-role');
    this.speechEl = this.q('.dialogue-speech');
    this.echoLineEl = this.q('.dialogue-echo-line');
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
    if (this.mounted || this.destroyed) return;
    this.mounted = true;
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
    if (this.destroyed) return;
    if (this.active) {
      console.warn(`[dialogue] ignoring re-entrant conversation with ${character.id}`);
      return;
    }

    this.active = true;
    this.aborted = false;
    this.epoch++;
    this.restoreFocus = (document.activeElement as HTMLElement | null) ?? null;

    // Everything from here is wrapped: a presenter that throws mid-conversation
    // must still release the overlay, or every later `talk` is refused as
    // re-entrant and the cast falls permanently silent.
    try {
      await this.dress(character);
      if (this.destroyed) return;
      await this.open();

      this.cb.onSound?.('page-turn');
      await this.speak(lines(tree.greeting), character.name, `greet-${character.id}-a${tree.act}`);
      await this.branch(tree.nodes, tree, character, state, true);

      if (!this.aborted && !this.destroyed && tree.farewell) {
        await this.speak(lines(tree.farewell), character.name);
      }

      if (!this.destroyed) this.cb.onSound?.('latch');
    } finally {
      this.active = false;
      await this.close();
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.mounted = false;
    window.removeEventListener('keydown', this.onKey, true);

    this.reveal?.cancel();
    this.reveal = null;
    this.active = false;
    this.aborted = true;

    // Settle anything still awaiting us, then flush the timers those settlers
    // just scheduled, so a teardown can never hang a caller.
    this.settleChoice?.(null);
    this.advanceLine?.();
    this.flushTimers();

    this.el.remove();
  }

  // -- conversation flow -----------------------------------------------------

  /**
   * Walks one list of nodes. The root list loops until the player leaves; a
   * child list returns to its caller as soon as it runs dry or the player asks
   * for something else, which is what makes a follow-up thread fall back to the
   * main topics.
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
        await this.offer([], state, 'leave');
        return;
      }

      const chosen = await this.offer(available, state, root ? 'leave' : 'back');
      if (!chosen || chosen === LEAVE_NODE || chosen === BACK_NODE) return;

      this.showEcho(chosen.playerLine);
      // Effects first, per the content contract: a node may hand over a clue
      // or set a flag that its own reply then refers to as already true.
      await state.run(chosen.effects);
      state.usedDialogueNodes.add(chosen.id);
      state.notify();

      if (chosen.isConfrontation) this.setMood(character, CONFRONT_MOODS);
      if (this.aborted || !this.active) return;

      await this.speak(lines(chosen.reply), character.name, `line-${voiceSlug(chosen.id)}`);

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

  /**
   * Reveals each line in turn, waiting for the player between them. Blank lines
   * are dropped rather than shown: a node that exists only to fire effects
   * should not cost the player a click on an empty sheet of paper.
   */
  private async speak(text: string[], speaker: string, voiceLineId?: string) {
    // The recording covers the whole speech, so it starts with the first line
    // and plays underneath any that follow.
    const vo = voiceLineId ? this.cb.onSpeak?.(voiceLineId) : undefined;

    try {
      for (const line of text) {
        if (this.aborted || !this.active || this.destroyed) return;
        if (!line.trim()) continue;
        await this.speakLine(line, speaker);
      }
      // Hold on the last line until the read finishes, so the player is not
      // staring at a finished panel while a voice is still talking.
      if (vo && !this.aborted && !this.destroyed) await vo.done;
    } finally {
      vo?.stop();
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
        // Abandoning a half-typed line has to stop the loop that is typing it,
        // or the text keeps arriving over the top of the closing animation.
        this.reveal?.cancel();
        this.reveal = null;
        this.speechEl.classList.remove('is-ready');
        resolve();
      };

      this.reveal = this.typewrite(line, () => {
        this.reveal = null;
        this.speechEl.classList.add('is-ready');
      });
      this.advanceLine = done;
    });
  }

  /** The chosen line, kept above the reply so the exchange reads as a pair. */
  private showEcho(playerLine: string) {
    this.echoLineEl.textContent = playerLine;
    this.speechEl.classList.add('has-echo');
    // The paper panel is aria-hidden (the live region speaks for it), so the
    // player's own line has to be announced here or it is never heard at all.
    this.liveEl.textContent = `You: ${playerLine}`;
  }

  /** First input completes the reveal; the next one moves on. */
  private advance() {
    if (this.reveal) {
      // `complete` runs the done callback, which clears `this.reveal` for us.
      this.reveal.complete();
      return;
    }
    this.advanceLine?.();
  }

  /**
   * Reveals text character by character into the speech panel. Returns a handle
   * that can finish the reveal immediately — the "click to finish the line"
   * affordance every adventure game needs — or throw it away unfinished.
   *
   * Returns `null` when there is nothing to reveal, which is what tells
   * {@link DialogueView.advance} that the very first press should advance
   * rather than being swallowed completing an already-complete line.
   */
  private typewrite(text: string, onDone: () => void): Reveal | null {
    if (reduced()) {
      this.textEl.textContent = text;
      onDone();
      return null;
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

    return {
      complete: () => {
        cancelAnimationFrame(raf);
        this.textEl.textContent = text;
        onDone();
      },
      cancel: () => {
        cancelAnimationFrame(raf);
      },
    };
  }

  // -- choices ---------------------------------------------------------------

  /**
   * Deals out the choice plates and waits. Resolves with the chosen node, with
   * {@link LEAVE_NODE} / {@link BACK_NODE} for the tail plate, or `null` when
   * the player escaped out.
   */
  private offer(
    nodes: DialogueNode[],
    state: GameState,
    tail: Tail,
  ): Promise<DialogueNode | null> {
    return new Promise((resolve) => {
      this.choicesEl.textContent = '';
      this.choicesEl.classList.remove('is-spent');
      this.plates = [];
      this.cursor = 0;
      this.el.dataset.mode = 'choosing';

      const settle = (node: DialogueNode | null) => {
        if (!this.settleChoice) return;
        this.settleChoice = null;
        // Spent, not `disabled`: disabling the focused button blurs it, and the
        // caret would land back on <body> for the whole of the reply.
        this.choicesEl.classList.add('is-spent');
        for (const p of this.plates) {
          p.setAttribute('aria-disabled', 'true');
          p.classList.remove('is-cursor');
        }
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

      const tailNode = tail === 'leave' ? LEAVE_NODE : BACK_NODE;
      const plate = this.buildPlate({
        index: nodes.length,
        label: tailNode.playerLine,
        kind: 'leave',
        clue: null,
        pick: () => {
          this.cb.onSound?.('click-soft');
          plate.classList.add('is-chosen');
          settle(tailNode);
        },
      });

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
    // Under reduced motion the stagger is travel like any other: nine plates at
    // 55ms apart is half a second of movement for someone who asked for none.
    if (!reduced()) plate.style.setProperty('--plate-delay', `${opts.index * MS_PLATE_STAGGER}ms`);

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
    if (key) plate.setAttribute('aria-keyshortcuts', key);
    if (opts.clue) plate.title = `Presents evidence: ${opts.clue}`;

    const index = this.plates.length;
    plate.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (plate.getAttribute('aria-disabled') === 'true') return;
      opts.pick();
    });
    plate.addEventListener('pointerenter', (ev) => {
      // A touch "enters" the element it is about to activate. Following that
      // would move the cursor and fire a hover cue on every tap.
      if (ev.pointerType !== 'mouse') return;
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
    if (move) {
      this.plates[i].focus({ preventScroll: true });
      // The stack scrolls; keep the cursor inside the visible run of it.
      this.plates[i].scrollIntoView({ block: 'nearest' });
    }
  }

  // -- keyboard --------------------------------------------------------------

  private onKey(ev: KeyboardEvent) {
    if (!this.active || this.destroyed) return;
    const mode = this.el.dataset.mode;
    // `busy` means a node's own effects are on screen — narration, a toast, a
    // cinematic. Those own the keyboard until they are done with it.
    if (mode !== 'speaking' && mode !== 'choosing') return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.requestEnd();
      return;
    }

    // Tab is trapped rather than blocked: while a conversation is up, the
    // plates are the only things in the document worth reaching.
    if (ev.key === 'Tab') {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.plates.length) this.focusPlate(this.cursor + (ev.shiftKey ? -1 : 1));
      return;
    }

    if (mode === 'speaking') {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        ev.stopPropagation();
        this.advance();
        return;
      }
      this.swallow(ev);
      return;
    }

    if (!this.plates.length) return;

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
      return;
    }

    this.swallow(ev);
  }

  /**
   * Eats a key the conversation does not itself use.
   *
   * The global bindings in `game.ts` are guarded by its own `busy` flag, which
   * a `talk` reached from anywhere but a hotspot does not set. Without this, J
   * would open the journal on top of a conversation and L would flash the
   * hotspots of a room nobody is looking at. Modified keys are left alone so
   * the browser's own shortcuts keep working.
   */
  private swallow(ev: KeyboardEvent) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key.length !== 1) return;
    ev.stopPropagation();
  }

  /**
   * Escape. Deliberately an abort and not the leave plate: a player reaching
   * for the exit key should not then have to sit through a goodbye speech.
   */
  private requestEnd() {
    this.aborted = true;
    this.reveal?.cancel();
    this.reveal = null;
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

    this.echoLineEl.textContent = '';
    this.textEl.textContent = '';
    this.liveEl.textContent = '';
    this.speechEl.classList.remove('is-visible', 'has-echo', 'is-ready');
    this.choicesEl.textContent = '';
    this.choicesEl.classList.remove('is-spent');
    this.plates = [];

    // Decode first: a portrait that pops in one frame late reads as a glitch.
    const epoch = this.epoch;
    await preload(character.portrait);
    if (this.destroyed || this.epoch !== epoch) return;

    this.face = 0;
    this.faces[0].src = character.portrait;
    // The resolved `.src` is absolute, so remember the content path verbatim —
    // it is the only reliable way to tell "already showing this mood".
    this.faces[0].dataset.src = character.portrait;
    this.faces[0].classList.add('is-front');
    this.faces[1].classList.remove('is-front');
    this.faces[1].removeAttribute('src');
    delete this.faces[1].dataset.src;
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

    const current = this.faces[this.face];
    if (current.dataset.src === src) return;

    const next = this.faces[this.face === 0 ? 1 : 0];
    // A large portrait can still be decoding when the player walks out of the
    // conversation; the epoch keeps it from redressing the next one.
    const epoch = this.epoch;
    void preload(src).then(() => {
      if (this.destroyed || this.epoch !== epoch) return;
      next.src = src;
      next.dataset.src = src;
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
    if (!this.destroyed) {
      this.el.classList.remove('is-open');
      this.el.classList.add('is-closing');
      await this.wait(reduced() ? 0 : MS_CLOSE);
      this.el.classList.remove('is-closing');
      this.el.hidden = true;
    }

    this.el.dataset.mode = 'idle';
    this.choicesEl.textContent = '';
    this.choicesEl.classList.remove('is-spent');
    this.plates = [];
    this.speechEl.classList.remove('is-visible', 'has-echo', 'is-ready');

    // Hand the caret back to whatever the player was using before they talked.
    const back = this.restoreFocus;
    this.restoreFocus = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
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
    this.timers.set(id, fn);
  }

  /**
   * Fires every pending timer at once instead of cancelling it. Only teardown
   * uses this: each pending callback is holding a promise `converse()`'s caller
   * is awaiting, and dropping one would leave the HUD hidden forever.
   */
  private flushTimers() {
    const pending = [...this.timers];
    this.timers.clear();
    for (const [id, fn] of pending) {
      clearTimeout(id);
      fn();
    }
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
