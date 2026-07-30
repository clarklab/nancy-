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
 */

import type { GameState } from '@/engine/state';
import type { Character, CharacterId, Clue, ClueId, SceneId } from '@/engine/types';

/** The five sections, in tab order down the right edge. */
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

/* Motion constant mirroring --dur-med. It lives here because the drag settle
   is sequenced in JS, which cannot read a CSS duration reliably. `REDUCED`
   collapses it the way the tokens do. */
const MS_SETTLE = 300;
const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Widest the map grid is allowed to get before it starts a new row. */
const MAP_MAX_COLS = 5;

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
  private opened = false;
  private destroyed = false;

  /** Where focus came from, so closing the book puts it back. */
  private invoker: HTMLElement | null = null;

  private unsubscribe: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private timers = new Set<number>();
  private renderQueued = false;
  /** Re-entrancy guard: marking clues read notifies mid-render. */
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

  /** Scroll offset per tab, so switching back does not lose the reader's place. */
  private scrollMemory = new Map<JournalTab, number>();

  /** Live pointer drag on the deduction board, if any. */
  private drag: {
    clueId: ClueId;
    source: HTMLElement;
    ghost: HTMLElement;
    dx: number;
    dy: number;
    band: HTMLElement | null;
  } | null = null;

  /** Keyboard equivalent of a drag: a clue held, waiting for a destination. */
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
    this.unsubscribe = this.state.subscribe(() => this.refresh());

    // Strings and ink routes are measured in pixels, so any change to the
    // book's size invalidates them.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.layoutOverlays());
      this.resizeObserver.observe(this.bookEl);
    }
  }

  destroy() {
    this.destroyed = true;
    this.endDrag(null);
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
    this.endDrag(null);
    this.setCarrying(null);
    this.freshClues.clear();
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
    if (this.destroyed || !this.opened || this.renderQueued || this.rendering) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (this.destroyed || !this.opened) return;
      // Never yank a card out from under a moving pointer.
      if (this.drag) return;
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
      if (this.carrying) this.setCarrying(null);
      else this.close();
      return;
    }

    if (ev.key === 'PageDown' || ev.key === 'PageUp') {
      const tabs = TAB_DEFS.map((t) => t.id);
      const at = tabs.indexOf(this.tab);
      const step = ev.key === 'PageDown' ? 1 : -1;
      ev.preventDefault();
      this.setTab(tabs[(at + step + tabs.length) % tabs.length]!, true);
      return;
    }

    if (ev.key === 'Tab') this.trapTab(ev);
  };

  /** Keeps focus inside the open book — a modal surface owns the keyboard. */
  private trapTab(ev: KeyboardEvent) {
    const focusables = [
      ...this.bookEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!focusables.length) return;

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (ev.shiftKey && (active === first || !this.bookEl.contains(active))) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  // -- rendering -------------------------------------------------------------

  private render() {
    this.rendering = true;
    if (this.tab === 'clues') this.claimUnreadClues();

    this.panelEl.dataset.tab = this.tab;
    this.panelEl.innerHTML = this.markupFor(this.tab);
    wireArt(this.panelEl);

    // Restart the page-turn wash so every tab change reads as a turned leaf.
    this.panelEl.classList.remove('is-turning');
    void this.panelEl.offsetWidth;
    this.panelEl.classList.add('is-turning');

    const remembered = this.scrollMemory.get(this.tab) ?? 0;
    const scroller = this.panelEl.querySelector<HTMLElement>('.journal-scroll');
    if (scroller) scroller.scrollTop = remembered;

    this.rendering = false;

    requestAnimationFrame(() => {
      if (this.destroyed) return;
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
        <section class="jp-col scrollable" aria-label="The case">
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
        <section class="jp-col scrollable" aria-label="Open tasks">
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
    this.state.notify();
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
        return `
          <article class="person-card" style="--tilt:${tiltOf(p.id)}deg">
            <div class="person-card__plate">
              <span class="person-card__portrait">${portraitFor(p)}</span>
            </div>
            <div class="person-card__body">
              <h4 class="person-card__name"${p.color ? ` style="--accent-person:${escapeHtml(p.color)}"` : ''}>${escapeHtml(p.name)}</h4>
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
  private suspects(): Character[] {
    const met = this.metCharacters();
    if (met.length) return met;

    const all = this.state.content.characters ?? {};
    const ids = new Set<CharacterId>();
    for (const clue of this.ownedClues()) for (const id of clue.bearsOn ?? []) ids.add(id);
    return [...ids].map((id) => all[id]).filter((c): c is Character => !!c);
  }

  private deductionMarkup(): string {
    const clues = this.ownedClues();
    const suspects = this.suspects();

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
        return `
          <button type="button" class="ded-card${pinned ? ' is-pinned' : ''}"
                  data-clue="${escapeHtml(c.id)}" style="--tilt:${tiltOf(c.id)}deg"
                  aria-label="${escapeHtml(c.name)}. ${pinned ? 'Pinned. ' : ''}Press Enter to pick up.">
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
          <svg class="ded__strings" aria-hidden="true" focusable="false"></svg>
          <section class="ded__tray" aria-label="Evidence">
            <p class="jp-kicker jp-kicker--cork">Evidence</p>
            <div class="ded__tray-scroll journal-scroll scrollable">${tray}</div>
            <p class="ded__hint">Drag a card onto a suspect — or press Enter to pick it up.</p>
          </section>
          <section class="ded__suspects journal-scroll scrollable" aria-label="Suspects">${columns}</section>
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
          return `
            <span class="ded-chip" data-clue="${escapeHtml(id)}">
              <span class="ded-chip__name">${escapeHtml(name)}</span>
              <button type="button" class="ded-chip__unpin" data-unpin="${escapeHtml(id)}"
                      data-suspect="${escapeHtml(s.id)}"
                      aria-label="Unpin ${escapeHtml(name)} from ${escapeHtml(s.name)}">×</button>
            </span>`;
        })
        .join('');
      return `
        <div class="ded-band" data-suspect="${escapeHtml(s.id)}" data-charge="${charge}">
          <span class="ded-band__label">${charge}</span>
          <div class="ded-band__chips">${chips || '<span class="ded-band__empty" aria-hidden="true">—</span>'}</div>
          <button type="button" class="ded-band__drop" data-drop-suspect="${escapeHtml(s.id)}"
                  data-drop-charge="${charge}" tabindex="-1"
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
          <span class="ded-suspect__tally" aria-label="${pinned.length} clues pinned">${pinned.length}</span>
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
    this.sound('paper-rustle');
    this.announce(`${this.clueName(clue)} unpinned from ${this.characterName(suspect)}.`);
    this.state.notify();
  }

  // -- deduction interaction -------------------------------------------------

  private onPanelPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0 || this.drag) return;
    const card = (ev.target as HTMLElement).closest<HTMLElement>('.ded-card');
    if (!card) return;
    ev.preventDefault();
    this.beginDrag(card, ev);
  };

  /**
   * A pointer drag lifts a *clone*: the tray scrolls and clips, so the real
   * card can never leave it, and only a free-floating copy can cross the
   * spine to the suspect columns.
   */
  private beginDrag(card: HTMLElement, ev: PointerEvent) {
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add('ded-card--ghost');
    // The copy is scenery: it must not be findable by `[data-clue]` string
    // layout, focusable, or announced a second time.
    ghost.removeAttribute('data-clue');
    ghost.inert = true;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    this.el.appendChild(ghost);

    card.classList.add('is-lifted');
    this.el.classList.add('is-dragging');
    this.setCarrying(null);

    this.drag = {
      clueId: card.dataset.clue!,
      source: card,
      ghost,
      dx: ev.clientX - rect.left,
      dy: ev.clientY - rect.top,
      band: null,
    };

    this.sound('paper-rustle');
    window.addEventListener('pointermove', this.onDragMove);
    window.addEventListener('pointerup', this.onDragUp);
    window.addEventListener('pointercancel', this.onDragUp);
  }

  private onDragMove = (ev: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    d.ghost.style.transform = `translate(${ev.clientX - d.dx - parseFloat(d.ghost.style.left)}px, ${
      ev.clientY - d.dy - parseFloat(d.ghost.style.top)
    }px)`;

    const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const band = under?.closest<HTMLElement>('.ded-band') ?? null;
    if (band !== d.band) {
      d.band?.classList.remove('is-hot');
      band?.classList.add('is-hot');
      d.band = band;
      if (band) this.sound('click-soft');
    }
  };

  private onDragUp = (ev: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    const band = d.band;
    this.endDrag(band ? { x: ev.clientX, y: ev.clientY } : null);
    if (band) {
      this.pinClue(
        band.dataset.suspect!,
        d.clueId,
        (band.dataset.charge as Charge | undefined) ?? 'means',
      );
    }
  };

  /**
   * Tears down a drag. With a drop point the ghost collapses into the board
   * (the "thunk"); without one it flies home, so a mis-drop reads as the card
   * refusing to stay rather than as the board eating it.
   */
  private endDrag(dropAt: { x: number; y: number } | null) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;

    window.removeEventListener('pointermove', this.onDragMove);
    window.removeEventListener('pointerup', this.onDragUp);
    window.removeEventListener('pointercancel', this.onDragUp);

    d.band?.classList.remove('is-hot');
    d.source.classList.remove('is-lifted');
    this.el.classList.remove('is-dragging');

    if (REDUCED() || this.destroyed) {
      d.ghost.remove();
      return;
    }

    if (dropAt) {
      d.ghost.classList.add('is-thunk');
      d.ghost.style.transformOrigin = `${dropAt.x - parseFloat(d.ghost.style.left)}px ${
        dropAt.y - parseFloat(d.ghost.style.top)
      }px`;
    } else {
      d.ghost.classList.add('is-returning');
      // Flush the class before changing the transform, or the transition has
      // no start value and the card teleports home instead of flying.
      void d.ghost.offsetWidth;
      d.ghost.style.transform = 'translate(0, 0)';
      this.sound('paper-rustle');
    }
    this.after(MS_SETTLE, () => d.ghost.remove());
  }

  /** Keyboard carry: the accessible half of drag-and-drop. */
  private setCarrying(clue: ClueId | null) {
    this.carrying = clue;
    const board = this.panelEl.querySelector<HTMLElement>('.ded');
    board?.classList.toggle('is-carrying', !!clue);
    for (const card of this.panelEl.querySelectorAll<HTMLElement>('.ded-card')) {
      card.classList.toggle('is-carried', !!clue && card.dataset.clue === clue);
    }
    for (const drop of this.panelEl.querySelectorAll<HTMLButtonElement>('.ded-band__drop')) {
      drop.tabIndex = clue ? 0 : -1;
    }
    if (clue) {
      this.announce(
        `${this.clueName(clue)} picked up. Move to a suspect and press Enter to pin it, or Escape to put it down.`,
      );
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
    if (node) {
      this.sound('click-brass');
      this.cb.onFastTravel?.(node.dataset.scene!);
    }
  };

  private onPanelKeyDown = (ev: KeyboardEvent) => {
    const card = (ev.target as HTMLElement).closest<HTMLElement>('.ded-card');
    if (card && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      const id = card.dataset.clue!;
      this.setCarrying(this.carrying === id ? null : id);
      if (this.carrying) {
        this.panelEl.querySelector<HTMLElement>('.ded-band__drop')?.focus();
        this.sound('paper-rustle');
      }
      return;
    }

    // Roving movement between drop targets while a clue is in hand.
    if (this.carrying && (ev.target as HTMLElement).closest('.ded-band__drop')) {
      const drops = [...this.panelEl.querySelectorAll<HTMLElement>('.ded-band__drop')];
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

  private onPanelScroll = () => {
    this.rememberScroll();
    // Strings are drawn in board space; scrolling either column moves an end.
    this.layoutOverlays();
  };

  private rememberScroll() {
    const scroller = this.panelEl.querySelector<HTMLElement>('.journal-scroll');
    if (scroller) this.scrollMemory.set(this.tab, scroller.scrollTop);
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
    const cols = Math.min(MAP_MAX_COLS, Math.max(2, Math.ceil(Math.sqrt(ids.length))));
    const nodes = ids
      .map((id, i) => {
        const here = id === this.state.scene;
        const name = scenes[id]?.name ?? id;
        return `
          <li class="map-node-cell">
            <button type="button" class="map-node${here ? ' is-here' : ''}" data-scene="${escapeHtml(id)}"
                    data-index="${i}"${here ? ' aria-current="true"' : ''}
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
    const tray = this.panelEl.querySelector<HTMLElement>('.ded__tray-scroll');
    const trayBox = tray?.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.round(box.width)} ${Math.round(box.height)}`);

    const paths: string[] = [];
    for (const column of this.panelEl.querySelectorAll<HTMLElement>('.ded-suspect')) {
      const suspect = column.dataset.suspect!;
      const head = column.querySelector<HTMLElement>('.ded-suspect__pin');
      if (!head) continue;
      const hb = head.getBoundingClientRect();
      const x2 = hb.left + hb.width / 2 - box.left;
      const y2 = hb.top + hb.height / 2 - box.top;

      for (const clueId of this.state.accusations[suspect] ?? []) {
        const card = this.panelEl.querySelector<HTMLElement>(
          `.ded-card[data-clue="${CSS.escape(clueId)}"] .ded-card__pin`,
        );
        if (!card) continue;
        const cb = card.getBoundingClientRect();
        // A card scrolled out of the tray has no honest anchor; drop its string
        // rather than let it point at the wrong place.
        if (trayBox && (cb.bottom < trayBox.top - 2 || cb.top > trayBox.bottom + 2)) continue;

        const x1 = cb.left + cb.width / 2 - box.left;
        const y1 = cb.top + cb.height / 2 - box.top;
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

    const box = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.round(box.width)} ${Math.round(box.height)}`);

    const marks = [...this.panelEl.querySelectorAll<HTMLElement>('.map-node__mark')].map((m) => {
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });

    const d: string[] = [];
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1]!;
      const b = marks[i]!;
      // A surveyor's hand wobbles: bow each leg to one side so the route reads
      // as drawn in ink rather than plotted.
      const bow = (i % 2 ? 1 : -1) * Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.16);
      const mx = (a.x + b.x) / 2 - (b.y - a.y) * 0.0001 + bow * 0.4;
      const my = (a.y + b.y) / 2 + bow;
      d.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    }
    svg.innerHTML = d.map((p) => `<path class="map-route" d="${p}"/>`).join('');
  }

  // -- small helpers ---------------------------------------------------------

  /** Wraps content that ignores the two-page split and runs across the gutter. */
  private spread(inner: string): string {
    return `<div class="journal-spread journal-spread--wide"><div class="journal-scroll scrollable">${inner}</div></div>`;
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

  private announce(text: string) {
    this.statusEl.textContent = text;
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
      </div>
      <div class="journal__tabs" role="tablist" aria-orientation="vertical" aria-label="Journal sections"></div>
      <button type="button" class="journal__close" aria-label="Close journal" aria-keyshortcuts="Escape">
        <span aria-hidden="true">${CLOSE_GLYPH()}</span>
      </button>
      <p class="journal__status sr-only" role="status" aria-live="polite"></p>
    </div>
  </div>`;

function CLOSE_GLYPH() {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M7 7l10 10M17 7 7 17"/></svg>'
  );
}

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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Exported for the integration layer's key map and for tests. */
export const JOURNAL_TABS = TAB_DEFS.map((t) => t.id);

/** Exported so a results screen can label the same charges the board uses. */
export const JOURNAL_CHARGES = CHARGES;
