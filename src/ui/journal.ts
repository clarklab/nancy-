/**
 * The case journal — the notebook the player actually lives inside.
 *
 * Everything the detective knows is here, and it is the panel they will open
 * more than any other, so it is modelled as an object rather than a dialog: a
 * leather-bound book that swings open on its spine, two aged pages with a
 * gutter down the middle, and leather index tabs stitched down the outside
 * edge. The chrome is deliberately physical because the journal is where the
 * player *thinks*, and a thinking tool has to feel like it can be picked up.
 *
 * The module owns its DOM subtree and nothing else. It reads `GameState`
 * directly (it is a view of the case file, not a copy of it) and writes back
 * only through two documented channels — `state.accusations` for pinned
 * evidence and `accuse.*` flags for the charge each pin argues — so a save
 * round-trips the deduction board without the engine knowing this file exists.
 * Sound is a callback rather than an import so the journal stays testable and
 * the audio engine stays swappable.
 *
 * Rendering is wholesale: every refresh rebuilds the live page's markup. That
 * is cheap enough at this scale and it removes a whole class of diffing bugs,
 * but it means the three things a rebuild would otherwise destroy — scroll
 * position, keyboard focus, and a clue held in hand — are captured before the
 * wipe and restored after it. Anything that must survive a rebuild lives in a
 * field on this class, never in the DOM.
 */

import type { GameState } from '@/engine/state';
import type { Character, CharacterId, Clue, ClueId, SceneId } from '@/engine/types';

/** The five sections, in tab order down the fore edge. */
export type JournalTab = 'case' | 'clues' | 'people' | 'deduction' | 'map';

export interface JournalCallbacks {
  /**
   * Named SFX request. The journal never imports the audio engine: the
   * integration layer decides whether a page turn is audible at all.
   */
  onSound?(name: string): void;
  /**
   * Fired when a map node is chosen. Optional — while no travel rules exist
   * the map is a reference sheet, and clicking a node is inert by design.
   */
  onFastTravel?(scene: SceneId): void;
}

/**
 * What a pinned clue is arguing about a suspect. Stored as three mutually
 * exclusive `accuse.<suspect>.<clue>.<charge>` flags rather than baked into
 * `state.accusations`, because that field's contract is a plain list of clue
 * ids and any consumer must be able to resolve every entry against content.
 */
const CHARGES = ['means', 'motive', 'opportunity'] as const;
type Charge = (typeof CHARGES)[number];

const TAB_DEFS: { id: JournalTab; label: string; hint: string }[] = [
  { id: 'case', label: 'Case', hint: 'Current objective and open tasks' },
  { id: 'clues', label: 'Clues', hint: 'Every clue recorded so far' },
  { id: 'people', label: 'People', hint: 'Everyone you have met' },
  { id: 'deduction', label: 'Deduction', hint: 'Pin evidence to suspects' },
  { id: 'map', label: 'Map', hint: 'Places you have been' },
];

const CLUE_GROUPS: { id: Clue['category']; title: string; blurb: string }[] = [
  { id: 'testimony', title: 'Testimony', blurb: 'What people said — and what they avoided saying.' },
  { id: 'physical', title: 'Physical', blurb: 'Things with weight. Things that had to be carried.' },
  { id: 'document', title: 'Documents', blurb: 'Paper remembers what people would rather forget.' },
  { id: 'observation', title: 'Observations', blurb: 'What was simply, quietly true of the room.' },
];

/**
 * Pointer travel, in CSS pixels, before a press on an evidence card stops
 * being a click and becomes a drag. Without a threshold every click on the
 * board spawns a ghost that immediately flies home, which reads as a glitch;
 * with one, click-to-pick-up and drag-to-pin are the same gesture at two
 * speeds. It is geometry, not motion design, so it is a literal here.
 */
const DRAG_SLOP = 5;

/**
 * Backstop for tearing down a drag ghost. The ghost normally retires on its
 * own `transitionend`/`animationend`; this only fires if the browser drops
 * that event (a background tab, an interrupted compositor animation) and is
 * deliberately far longer than any token duration so it never pre-empts one.
 */
const GHOST_MAX_MS = 1400;

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Widest the map grid is allowed to get before it starts a new row. */
const MAP_MAX_COLS = 5;

/** A live pointer on the deduction board — a press that may become a drag. */
interface PointerCarry {
  id: number;
  clueId: ClueId;
  source: HTMLElement;
  startX: number;
  startY: number;
  /** Null until the press passes `DRAG_SLOP` and actually lifts a card. */
  ghost: HTMLElement | null;
  dx: number;
  dy: number;
  band: HTMLElement | null;
}

/**
 * The player's case file. Construct once per session, `mount` it into the
 * overlay root, and drive it with `open` / `close` / `refresh`.
 */
export class Journal {
  readonly el: HTMLElement;

  private state: GameState;
  private cb: JournalCallbacks;

  private bookEl!: HTMLElement;
  private tabsEl!: HTMLElement;
  private panelEl!: HTMLElement;
  private statusEl!: HTMLElement;

  private tab: JournalTab = 'case';
  /** Which tab the live DOM belongs to, so only a real page change washes. */
  private renderedTab: JournalTab | null = null;
  private opened = false;
  private destroyed = false;

  /** Where focus came from, so closing the book puts it back. */
  private invoker: HTMLElement | null = null;

  private unsubscribe: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private timers = new Set<number>();
  private renderQueued = false;
  private overlaysQueued = false;
  /** A refresh that arrived mid-drag and still owes the player a repaint. */
  private renderDeferred = false;
  /** Re-entrancy guard: rendering can touch state, which notifies listeners. */
  private rendering = false;

  /**
   * Clues that were unread when this visit to the CLUES tab began. The badge
   * clears the instant the tab opens (the player *is* reading them), but the
   * wax seals stay on screen for the rest of the visit so they can actually
   * find the new material.
   */
  private freshClues = new Set<ClueId>();

  /** Tasks whose strike-through has already been drawn, so it draws only once. */
  private struckTasks = new Set<string>();

  /**
   * Pins the board has already shown landing, keyed `suspect|clue`. Without
   * this every unrelated state change would re-play the thunk on every chip,
   * because a refresh rebuilds the whole column.
   */
  private seenPins = new Set<string>();

  /**
   * Scroll offset per scroller per tab, keyed `<tab>:<data-scroll>`. The
   * deduction board has two independent scrollers, so a single number would
   * silently reset one of them on every repaint.
   */
  private scrollMemory = new Map<string, number>();

  private ptr: PointerCarry | null = null;

  /** Keyboard/click carry: a clue held, waiting for a destination. */
  private carrying: ClueId | null = null;

  constructor(state: GameState, cb: JournalCallbacks = {}) {
    this.state = state;
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.className = 'journal';
    this.el.innerHTML = TEMPLATE;
    // Closed, the journal is not merely invisible: it must not take the
    // pointer from the scene nor appear in the tab order.
    this.el.inert = true;

    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.bookEl = q('.journal__book');
    this.tabsEl = q('.journal__tabs');
    this.panelEl = q('.journal__panel');
    this.statusEl = q('.journal__status');

    this.buildTabs();

    this.el.addEventListener('keydown', this.onKeyDown);
    this.bookEl.addEventListener('transitionend', this.onBookSettled);
    this.el.querySelector('.journal__scrim')!.addEventListener('click', () => this.close());
    q('.journal__close').addEventListener('click', () => this.close());
    this.tabsEl.addEventListener('click', this.onTabClick);
    this.tabsEl.addEventListener('keydown', this.onTabKeyDown);
    this.panelEl.addEventListener('click', this.onPanelClick);
    this.panelEl.addEventListener('keydown', this.onPanelKeyDown);
    this.panelEl.addEventListener('pointerdown', this.onPanelPointerDown);
    this.panelEl.addEventListener('scroll', this.onPanelScroll, { capture: true });
  }

  // -- lifecycle -------------------------------------------------------------

  /** Attaches the journal (closed) and starts tracking state. */
  mount(parent: HTMLElement) {
    parent.appendChild(this.el);
    // Mounting twice would stack subscriptions and observers; the engine only
    // does it once, but a leaked listener here would survive `destroy`.
    if (this.unsubscribe) return;
    this.unsubscribe = this.state.subscribe(() => this.refresh());

    // Strings and ink routes are measured in pixels, so any change to the
    // book's size invalidates them.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.queueOverlays());
      this.resizeObserver.observe(this.bookEl);
    }
  }

  destroy() {
    this.destroyed = true;
    this.releasePointer(null);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.el.remove();
  }

  // -- public surface --------------------------------------------------------

  get isOpen(): boolean {
    return this.opened;
  }

  /**
   * Opens the book, optionally straight to a section. Re-opening an already
   * open journal on a different tab turns the page rather than re-swinging,
   * which is what makes the HUD shortcut keys feel like tabs and not toggles.
   */
  open(tab?: JournalTab) {
    if (this.destroyed) return;
    const wanted = tab && TAB_DEFS.some((t) => t.id === tab) ? tab : this.tab;

    if (this.opened) {
      if (wanted !== this.tab) this.setTab(wanted);
      return;
    }

    this.invoker = document.activeElement as HTMLElement | null;
    this.opened = true;
    this.tab = wanted;
    this.el.inert = false;
    this.el.classList.add('is-open');
    this.syncTabs();
    this.render();
    this.sound('page-turn');

    // Focus the live tab, so the arrow keys are immediately meaningful.
    this.activeTabButton()?.focus();
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.releasePointer(null);
    this.setCarrying(null);
    this.freshClues.clear();
    // The next open should read as a fresh page, not a resumed one.
    this.renderedTab = null;
    this.el.classList.remove('is-open');
    // `inert` before the swing finishes: the book is on its way shut and must
    // not answer another click on the way.
    this.el.inert = true;
    this.sound('latch');

    const back = this.invoker;
    this.invoker = null;
    if (back && back.isConnected) back.focus();
  }

  /**
   * Re-reads state. Coalesced to one paint because the engine notifies both
   * this module and the integration layer for a single effect, and a full
   * re-render of the deduction board is not free.
   */
  refresh() {
    if (this.destroyed || !this.opened || this.rendering) return;
    if (this.ptr) {
      // Never rebuild under a live pointer: the card being pressed would be
      // replaced by a fresh node and the drag would follow a detached ghost.
      // Remember the debt instead and settle it when the pointer lets go.
      this.renderDeferred = true;
      return;
    }
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (this.destroyed || !this.opened) return;
      if (this.ptr) {
        this.renderDeferred = true;
        return;
      }
      this.render();
    });
  }

  // -- tabs ------------------------------------------------------------------

  private buildTabs() {
    for (const def of TAB_DEFS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'journal-tab';
      btn.id = `journal-tab-${def.id}`;
      btn.dataset.tab = def.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', 'journal-panel');
      btn.setAttribute('aria-selected', 'false');
      btn.title = def.hint;
      btn.tabIndex = -1;
      btn.innerHTML =
        `<span class="journal-tab__face"><span class="journal-tab__label">${escapeHtml(def.label)}</span></span>` +
        '<span class="journal-tab__pip" aria-hidden="true"></span>';
      this.tabsEl.appendChild(btn);
    }
    this.syncTabs();
  }

  private syncTabs() {
    for (const btn of this.tabButtons()) {
      const on = btn.dataset.tab === this.tab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    }
    this.panelEl.setAttribute('aria-labelledby', `journal-tab-${this.tab}`);
  }

  private setTab(tab: JournalTab, focusTab = false) {
    if (tab === this.tab) return;
    this.rememberScroll();
    this.releasePointer(null);
    this.setCarrying(null);
    if (this.tab === 'clues') this.freshClues.clear();
    this.tab = tab;
    this.syncTabs();
    this.render();
    this.sound('page-turn');
    if (focusTab) this.activeTabButton()?.focus();
  }

  private tabButtons(): HTMLButtonElement[] {
    return [...this.tabsEl.querySelectorAll<HTMLButtonElement>('.journal-tab')];
  }

  private activeTabButton(): HTMLButtonElement | null {
    return this.tabsEl.querySelector<HTMLButtonElement>('.journal-tab.is-active');
  }

  private onTabClick = (ev: Event) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (btn) this.setTab(btn.dataset.tab as JournalTab, true);
  };

  private onTabKeyDown = (ev: KeyboardEvent) => {
    const tabs = this.tabButtons();
    const at = tabs.findIndex((t) => t === document.activeElement);
    let next = -1;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') next = (Math.max(at, 0) + 1) % tabs.length;
    else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft')
      next = (Math.max(at, 0) - 1 + tabs.length) % tabs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = tabs.length - 1;
    else return;

    ev.preventDefault();
    ev.stopPropagation();
    // Follow-focus tabs: the page turns as you arrow, the way a thumb-index
    // works on a real notebook.
    this.setTab(tabs[next]!.dataset.tab as JournalTab, true);
  };

  // -- keyboard --------------------------------------------------------------

  private onKeyDown = (ev: KeyboardEvent) => {
    if (!this.opened) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      // Escape peels one layer at a time: put the carried clue down first,
      // shut the book only if the player's hands are empty.
      if (this.ptr) this.releasePointer(null);
      else if (this.carrying) this.setCarrying(null);
      else this.close();
      return;
    }

    if (ev.key === 'PageDown' || ev.key === 'PageUp') {
      const tabs = TAB_DEFS.map((t) => t.id);
      const at = tabs.indexOf(this.tab);
      const step = ev.key === 'PageDown' ? 1 : -1;
      ev.preventDefault();
      ev.stopPropagation();
      this.setTab(tabs[(at + step + tabs.length) % tabs.length]!, true);
      return;
    }

    if (ev.key === 'Tab') this.trapTab(ev);
  };

  /**
   * Everything inside the book that is genuinely reachable by Tab right now.
   * `tabIndex >= 0` is the load-bearing filter: the tab strip uses a roving
   * tabindex and the drop plates are only tabbable while a clue is in hand,
   * so a plain `button` selector would trap focus against elements the
   * browser will never actually stop on.
   */
  private focusables(): HTMLElement[] {
    const nodes = this.bookEl.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    );
    return [...nodes].filter(
      (n) =>
        !n.hasAttribute('disabled') &&
        n.tabIndex >= 0 &&
        (n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement),
    );
  }

  /** Keeps focus inside the open book — a modal surface owns the keyboard. */
  private trapTab(ev: KeyboardEvent) {
    const focusables = this.focusables();
    if (!focusables.length) return;

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (ev.shiftKey && (active === first || !this.bookEl.contains(active))) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (active === last || !this.bookEl.contains(active))) {
      ev.preventDefault();
      first.focus();
    }
  }

  // -- rendering -------------------------------------------------------------

  private render() {
    this.rendering = true;
    this.renderDeferred = false;
    const turned = this.renderedTab !== this.tab;
    const focus = this.focusKey();

    if (this.tab === 'clues') this.claimUnreadClues();
    // A clue can be revoked by an effect while the board is open; a hand
    // holding something that no longer exists would never be able to put it
    // down.
    if (this.carrying && !this.state.clues.has(this.carrying)) this.carrying = null;

    this.panelEl.dataset.tab = this.tab;
    this.panelEl.innerHTML = this.markupFor(this.tab);
    this.renderedTab = this.tab;
    wireArt(this.panelEl);

    // Restart the page-turn wash only for an actual page change: replaying it
    // whenever an unrelated effect fires would strobe the whole spread.
    if (turned) {
      this.panelEl.classList.remove('is-turning');
      void this.panelEl.offsetWidth;
      this.panelEl.classList.add('is-turning');
    }

    this.restoreScroll();
    this.syncCarrying();
    this.restoreFocus(focus);

    this.rendering = false;

    requestAnimationFrame(() => {
      if (this.destroyed || !this.opened) return;
      this.settleTasks();
      this.layoutOverlays();
    });
  }

  private markupFor(tab: JournalTab): string {
    switch (tab) {
      case 'case':
        return this.caseMarkup();
      case 'clues':
        return this.cluesMarkup();
      case 'people':
        return this.peopleMarkup();
      case 'deduction':
        return this.deductionMarkup();
      case 'map':
        return this.mapMarkup();
      default: {
        const _never: never = tab;
        void _never;
        return '';
      }
    }
  }

  // -- CASE ------------------------------------------------------------------

  private caseMarkup(): string {
    const act = (this.state.content.acts ?? []).find((a) => a.number === this.state.act);
    const tasks = this.state.tasks ?? [];
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);

    const item = (t: { id: string; text: string; done: boolean }) =>
      `<li class="task${t.done && this.struckTasks.has(t.id) ? ' is-done' : ''}" data-task="${escapeHtml(t.id)}" data-done="${t.done}">
         <span class="task__box" aria-hidden="true">${CHECKBOX}</span>
         <span class="task__text">${escapeHtml(t.text)}<span class="task__strike" aria-hidden="true"></span></span>
         ${t.done ? '<span class="sr-only"> — done</span>' : ''}
       </li>`;

    const list = tasks.length
      ? `<ul class="task-list" role="list">${[...open, ...done].map(item).join('')}</ul>`
      : this.emptyState('No standing orders', 'Nothing is asked of you yet. Go and be curious.');

    return `
      <div class="journal-spread journal-spread--prose">
        <section class="jp-col scrollable" data-scroll="left" aria-label="The case">
          <p class="jp-kicker">Act ${escapeHtml(roman(this.state.act))}</p>
          <h3 class="jp-title">${escapeHtml(act?.title ?? 'The case so far')}</h3>
          ${act?.epigraph ? `<p class="jp-epigraph">${escapeHtml(act.epigraph)}</p>` : ''}
          <p class="jp-lede">${escapeHtml(act?.goal ?? 'You are still working out what you are looking at.')}</p>
          <dl class="case-stats">
            <div class="case-stat"><dt>Clues recorded</dt><dd>${this.state.clues.size}</dd></div>
            <div class="case-stat"><dt>Places seen</dt><dd>${this.state.visitedScenes.size}</dd></div>
            <div class="case-stat"><dt>Puzzles solved</dt><dd>${this.state.solvedPuzzles.size}</dd></div>
          </dl>
        </section>
        <section class="jp-col scrollable" data-scroll="right" aria-label="Open tasks">
          <p class="jp-kicker">To do</p>
          ${list}
        </section>
      </div>`;
  }

  /**
   * Adds `is-done` a frame after the list exists so the ink line has something
   * to transition from; tasks already struck on a previous visit are rendered
   * struck and never animate again.
   */
  private settleTasks() {
    for (const li of this.panelEl.querySelectorAll<HTMLElement>('.task[data-done="true"]')) {
      const id = li.dataset.task!;
      if (this.struckTasks.has(id)) continue;
      this.struckTasks.add(id);
      li.classList.add('is-done');
    }
  }

  // -- CLUES -----------------------------------------------------------------

  /** The badge is the player's unread count; opening the tab *is* reading. */
  private claimUnreadClues() {
    if (!this.state.unreadClues.size) return;
    for (const id of this.state.unreadClues) this.freshClues.add(id);
    this.state.unreadClues.clear();
    // Notify out of band. We are mid-render, and the HUD badge and the
    // autosave both hang off `notify`; running them synchronously here would
    // re-enter this very function with a half-written panel.
    queueMicrotask(() => {
      if (!this.destroyed) this.state.notify();
    });
  }

  private ownedClues(): Clue[] {
    const all = this.state.content.clues ?? {};
    return [...this.state.clues]
      .map((id) => all[id] ?? placeholderClue(id))
      .sort((a, b) => a.act - b.act || a.name.localeCompare(b.name));
  }

  private cluesMarkup(): string {
    const clues = this.ownedClues();
    if (!clues.length) {
      return this.spread(
        this.emptyState(
          'The file is empty',
          'Every case starts here. Look at things twice; the second look is the one that pays.',
        ),
      );
    }

    const sections = CLUE_GROUPS.map((group) => {
      const inGroup = clues.filter((c) => c.category === group.id);
      if (!inGroup.length) return '';
      return `
        <section class="clue-group" aria-label="${escapeHtml(group.title)}">
          <header class="clue-group__head">
            <h4 class="clue-group__title">${escapeHtml(group.title)}</h4>
            <p class="clue-group__blurb">${escapeHtml(group.blurb)}</p>
            <span class="clue-group__count" aria-hidden="true">${inGroup.length}</span>
          </header>
          <div class="clue-grid">${inGroup.map((c) => this.clueCard(c)).join('')}</div>
        </section>`;
    }).join('');

    return this.spread(sections);
  }

  private clueCard(clue: Clue): string {
    const fresh = this.freshClues.has(clue.id);
    return `
      <article class="clue-card${fresh ? ' is-fresh' : ''}" style="--tilt:${tiltOf(clue.id)}deg">
        <span class="clue-card__pin" aria-hidden="true"></span>
        <h5 class="clue-card__name">${escapeHtml(clue.name)}</h5>
        <p class="clue-card__summary">${escapeHtml(clue.summary)}</p>
        <footer class="clue-card__foot">
          <span class="clue-card__act">Act ${escapeHtml(roman(clue.act))}</span>
        </footer>
        ${
          fresh
            ? '<span class="wax-seal" role="img" aria-label="New clue"><span class="wax-seal__mark" aria-hidden="true">N</span></span>'
            : ''
        }
      </article>`;
  }

  // -- PEOPLE ----------------------------------------------------------------

  /** Met is a flag, not an inference: content decides when someone counts. */
  private metCharacters(): Character[] {
    const all = this.state.content.characters ?? {};
    return Object.values(all).filter((c) => this.state.flags[`met.${c.id}`]);
  }

  private peopleMarkup(): string {
    const people = this.metCharacters();
    if (!people.length) {
      return this.spread(
        this.emptyState(
          'No one yet',
          'You have not spoken to a soul. That is going to have to change.',
        ),
      );
    }

    const clues = this.ownedClues();
    const cards = people
      .map((p) => {
        const bearing = clues.filter((c) => c.bearsOn?.includes(p.id));
        const chips = bearing.length
          ? `<ul class="person-card__clues" role="list">${bearing
              .map((c) => `<li class="ink-chip">${escapeHtml(c.name)}</li>`)
              .join('')}</ul>`
          : '<p class="person-card__none">Nothing in the file bears on them.</p>';
        const accent = safeColor(p.color);
        return `
          <article class="person-card" style="--tilt:${tiltOf(p.id)}deg">
            <div class="person-card__plate">
              <span class="person-card__portrait">${portraitFor(p)}</span>
            </div>
            <div class="person-card__body">
              <h4 class="person-card__name"${accent ? ` style="--accent-person:${accent}"` : ''}>${escapeHtml(p.name)}</h4>
              <p class="person-card__role">${escapeHtml(p.role)}</p>
              <p class="person-card__bio">${escapeHtml(p.bio)}</p>
              <p class="person-card__label">Bears on</p>
              ${chips}
            </div>
          </article>`;
      })
      .join('');

    return this.spread(`<div class="person-grid">${cards}</div>`);
  }

  // -- DEDUCTION -------------------------------------------------------------

  /**
   * The suspect pool. Anyone met is a candidate — the board is the player's
   * private theory, not the game's judgement — but if content has not set the
   * `met.*` flags yet we fall back to whoever the owned clues point at, so the
   * board is never blank while a sibling workflow is still writing story data.
   */
  private suspects(clues: Clue[]): Character[] {
    const met = this.metCharacters();
    if (met.length) return met;

    const all = this.state.content.characters ?? {};
    const ids = new Set<CharacterId>();
    for (const clue of clues) for (const id of clue.bearsOn ?? []) ids.add(id);
    return [...ids].map((id) => all[id]).filter((c): c is Character => !!c);
  }

  private deductionMarkup(): string {
    const clues = this.ownedClues();
    const suspects = this.suspects(clues);

    if (!clues.length || !suspects.length) {
      return this.spread(
        this.emptyState(
          'The board is bare',
          !clues.length
            ? 'Find something worth pinning up, then come back and make it mean something.'
            : 'Meet someone worth accusing first. Theories need a defendant.',
        ),
      );
    }

    const tray = clues
      .map((c) => {
        const pinned = suspects.some((s) => (this.state.accusations[s.id] ?? []).includes(c.id));
        const id = escapeHtml(c.id);
        return `
          <button type="button" class="ded-card${pinned ? ' is-pinned' : ''}"
                  data-clue="${id}" data-fk="card:${id}" style="--tilt:${tiltOf(c.id)}deg"
                  aria-pressed="false" aria-describedby="journal-ded-hint"
                  aria-label="${escapeHtml(c.name)}. ${escapeHtml(c.category)}.${pinned ? ' Already pinned.' : ''}">
            <span class="ded-card__pin" aria-hidden="true"></span>
            <span class="ded-card__name">${escapeHtml(c.name)}</span>
            <span class="ded-card__cat">${escapeHtml(c.category)}</span>
          </button>`;
      })
      .join('');

    const columns = suspects.map((s) => this.suspectColumn(s)).join('');

    return `
      <div class="ded" role="group" aria-label="Deduction board">
        <div class="ded__board">
          <section class="ded__tray" aria-label="Evidence">
            <p class="jp-kicker jp-kicker--cork">Evidence</p>
            <div class="ded__tray-scroll scrollable" data-scroll="tray">${tray}</div>
            <p class="ded__hint" id="journal-ded-hint">
              Drag a card onto a suspect — or press Enter to pick it up.
            </p>
          </section>
          <section class="ded__suspects scrollable" data-scroll="suspects" aria-label="Suspects">${columns}</section>
          <svg class="ded__strings" aria-hidden="true" focusable="false"></svg>
        </div>
      </div>`;
  }

  private suspectColumn(s: Character): string {
    const pinned = this.state.accusations[s.id] ?? [];
    const all = this.state.content.clues ?? {};
    const bands = CHARGES.map((charge) => {
      const chips = pinned
        .filter((id) => this.chargeOf(s.id, id) === charge)
        .map((id) => {
          const name = all[id]?.name ?? id;
          const key = pinKey(s.id, id);
          const fresh = !this.seenPins.has(key);
          this.seenPins.add(key);
          return `
            <span class="ded-chip${fresh ? ' is-new' : ''}" data-clue="${escapeHtml(id)}">
              <span class="ded-chip__name">${escapeHtml(name)}</span>
              <button type="button" class="ded-chip__unpin" data-unpin="${escapeHtml(id)}"
                      data-suspect="${escapeHtml(s.id)}" data-fk="unpin:${escapeHtml(s.id)}:${escapeHtml(id)}"
                      aria-label="Unpin ${escapeHtml(name)} from ${escapeHtml(s.name)}">
                <span aria-hidden="true">×</span>
              </button>
            </span>`;
        })
        .join('');
      return `
        <div class="ded-band" data-suspect="${escapeHtml(s.id)}" data-charge="${charge}">
          <span class="ded-band__label">${charge}</span>
          <div class="ded-band__chips">${chips || '<span class="ded-band__empty" aria-hidden="true">—</span>'}</div>
          <button type="button" class="ded-band__drop" data-drop-suspect="${escapeHtml(s.id)}"
                  data-drop-charge="${charge}" data-fk="drop:${escapeHtml(s.id)}:${charge}" tabindex="-1"
                  aria-label="Pin the carried clue to ${escapeHtml(s.name)} as ${charge}">Pin here</button>
        </div>`;
    }).join('');

    return `
      <article class="ded-suspect" data-suspect="${escapeHtml(s.id)}">
        <header class="ded-suspect__head">
          <span class="ded-suspect__pin" aria-hidden="true"></span>
          <span class="ded-suspect__portrait">${portraitFor(s)}</span>
          <span class="ded-suspect__id">
            <span class="ded-suspect__name">${escapeHtml(s.name)}</span>
            <span class="ded-suspect__role">${escapeHtml(s.role)}</span>
          </span>
          <span class="ded-suspect__tally" data-count="${pinned.length}">
            <span aria-hidden="true">${pinned.length}</span>
            <span class="sr-only">${pinned.length} clues pinned</span>
          </span>
        </header>
        ${bands}
      </article>`;
  }

  // -- deduction persistence -------------------------------------------------

  private chargeFlag(suspect: CharacterId, clue: ClueId, charge: Charge) {
    return `accuse.${suspect}.${clue}.${charge}`;
  }

  private chargeOf(suspect: CharacterId, clue: ClueId): Charge {
    for (const c of CHARGES) if (this.state.flags[this.chargeFlag(suspect, clue, c)]) return c;
    return 'means';
  }

  private pinClue(suspect: CharacterId, clue: ClueId, charge: Charge) {
    const list = (this.state.accusations[suspect] ??= []);
    if (!list.includes(clue)) list.push(clue);
    for (const c of CHARGES) {
      if (c === charge) this.state.flags[this.chargeFlag(suspect, clue, c)] = true;
      else delete this.state.flags[this.chargeFlag(suspect, clue, c)];
    }
    // Let the chip play its landing again even when it only moved band.
    this.seenPins.delete(pinKey(suspect, clue));
    this.sound('lock-click');
    this.announce(`${this.clueName(clue)} pinned to ${this.characterName(suspect)} as ${charge}.`);
    this.state.notify();
  }

  private unpinClue(suspect: CharacterId, clue: ClueId) {
    const list = this.state.accusations[suspect];
    if (!list) return;
    const at = list.indexOf(clue);
    if (at >= 0) list.splice(at, 1);
    if (!list.length) delete this.state.accusations[suspect];
    for (const c of CHARGES) delete this.state.flags[this.chargeFlag(suspect, clue, c)];
    this.seenPins.delete(pinKey(suspect, clue));
    this.sound('paper-rustle');
    this.announce(`${this.clueName(clue)} unpinned from ${this.characterName(suspect)}.`);
    this.state.notify();
  }

  // -- deduction interaction -------------------------------------------------

  /**
   * A press on an evidence card. Nothing is lifted yet: the gesture only
   * becomes a drag once the pointer has travelled `DRAG_SLOP`, so a plain
   * click (mouse or tap) resolves to the same pick-up the keyboard performs.
   */
  private onPanelPointerDown = (ev: PointerEvent) => {
    if (this.ptr || !ev.isPrimary) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const card = (ev.target as HTMLElement).closest<HTMLElement>('.ded-card');
    if (!card?.dataset.clue) return;

    // Suppress the native selection/image drag, then move focus by hand:
    // the pointer and keyboard paths must agree on the current card.
    ev.preventDefault();
    card.focus({ preventScroll: true });

    this.ptr = {
      id: ev.pointerId,
      clueId: card.dataset.clue,
      source: card,
      startX: ev.clientX,
      startY: ev.clientY,
      ghost: null,
      dx: 0,
      dy: 0,
      band: null,
    };
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  };

  /**
   * Lifts a *clone*: the tray scrolls and clips, so the real card can never
   * leave it, and only a free-floating copy can cross the spine to the
   * suspect columns. The ghost is parented to the journal root rather than
   * the book because the book's frame is a size container, which would make
   * it the containing block for a fixed-position child.
   */
  private lift(p: PointerCarry, ev: PointerEvent) {
    const rect = p.source.getBoundingClientRect();
    const ghost = p.source.cloneNode(true) as HTMLElement;
    ghost.className = `${p.source.className} ded-card--ghost`;
    ghost.classList.remove('is-carried', 'is-lifted');
    // The copy is scenery: not findable by id or `[data-clue]`, not focusable,
    // and never announced a second time.
    ghost.removeAttribute('data-clue');
    ghost.removeAttribute('data-fk');
    ghost.removeAttribute('id');
    ghost.removeAttribute('aria-describedby');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    this.el.appendChild(ghost);

    p.ghost = ghost;
    p.dx = p.startX - rect.left;
    p.dy = p.startY - rect.top;

    p.source.classList.add('is-lifted');
    this.el.classList.add('is-dragging');
    this.setCarrying(null);
    this.sound('paper-rustle');

    // Seed this frame from the press point so the card does not jump the
    // slop distance the instant it lifts.
    ghost.style.transform = `translate(${ev.clientX - p.startX}px, ${ev.clientY - p.startY}px)`;
  }

  private onPointerMove = (ev: PointerEvent) => {
    const p = this.ptr;
    if (!p || ev.pointerId !== p.id) return;

    if (!p.ghost) {
      if (Math.hypot(ev.clientX - p.startX, ev.clientY - p.startY) < DRAG_SLOP) return;
      this.lift(p, ev);
    }

    const ghost = p.ghost!;
    ghost.style.transform = `translate(${ev.clientX - p.dx - parseFloat(ghost.style.left)}px, ${
      ev.clientY - p.dy - parseFloat(ghost.style.top)
    }px)`;

    const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const band = under?.closest<HTMLElement>('.ded-band') ?? null;
    if (band !== p.band) {
      p.band?.classList.remove('is-hot');
      band?.classList.add('is-hot');
      p.band = band;
      if (band) this.sound('click-soft');
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    const p = this.ptr;
    if (!p || ev.pointerId !== p.id) return;

    const dragged = !!p.ghost;
    const cancelled = ev.type === 'pointercancel';
    const band = cancelled ? null : p.band;

    this.releasePointer(dragged && band ? { x: ev.clientX, y: ev.clientY } : null);

    if (!dragged) {
      if (!cancelled) this.setCarrying(this.carrying === p.clueId ? null : p.clueId);
      return;
    }
    if (band) {
      this.pinClue(
        band.dataset.suspect!,
        p.clueId,
        (band.dataset.charge as Charge | undefined) ?? 'means',
      );
    }
  };

  /**
   * Ends the pointer gesture and, if a card was actually in flight, retires
   * its ghost. With a drop point the ghost collapses into the board (the
   * "thunk"); without one it flies home, so a mis-drop reads as the card
   * refusing to stay rather than as the board eating it.
   */
  private releasePointer(dropAt: { x: number; y: number } | null) {
    const p = this.ptr;
    if (!p) return;
    this.ptr = null;

    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    p.band?.classList.remove('is-hot');
    p.source.classList.remove('is-lifted');
    this.el.classList.remove('is-dragging');

    const ghost = p.ghost;
    if (ghost) {
      if (REDUCED() || this.destroyed) {
        ghost.remove();
      } else if (dropAt) {
        ghost.style.transformOrigin = `${dropAt.x - parseFloat(ghost.style.left)}px ${
          dropAt.y - parseFloat(ghost.style.top)
        }px`;
        ghost.classList.add('is-thunk');
        this.retireGhost(ghost);
      } else {
        ghost.classList.add('is-returning');
        // Flush the class before changing the transform, or the transition
        // has no start value and the card teleports home instead of flying.
        void ghost.offsetWidth;
        ghost.style.transform = 'translate(0, 0)';
        this.sound('paper-rustle');
        this.retireGhost(ghost);
      }
    }

    // A refresh that arrived mid-drag was skipped to keep the card steady.
    if (this.renderDeferred && this.opened && !this.destroyed) this.refresh();
  }

  /** Removes a ghost when its exit finishes, with a timer as the backstop. */
  private retireGhost(ghost: HTMLElement) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ghost.remove();
    };
    ghost.addEventListener('transitionend', finish, { once: true });
    ghost.addEventListener('animationend', finish, { once: true });
    this.after(GHOST_MAX_MS, finish);
  }

  /** Picks a clue up (or puts it down) for the click and keyboard paths. */
  private setCarrying(clue: ClueId | null) {
    const was = this.carrying;
    if (clue === was) return;
    this.carrying = clue;
    this.syncCarrying();
    if (clue) {
      this.announce(
        `${this.clueName(clue)} picked up. Move to a suspect and press Enter to pin it, or Escape to put it down.`,
      );
      this.sound('paper-rustle');
    } else if (was) {
      this.announce(`${this.clueName(was)} put down.`);
    }
  }

  /**
   * Projects `carrying` onto the live DOM. Called after every render as well
   * as on every change, because a rebuild throws the classes away while the
   * player is still holding the card.
   */
  private syncCarrying() {
    const clue = this.carrying;
    const board = this.panelEl.querySelector<HTMLElement>('.ded');
    board?.classList.toggle('is-carrying', !!clue);
    for (const card of this.panelEl.querySelectorAll<HTMLElement>('.ded-card')) {
      const on = !!clue && card.dataset.clue === clue;
      card.classList.toggle('is-carried', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    for (const drop of this.panelEl.querySelectorAll<HTMLButtonElement>('.ded-band__drop')) {
      drop.tabIndex = clue ? 0 : -1;
    }
  }

  private onPanelClick = (ev: Event) => {
    const target = ev.target as HTMLElement;

    const unpin = target.closest<HTMLElement>('[data-unpin]');
    if (unpin) {
      this.unpinClue(unpin.dataset.suspect!, unpin.dataset.unpin!);
      return;
    }

    const drop = target.closest<HTMLElement>('[data-drop-suspect]');
    if (drop && this.carrying) {
      const clue = this.carrying;
      this.setCarrying(null);
      this.pinClue(
        drop.dataset.dropSuspect!,
        clue,
        (drop.dataset.dropCharge as Charge | undefined) ?? 'means',
      );
      return;
    }

    const node = target.closest<HTMLElement>('[data-scene]');
    if (node?.dataset.scene) {
      this.sound('click-brass');
      const scene = node.dataset.scene;
      // Travelling means leaving: keep the book open over a new room and the
      // player has to dismiss it before they can see where they went.
      if (this.cb.onFastTravel) {
        this.close();
        this.cb.onFastTravel(scene);
      }
    }
  };

  private onPanelKeyDown = (ev: KeyboardEvent) => {
    const card = (ev.target as HTMLElement).closest<HTMLElement>('.ded-card');
    if (card?.dataset.clue && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      ev.stopPropagation();
      const id = card.dataset.clue;
      this.setCarrying(this.carrying === id ? null : id);
      if (this.carrying) this.panelEl.querySelector<HTMLElement>('.ded-band__drop')?.focus();
      return;
    }

    // Roving movement between drop plates while a clue is in hand.
    if (this.carrying && (ev.target as HTMLElement).closest('.ded-band__drop')) {
      const drops = [...this.panelEl.querySelectorAll<HTMLElement>('.ded-band__drop')];
      if (!drops.length) return;
      const at = drops.findIndex((d) => d === document.activeElement);
      let next = -1;
      if (ev.key === 'ArrowDown') next = (at + 1) % drops.length;
      else if (ev.key === 'ArrowUp') next = (at - 1 + drops.length) % drops.length;
      else if (ev.key === 'ArrowRight') next = Math.min(drops.length - 1, at + CHARGES.length);
      else if (ev.key === 'ArrowLeft') next = Math.max(0, at - CHARGES.length);
      else return;
      ev.preventDefault();
      ev.stopPropagation();
      drops[next]?.focus();
    }
  };

  // -- scroll, focus & overlay scheduling ------------------------------------

  private onPanelScroll = () => {
    this.rememberScroll();
    // Strings are drawn in board space, so scrolling either column moves an
    // end — but a scroll fires far faster than a frame, and every redraw
    // measures live geometry. One redraw per frame, no more.
    this.queueOverlays();
  };

  private rememberScroll() {
    for (const s of this.panelEl.querySelectorAll<HTMLElement>('[data-scroll]')) {
      this.scrollMemory.set(`${this.tab}:${s.dataset.scroll}`, s.scrollTop);
    }
  }

  private restoreScroll() {
    for (const s of this.panelEl.querySelectorAll<HTMLElement>('[data-scroll]')) {
      const at = this.scrollMemory.get(`${this.tab}:${s.dataset.scroll}`);
      if (at) s.scrollTop = at;
    }
  }

  /**
   * A stable identity for whatever is focused inside the panel. Rebuilding
   * the page drops focus to `<body>`, which escapes the trap and strands
   * keyboard players outside the book they are still looking at.
   */
  private focusKey(): string | null {
    const active = document.activeElement as HTMLElement | null;
    if (!active || !this.panelEl.contains(active)) return null;
    // Empty string means "somewhere on this page but not on a keyed control",
    // which still has to come back inside the book after the rebuild.
    return active.closest<HTMLElement>('[data-fk]')?.dataset.fk ?? '';
  }

  private restoreFocus(key: string | null) {
    if (key === null) return;
    const match = [...this.panelEl.querySelectorAll<HTMLElement>('[data-fk]')].find(
      (n) => n.dataset.fk === key,
    );
    // The element may be gone (its clue was unpinned); the panel itself is
    // focusable so the trap still has something inside the book to hold.
    (match ?? this.panelEl).focus({ preventScroll: true });
  }

  /**
   * The book swings on `rotateY`, and a rotating ancestor projects every
   * client rect underneath it. The overlays normalise that away (see
   * `layoutStrings`), but they are still drawn from a squashed measurement
   * until the swing lands, so redraw them once it does.
   */
  private onBookSettled = (ev: TransitionEvent) => {
    if (ev.target === this.bookEl && ev.propertyName === 'transform') this.queueOverlays();
  };

  private queueOverlays() {
    if (this.overlaysQueued) return;
    this.overlaysQueued = true;
    requestAnimationFrame(() => {
      this.overlaysQueued = false;
      if (!this.destroyed) this.layoutOverlays();
    });
  }

  // -- MAP -------------------------------------------------------------------

  private mapMarkup(): string {
    const ids = [...this.state.visitedScenes];
    if (!ids.length) {
      return this.spread(
        this.emptyState('Uncharted', 'You have not been anywhere yet. The map draws itself as you walk it.'),
      );
    }

    const scenes = this.state.content.scenes ?? {};
    // Never more columns than there are places: two columns for one node
    // stretches a single tag across half the spread.
    const cols = Math.max(1, Math.min(MAP_MAX_COLS, ids.length, Math.ceil(Math.sqrt(ids.length) * 1.4)));
    const nodes = ids
      .map((id) => {
        const here = id === this.state.scene;
        const name = scenes[id]?.name ?? id;
        const safe = escapeHtml(id);
        return `
          <li class="map-node-cell">
            <button type="button" class="map-node${here ? ' is-here' : ''}" data-scene="${safe}"
                    data-fk="scene:${safe}"${here ? ' aria-current="true"' : ''}
                    style="--tilt:${tiltOf(id)}deg"
                    aria-label="${escapeHtml(name)}${here ? ' — you are here' : ''}">
              <span class="map-node__mark" aria-hidden="true"></span>
              <span class="map-node__name">${escapeHtml(name)}</span>
            </button>
          </li>`;
      })
      .join('');

    return this.spread(`
      <div class="map" style="--map-cols:${cols}">
        <svg class="map__routes" aria-hidden="true" focusable="false"></svg>
        <ul class="map__grid" role="list">${nodes}</ul>
        <p class="map__legend">Surveyed from memory. Distances are a guess.</p>
      </div>`);
  }

  // -- overlays (red string, ink routes) -------------------------------------

  /** Both SVG overlays are measured from live geometry, so they redraw here. */
  private layoutOverlays() {
    if (!this.opened) return;
    this.layoutStrings();
    this.layoutRoutes();
  }

  private layoutStrings() {
    const svg = this.panelEl.querySelector<SVGSVGElement>('.ded__strings');
    const board = this.panelEl.querySelector<HTMLElement>('.ded__board');
    if (!svg || !board) return;

    const box = board.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const tray = this.panelEl.querySelector<HTMLElement>('.ded__tray-scroll');
    const trayBox = tray?.getBoundingClientRect();
    const column = this.panelEl.querySelector<HTMLElement>('.ded__suspects');
    const columnBox = column?.getBoundingClientRect();

    // The book is a 3D-transformed surface: every client rect under it comes
    // back projected, not in layout pixels, and mid-swing the whole board
    // measures a couple of hundred pixels wide. Emitting into a viewBox sized
    // in *layout* pixels and normalising each measurement by the board's own
    // rect cancels whatever the swing is doing, so the string lands in the
    // right place whenever it happens to be drawn.
    const w = board.clientWidth || Math.round(box.width);
    const h = board.clientHeight || Math.round(box.height);
    const sx = w / box.width;
    const sy = h / box.height;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const paths: string[] = [];
    for (const suspectEl of this.panelEl.querySelectorAll<HTMLElement>('.ded-suspect')) {
      const suspect = suspectEl.dataset.suspect;
      if (!suspect) continue;
      const head = suspectEl.querySelector<HTMLElement>('.ded-suspect__pin');
      if (!head) continue;
      const hb = head.getBoundingClientRect();
      // A suspect scrolled out of their column is in the same boat as a
      // scrolled-out card: no honest anchor, so no string.
      if (columnBox && (hb.bottom < columnBox.top - 2 || hb.top > columnBox.bottom + 2)) continue;
      const x2 = (hb.left + hb.width / 2 - box.left) * sx;
      const y2 = (hb.top + hb.height / 2 - box.top) * sy;

      for (const clueId of this.state.accusations[suspect] ?? []) {
        const card = this.panelEl.querySelector<HTMLElement>(
          `.ded-card[data-clue="${CSS.escape(clueId)}"] .ded-card__pin`,
        );
        if (!card) continue;
        const cb = card.getBoundingClientRect();
        // A card scrolled out of the tray has no honest anchor; drop its string
        // rather than let it point at the wrong place.
        if (trayBox && (cb.bottom < trayBox.top - 2 || cb.top > trayBox.bottom + 2)) continue;

        const x1 = (cb.left + cb.width / 2 - box.left) * sx;
        const y1 = (cb.top + cb.height / 2 - box.top) * sy;
        const span = Math.hypot(x2 - x1, y2 - y1);
        // Slack in the string: real twine hangs, and the sag is what makes the
        // board read as a physical object rather than a node graph.
        const sag = Math.min(90, span * 0.17);
        paths.push(`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)} ${(
          (y1 + y2) / 2 +
          sag
        ).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      }
    }

    svg.innerHTML =
      paths.map((d) => `<path class="ded-string ded-string--shadow" d="${d}"/>`).join('') +
      paths.map((d) => `<path class="ded-string" d="${d}"/>`).join('');
  }

  private layoutRoutes() {
    const svg = this.panelEl.querySelector<SVGSVGElement>('.map__routes');
    const grid = this.panelEl.querySelector<HTMLElement>('.map__grid');
    if (!svg || !grid) return;

    const holder = svg.parentElement;
    const box = svg.getBoundingClientRect();
    if (!holder || !box.width || !box.height) return;
    // Same projection problem as the red string; same cure.
    const w = holder.clientWidth || Math.round(box.width);
    const h = holder.clientHeight || Math.round(box.height);
    const sx = w / box.width;
    const sy = h / box.height;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const marks = [...this.panelEl.querySelectorAll<HTMLElement>('.map-node__mark')].map((m) => {
      const r = m.getBoundingClientRect();
      return {
        x: (r.left + r.width / 2 - box.left) * sx,
        y: (r.top + r.height / 2 - box.top) * sy,
      };
    });

    const d: string[] = [];
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1]!;
      const b = marks[i]!;
      // A surveyor's hand wobbles: bow each leg to one side so the route reads
      // as drawn in ink rather than plotted.
      const bow = (i % 2 ? 1 : -1) * Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.16);
      const mx = (a.x + b.x) / 2 + bow * 0.4;
      const my = (a.y + b.y) / 2 + bow;
      d.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    }
    svg.innerHTML = d.map((p) => `<path class="map-route" d="${p}"/>`).join('');
  }

  // -- small helpers ---------------------------------------------------------

  /** Wraps content that ignores the two-page split and runs across the gutter. */
  private spread(inner: string): string {
    return `<div class="journal-spread journal-spread--wide"><div class="journal-scroll scrollable" data-scroll="page">${inner}</div></div>`;
  }

  /**
   * Empty states are designed, not apologetic: content lands late in this
   * project and a blank page would read as a bug rather than as a beginning.
   */
  private emptyState(title: string, line: string): string {
    return `
      <div class="jp-empty">
        <span class="jp-empty__flourish" aria-hidden="true">${FLOURISH}</span>
        <h4 class="jp-empty__title">${escapeHtml(title)}</h4>
        <p class="jp-empty__line">${escapeHtml(line)}</p>
      </div>`;
  }

  private clueName(id: ClueId): string {
    return this.state.content.clues?.[id]?.name ?? id;
  }

  private characterName(id: CharacterId): string {
    return this.state.content.characters?.[id]?.name ?? id;
  }

  /**
   * Speaks through the polite live region. The clear-then-set is deliberate:
   * a live region only announces a *change*, and pinning two cards to the
   * same band produces the same sentence twice in a row.
   */
  private announce(text: string) {
    this.statusEl.textContent = '';
    this.after(0, () => {
      this.statusEl.textContent = text;
    });
  }

  private sound(name: string) {
    this.cb.onSound?.(name);
  }

  /** setTimeout that cannot outlive the journal. */
  private after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.add(id);
  }
}

// ---------------------------------------------------------------------------
// Static template & glyphs
// ---------------------------------------------------------------------------

const CLOSE_GLYPH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M7 7l10 10M17 7 7 17"/></svg>';

/** A hand-drawn tick box: the square is inked, the tick draws itself in. */
const CHECKBOX =
  '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path class="task__box-line" stroke-width="1.6" d="M4.6 5.2c6-.7 12.2-.9 18.4-.4.7 5.8.6 11.6-.2 17.4-6 .6-12.1.7-18.1.2-.7-5.7-.8-11.4-.1-17.2Z"/>' +
  '<path class="task__tick" stroke-width="2.4" d="m7.4 14.6 4.6 5.1L21.4 7.9"/></svg>';

/** Pen flourish used to sign off an empty page. */
const FLOURISH =
  '<svg viewBox="0 0 120 34" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M4 22c14-14 26-14 33-4s16 12 25 2 18-12 24-4"/>' +
  '<path d="M40 27c10 3 24 3 40 0" stroke-opacity=".5"/>' +
  '<path d="M60 6.5c2.5 2 4.5 2 6.5 0" stroke-opacity=".4"/></svg>';

const TEMPLATE = `
  <div class="journal__scrim"></div>
  <div class="journal__frame stage-box">
    <div class="journal__book" role="dialog" aria-modal="true" aria-labelledby="journal-title">
      <h2 class="sr-only" id="journal-title">Case journal</h2>
      <div class="journal__stitch" aria-hidden="true"></div>
      <div class="journal__spread-frame">
        <div class="journal__leaf journal__leaf--left" aria-hidden="true"></div>
        <div class="journal__leaf journal__leaf--right" aria-hidden="true"></div>
        <div class="journal__gutter" aria-hidden="true"></div>
        <div class="journal__panel" id="journal-panel" role="tabpanel" tabindex="-1"></div>
        <div class="journal__vignette" aria-hidden="true"></div>
      </div>
      <div class="journal__tabs" role="tablist" aria-orientation="vertical" aria-label="Journal sections"></div>
      <button type="button" class="journal__close" aria-label="Close journal" aria-keyshortcuts="Escape">
        <span aria-hidden="true">${CLOSE_GLYPH}</span>
      </button>
      <p class="journal__status sr-only" role="status" aria-live="polite"></p>
    </div>
  </div>`;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Identity of a pin on the board. Charge is deliberately excluded: moving a
 * card from "means" to "motive" is the same pin changing its mind, and the
 * chip should replay its landing rather than be treated as a new object.
 */
const pinKey = (suspect: CharacterId, clue: ClueId) => `${suspect}|${clue}`;

/**
 * Portrait art, degrading in two steps: the painted plate, then a monogram
 * pressed into the frame. Character art is authored by another workflow and
 * may lag the code, so a missing face must look deliberate.
 */
function portraitFor(c: Character): string {
  const mono = escapeHtml(monogram(c.name));
  const fallback = `<span class="portrait-mono" aria-hidden="true">${mono}</span>`;
  if (!c.portrait) return fallback;
  return `<img class="portrait-art" src="${escapeHtml(c.portrait)}" alt="" draggable="false">${fallback}`;
}

/** Removes portrait art that failed to load so the monogram can take over. */
function wireArt(root: HTMLElement) {
  for (const img of root.querySelectorAll<HTMLImageElement>('.portrait-art')) {
    img.addEventListener('error', () => img.remove(), { once: true });
  }
}

/** A stand-in record so an id with no content still reads as a real card. */
function placeholderClue(id: ClueId): Clue {
  return {
    id,
    name: id,
    summary: 'Recorded, but not yet written up.',
    act: 1,
    category: 'observation',
  };
}

/**
 * A stable pseudo-random tilt per id. Cards must sit slightly crooked to look
 * placed by hand, but the same card must lean the same way on every render or
 * the board twitches whenever state changes.
 */
function tiltOf(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 400) / 100 - 2).toFixed(2);
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Acts are numbered in the display face's own idiom. */
function roman(n: number): string {
  if (!Number.isFinite(n) || n < 1 || n > 12) return String(n);
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n - 1]!;
}

/**
 * Content-authored accent colours are interpolated into a `style` attribute,
 * where escaping is not enough: `red;position:fixed` would still parse. Only
 * things that look like a CSS colour survive; anything else falls back to the
 * ink default rather than being repaired.
 */
function safeColor(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(?:rgb|hsl)a?\([0-9a-z%.,\s/]{3,60}\))$/i.test(v) ? v : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Exported for the integration layer's key map and for tests. */
export const JOURNAL_TABS = TAB_DEFS.map((t) => t.id);

/** Exported so a results screen can label the same charges the board uses. */
export const JOURNAL_CHARGES = CHARGES;
