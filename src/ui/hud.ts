/**
 * The persistent chrome: where you are, what you are carrying, and the five
 * doors out of the scene.
 *
 * The HUD is deliberately the quietest thing on screen. It sits at low opacity
 * until it has something to say — a room name on arrival, an item landing in
 * the belt, the label of whatever the pointer is resting on — and then recedes
 * again. It owns no game logic: every press is handed straight back through
 * `HudCallbacks` so the integration layer stays the only place that decides
 * what a button *means*.
 *
 * Two invariants are worth knowing before editing:
 *
 * 1. The HUD never installs a global key listener. `Game.installGlobalKeys`
 *    owns J/I/M/H/Space/Escape at the window. Anything the HUD wants to claim
 *    for itself (Escape to put an item down, Space to press a fitting) has to
 *    `stopPropagation`, or the player gets both behaviours at once.
 * 2. Every rebuild of the belt destroys and recreates its buttons, so focus,
 *    the roving tabindex and the selection have to be restored by hand
 *    afterwards. Nothing in the DOM survives a `renderBelt`.
 */

import type { GameState } from '@/engine/state';
import type { Item } from '@/engine/types';

/** The five fittings in the top-right cluster, in reading order. */
export type HudTool = 'journal' | 'inventory' | 'map' | 'hints' | 'menu';

export interface HudCallbacks {
  onOpenJournal(): void;
  onOpenInventory(): void;
  onOpenMap(): void;
  onHint(): void;
  onMenu(): void;
  /**
   * Selection *intent*, not a committed change: the HUD asks, and only reflects
   * the answer when `setSelectedItem` comes back. That keeps the carried item
   * single-sourced in `Game`, which also has to tell `SceneView` about it.
   */
  onSelectItem(itemId: string | null): void;
  /** Double-click, or Enter on an already-selected slot: open the close-up. */
  onExamineItem(itemId: string): void;
  /** Named cue from the shared SFX table, e.g. `click-brass`. */
  onSound?(name: string): void;
}

/** Minimum belt width. Empty recesses imply "there is more to find". */
const BELT_SLOTS = 8;

/* Motion constants mirror the --dur-* tokens. They live here because the
   toast queue is sequenced in JS and cannot read a CSS duration reliably. */
const MS_ENTER = 460;
const MS_EXIT = 460;
/**
 * How long a toast must be up before the effect chain may continue. This is a
 * *reading* beat, not a motion beat, so it is deliberately NOT collapsed under
 * `prefers-reduced-motion` — a player who dislikes movement still needs the
 * same time to read "Item acquired" before the story moves on.
 */
const MS_ACK = 900;
/** Total dwell before it slides out; the chain has long since moved on. */
const MS_HOLD = 2600;
/** How long the location card stays lit after arriving somewhere new. */
const MS_ANNOUNCE = 3600;

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ToastRequest {
  kind: 'item' | 'clue';
  title: string;
  icon?: string;
  resolve: () => void;
}

/**
 * Persistent in-game chrome. Construct once per session, `mount` it above the
 * scene layer, and drive it with `refresh()` from a `GameState` subscription.
 */
export class Hud {
  readonly el: HTMLElement;

  private state: GameState;
  private cb: HudCallbacks;

  private placeEl!: HTMLElement;
  private actEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private subtitleEl!: HTMLElement;
  private toolsEl!: HTMLElement;
  private beltEl!: HTMLElement;
  private nameplateEl!: HTMLElement;
  private nameplateTextEl!: HTMLElement;
  private toastHostEl!: HTMLElement;

  private unsubscribe: (() => void) | null = null;
  private timers = new Set<number>();
  /** Resolvers for in-flight `sleep`s, so teardown can settle them all. */
  private pending = new Set<() => void>();

  private selectedItem: string | null = null;
  /** Roving-tabindex cursor for the belt, so Tab enters it exactly once. */
  private beltFocus = 0;
  /** Roving-tabindex cursor for the tool cluster, for the same reason. */
  private toolFocus = 0;
  /**
   * Signature of the rendered belt, so we only rebuild when it truly changed.
   * `null`, not `''` — an empty inventory joins to the empty string, and a
   * sentinel of `''` would make the very first paint of a fresh game look
   * unchanged and leave the rail with no empty recesses in it at all.
   */
  private beltKey: string | null = null;
  /** Slot count at the last rebuild, so we can tell an arrival from a removal. */
  private beltCount = 0;
  /** False until the belt has been painted once; suppresses a phantom arrival. */
  private beltPainted = false;
  /** Last announced scene/act. `null` means "nothing rendered yet". */
  private announced: string | null = null;
  /** The single outstanding "stop announcing" timer, so re-arrivals restart it. */
  private announceTimer = 0;
  /** Label currently in the nameplate, so hover does not restart its fade. */
  private hoverLabel: string | null = null;

  private toastQueue: ToastRequest[] = [];
  private toastPumping = false;
  private mounted = false;
  private destroyed = false;

  constructor(state: GameState, cb: HudCallbacks) {
    this.state = state;
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Detective’s heads-up display');
    this.el.innerHTML = TEMPLATE;

    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
    this.placeEl = q('.hud__place');
    this.actEl = q('.hud__act');
    this.locationEl = q('.hud__location');
    this.subtitleEl = q('.hud__subtitle');
    this.toolsEl = q('.hud__tools');
    this.beltEl = q('.hud__belt');
    this.nameplateEl = q('.hud__nameplate');
    this.nameplateTextEl = q('.hud__nameplate-text');
    this.toastHostEl = q('.hud__toasts');

    this.buildTools();

    this.toolsEl.addEventListener('click', this.onToolClick);
    this.toolsEl.addEventListener('keydown', this.onToolKeyDown);
    this.beltEl.addEventListener('click', this.onBeltClick);
    this.beltEl.addEventListener('dblclick', this.onBeltDblClick);
    this.beltEl.addEventListener('keydown', this.onBeltKeyDown);
    this.beltEl.addEventListener('dragstart', this.onBeltDragStart);
    this.beltEl.addEventListener('dragend', this.onBeltDragEnd);
    this.beltEl.addEventListener('pointerover', this.onBeltPointerOver);
    this.beltEl.addEventListener('pointerout', this.onBeltPointerOut);
    this.beltEl.addEventListener('focusin', this.onBeltFocusIn);
    this.beltEl.addEventListener('focusout', this.onBeltFocusOut);
  }

  // -- lifecycle -----------------------------------------------------------

  /**
   * Attaches the HUD and starts tracking state. Guarded rather than documented
   * as single-use: a second `mount` would leak the first subscription, and a
   * silent double-refresh is far harder to notice than a no-op.
   */
  mount(parent: HTMLElement) {
    if (this.mounted || this.destroyed) return;
    this.mounted = true;
    parent.appendChild(this.el);
    this.unsubscribe = this.state.subscribe(() => this.refresh());
    this.refresh();
  }

  destroy() {
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.announceTimer = 0;
    // Never leave an awaited toast hanging — a stalled effect chain would
    // silently freeze the game on teardown.
    for (const settle of [...this.pending]) settle();
    this.pending.clear();
    for (const req of this.toastQueue) req.resolve();
    this.toastQueue = [];
    this.el.remove();
  }

  // -- public surface ------------------------------------------------------

  /** Re-reads state: location card, unread badges, belt contents, selection. */
  refresh() {
    if (this.destroyed) return;
    this.renderPlace();
    this.renderBadges();
    this.renderBelt();
  }

  /**
   * Shows a label in the centre nameplate — a hovered hotspot from `SceneView`,
   * or a hovered inventory slot from the belt below it. Pass `null` when the
   * pointer leaves. Fast in, slow out: the label should feel like it is
   * catching the light, not toggling.
   */
  setHovered(label: string | null) {
    const next = label || null;
    if (next === this.hoverLabel) return;
    this.hoverLabel = next;
    if (next) {
      this.nameplateTextEl.textContent = next;
      this.nameplateEl.classList.add('is-shown');
    } else {
      this.nameplateEl.classList.remove('is-shown');
    }
  }

  /**
   * Queues an acquisition card. Resolves once the card is up and has been
   * readable for a beat — not when it finally leaves — so a `giveItem` effect
   * paces the story without stalling it for three seconds. The queue
   * guarantees two cards never share the screen; back-to-back acquisitions are
   * therefore paced by the *previous* card's full dwell, which is the point.
   *
   * Takes a resolved title and icon rather than an id: the caller already had
   * to look the record up to play the right sound, and a toast for a missing
   * item should still read as a toast.
   */
  toast(kind: 'item' | 'clue', title: string, icon?: string): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.toastQueue.push({ kind, title, icon, resolve });
      void this.pumpToasts();
    });
  }

  /**
   * Lights the location card. Driven explicitly by the scene transition rather
   * than inferred from state, so the name lands with the artwork instead of a
   * frame before it.
   */
  announceLocation(name: string, subtitle?: string) {
    this.locationEl.textContent = name;
    this.subtitleEl.textContent = subtitle ?? '';
    this.subtitleEl.hidden = !subtitle;
    // Claim the current key so the state-driven path does not re-announce.
    this.announced = this.placeKey();
    this.announce();
  }

  /** Dialogue, puzzles and cinematics own the screen; the HUD steps aside. */
  setVisible(visible: boolean) {
    this.el.classList.toggle('is-hidden', !visible);
    // `inert` rather than a tabindex sweep: it removes the whole subtree from
    // the tab order *and* the accessibility tree, and restores it exactly as
    // it was, which a manual sweep cannot promise once slots are rebuilt.
    this.el.inert = !visible;
    if (!visible) this.setHovered(null);
  }

  /**
   * Reflects the carried item. Called by the integration layer rather than set
   * locally, so selection stays consistent if something else (a puzzle, a
   * dialogue branch) puts the item away.
   */
  setSelectedItem(itemId: string | null) {
    this.selectedItem = itemId;
    // Scoped to real slots: the empty recesses are `aria-hidden` scenery and
    // must never grow a pressed state.
    for (const slot of this.beltEl.querySelectorAll<HTMLElement>('.hud-slot[data-item]')) {
      const on = !!itemId && slot.dataset.item === itemId;
      slot.classList.toggle('is-selected', on);
      slot.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // -- location card -------------------------------------------------------

  private placeKey() {
    return `${this.state.act}/${this.state.scene}`;
  }

  private renderPlace() {
    const scene = this.state.content.scenes[this.state.scene];
    const act = this.state.content.acts.find((a) => a.number === this.state.act);

    this.actEl.textContent = act
      ? `Act ${roman(act.number)} · ${act.title}`
      : `Act ${roman(this.state.act)}`;
    this.locationEl.textContent = scene?.name ?? '';
    this.subtitleEl.textContent = scene?.subtitle ?? '';
    this.subtitleEl.hidden = !scene?.subtitle;

    const key = this.placeKey();
    if (key === this.announced) return;

    // The very first paint happens while the title screen is still up, before
    // the player has arrived anywhere. Adopt the key silently; only a genuine
    // *change* of place (or act) earns the player's attention. `goto` normally
    // gets there first via `announceLocation`, leaving this path to catch act
    // turns and loaded saves.
    const first = this.announced === null;
    this.announced = key;
    if (!first) this.announce();
  }

  private announce() {
    this.placeEl.classList.remove('is-announcing');
    // Restart the animation rather than let it continue from mid-fade.
    void this.placeEl.offsetWidth;
    this.placeEl.classList.add('is-announcing');
    // One timer, not one per announcement: two arrivals in quick succession
    // must not let the first one's timer cut the second one short.
    if (this.announceTimer) {
      clearTimeout(this.announceTimer);
      this.timers.delete(this.announceTimer);
    }
    this.announceTimer = this.after(MS_ANNOUNCE, () => {
      this.announceTimer = 0;
      this.placeEl.classList.remove('is-announcing');
    });
  }

  // -- top-right tools -----------------------------------------------------

  private buildTools() {
    for (const [i, tool] of TOOLS.entries()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'brass-btn hud__tool';
      btn.dataset.tool = tool.id;
      btn.dataset.label = tool.label;
      btn.dataset.key = tool.key;
      // Roving tabindex: the cluster is one Tab stop, arrows move inside it.
      btn.tabIndex = i === 0 ? 0 : -1;
      btn.setAttribute('aria-label', `${tool.label} (${tool.key})`);
      btn.setAttribute('aria-keyshortcuts', tool.shortcut);
      btn.innerHTML =
        `<span class="brass-btn__face" aria-hidden="true">${tool.icon}</span>` +
        `<span class="hud__tool-key" aria-hidden="true">${tool.key}</span>` +
        `<span class="hud__badge" data-badge="${tool.id}" aria-hidden="true" hidden></span>`;
      this.toolsEl.appendChild(btn);
    }
  }

  private renderBadges() {
    this.setBadge('journal', this.state.unreadClues.size);
    this.setBadge('inventory', this.state.unreadItems.size);
  }

  /**
   * Unread counts. The badge itself is decorative (`aria-hidden`) — the count
   * folds into the button's accessible name instead, because a bare "3"
   * floating next to "Journal" tells a screen-reader user nothing.
   */
  private setBadge(tool: HudTool, count: number) {
    const btn = this.toolsEl.querySelector<HTMLElement>(`[data-tool="${tool}"]`);
    const el = this.toolsEl.querySelector<HTMLElement>(`[data-badge="${tool}"]`);
    if (!btn || !el) return;

    const shown = count > 0;
    // Compare against the *rendered* label, not the raw count: with a naive
    // `!== String(count)` a count of 10 renders "9+", never matches, and
    // re-fires the bump animation on every single state change.
    const label = count > 9 ? '9+' : String(count);
    if (shown && el.textContent !== label) {
      el.textContent = label;
      el.classList.remove('is-bumped');
      void el.offsetWidth;
      el.classList.add('is-bumped');
    }
    if (!shown) el.textContent = '';
    el.hidden = !shown;

    // Only write when it actually changed: rewriting the accessible name of a
    // focused control makes a screen reader re-announce the whole button.
    const base = `${btn.dataset.label} (${btn.dataset.key})`;
    const name = shown ? `${base}, ${count} new` : base;
    if (btn.getAttribute('aria-label') !== name) btn.setAttribute('aria-label', name);
  }

  private onToolClick = (ev: Event) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-tool]');
    if (!btn) return;
    this.focusTool(btn);
    this.cb.onSound?.('click-brass');
    switch (btn.dataset.tool as HudTool) {
      case 'journal':
        this.cb.onOpenJournal();
        break;
      case 'inventory':
        this.cb.onOpenInventory();
        break;
      case 'map':
        this.cb.onOpenMap();
        break;
      case 'hints':
        this.cb.onHint();
        break;
      case 'menu':
        this.cb.onMenu();
        break;
    }
  };

  /**
   * Toolbar keyboard model. Space needs claiming explicitly: the global
   * hold-to-reveal binding calls `preventDefault` on it at the window, which
   * would otherwise swallow the button's own activation.
   */
  private onToolKeyDown = (ev: KeyboardEvent) => {
    const btns = [...this.toolsEl.querySelectorAll<HTMLElement>('[data-tool]')];
    if (!btns.length) return;
    const current = btns.findIndex((b) => b === document.activeElement);

    if (ev.key === ' ' || ev.key === 'Spacebar') {
      if (current < 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      btns[current]!.click();
      return;
    }

    let next = -1;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
      next = current < 0 ? 0 : (current + 1) % btns.length;
    } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
      next = current < 0 ? btns.length - 1 : (current - 1 + btns.length) % btns.length;
    } else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = btns.length - 1;
    else return;

    ev.preventDefault();
    ev.stopPropagation();
    this.focusTool(btns[next]!);
    btns[next]!.focus();
  };

  /** Moves the cluster's single tab stop onto `btn`. */
  private focusTool(btn: HTMLElement) {
    const btns = [...this.toolsEl.querySelectorAll<HTMLElement>('[data-tool]')];
    this.toolFocus = Math.max(0, btns.indexOf(btn));
    for (const [i, b] of btns.entries()) b.tabIndex = i === this.toolFocus ? 0 : -1;
  }

  // -- inventory belt ------------------------------------------------------

  private renderBelt() {
    const ids = [...this.state.items];
    const key = ids.join('|');
    if (key === this.beltKey) {
      this.markUnread(ids);
      return;
    }

    // An arrival is a net gain since the last paint; a `takeItem` must not
    // make the surviving right-hand slot drop out of the sky.
    const arrived = this.beltPainted && ids.length > this.beltCount;
    this.beltKey = key;
    this.beltCount = ids.length;
    this.beltPainted = true;

    // Rebuilding blows focus away. Remember whether we had it so we can put it
    // back on the equivalent slot — otherwise picking something up mid-keyboard
    // navigation silently dumps the player back at the top of the tab order.
    const hadFocus = this.beltEl.contains(document.activeElement);

    this.beltEl.textContent = '';
    this.beltFocus = Math.min(this.beltFocus, Math.max(0, ids.length - 1));

    ids.forEach((id, i) => {
      const item = this.lookupItem(id);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'hud-slot';
      slot.dataset.item = id;
      slot.draggable = true;
      slot.tabIndex = i === this.beltFocus ? 0 : -1;
      slot.setAttribute('aria-pressed', id === this.selectedItem ? 'true' : 'false');
      slot.setAttribute('aria-label', item ? item.name : id);
      if (id === this.selectedItem) slot.classList.add('is-selected');
      // Only the newest slot should pop; the rest are already on the belt.
      if (arrived && i === ids.length - 1) {
        slot.classList.add('is-arriving');
        // The class has to come off once it has played, or its filled keyframes
        // would out-rank the hover and selected transforms for good.
        slot.addEventListener('animationend', () => slot.classList.remove('is-arriving'), {
          once: true,
        });
      }
      slot.innerHTML =
        `<span class="hud-slot__well">${artFor(item?.icon, item?.name ?? id)}</span>` +
        `<span class="hud-slot__rim" aria-hidden="true"></span>`;
      wireArt(slot);
      this.beltEl.appendChild(slot);
    });

    for (let i = ids.length; i < BELT_SLOTS; i++) {
      const empty = document.createElement('div');
      empty.className = 'hud-slot hud-slot--empty';
      empty.setAttribute('aria-hidden', 'true');
      empty.innerHTML = '<span class="hud-slot__well"></span><span class="hud-slot__rim"></span>';
      this.beltEl.appendChild(empty);
    }

    // Let the rail size its own slots down once the belt outgrows its minimum,
    // so a fat late-game inventory can never push past the edge of the stage.
    this.beltEl.style.setProperty('--slot-count', String(Math.max(BELT_SLOTS, ids.length)));

    this.markUnread(ids);

    if (hadFocus) {
      const slots = this.beltEl.querySelectorAll<HTMLElement>('.hud-slot[data-item]');
      slots[this.beltFocus]?.focus();
    }
  }

  private markUnread(ids: string[]) {
    for (const id of ids) {
      const slot = this.beltEl.querySelector<HTMLElement>(
        `.hud-slot[data-item="${cssEscape(id)}"]`,
      );
      slot?.classList.toggle('is-unread', this.state.unreadItems.has(id));
    }
  }

  /** Content may not exist yet (or an id may be stale); never throw over it. */
  private lookupItem(id: string): Item | undefined {
    return this.state.content?.items?.[id];
  }

  private onBeltClick = (ev: MouseEvent) => {
    // A double-click fires click twice; the second one must not toggle back.
    if (ev.detail > 1) return;
    const slot = (ev.target as HTMLElement).closest<HTMLElement>('.hud-slot[data-item]');
    if (!slot) return;
    const id = slot.dataset.item!;
    this.rememberBeltFocus(slot);
    this.select(id === this.selectedItem ? null : id);
  };

  private onBeltDblClick = (ev: MouseEvent) => {
    const slot = (ev.target as HTMLElement).closest<HTMLElement>('.hud-slot[data-item]');
    if (!slot) return;
    this.cb.onExamineItem(slot.dataset.item!);
  };

  /**
   * Belt keyboard model. Everything handled here also stops propagating:
   * Escape would otherwise open the pause menu on the way to the window, and
   * Space is claimed by hold-to-reveal.
   */
  private onBeltKeyDown = (ev: KeyboardEvent) => {
    const slots = [...this.beltEl.querySelectorAll<HTMLElement>('.hud-slot[data-item]')];
    if (!slots.length) return;
    const current = slots.findIndex((s) => s === document.activeElement);

    if (ev.key === 'Escape') {
      if (!this.selectedItem) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.select(null);
      return;
    }

    if (ev.key === 'Enter' && current >= 0) {
      // Enter on an already-selected slot means "look closer" — the keyboard
      // equivalent of the double-click. Otherwise the button's own default
      // activation runs and lands in `onBeltClick`.
      const id = slots[current]!.dataset.item!;
      if (id === this.selectedItem) {
        ev.preventDefault();
        this.cb.onExamineItem(id);
      }
      return;
    }

    if (ev.key === ' ' || ev.key === 'Spacebar') {
      if (current < 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const id = slots[current]!.dataset.item!;
      this.select(id === this.selectedItem ? null : id);
      return;
    }

    let next = -1;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
      next = current < 0 ? 0 : (current + 1) % slots.length;
    } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
      next = current < 0 ? slots.length - 1 : (current - 1 + slots.length) % slots.length;
    } else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = slots.length - 1;
    else return;

    ev.preventDefault();
    ev.stopPropagation();
    this.beltFocus = next;
    for (const [i, s] of slots.entries()) s.tabIndex = i === next ? 0 : -1;
    slots[next]!.focus();
  };

  /** Keeps the tab stop where the player last touched, mouse or keyboard. */
  private rememberBeltFocus(slot: HTMLElement) {
    const slots = [...this.beltEl.querySelectorAll<HTMLElement>('.hud-slot[data-item]')];
    const i = slots.indexOf(slot);
    if (i < 0) return;
    this.beltFocus = i;
    for (const [n, s] of slots.entries()) s.tabIndex = n === i ? 0 : -1;
  }

  /** Hovering a slot borrows the hotspot nameplate rather than a browser tooltip. */
  private onBeltPointerOver = (ev: PointerEvent) => {
    const slot = (ev.target as HTMLElement).closest<HTMLElement>('.hud-slot[data-item]');
    if (!slot) return;
    const id = slot.dataset.item!;
    this.setHovered(this.lookupItem(id)?.name ?? id);
  };

  private onBeltPointerOut = (ev: PointerEvent) => {
    const to = ev.relatedTarget as HTMLElement | null;
    if (to && to.closest?.('.hud-slot[data-item]')) return;
    this.setHovered(null);
  };

  private onBeltFocusIn = (ev: FocusEvent) => {
    const slot = (ev.target as HTMLElement).closest<HTMLElement>('.hud-slot[data-item]');
    if (!slot) return;
    const id = slot.dataset.item!;
    this.setHovered(this.lookupItem(id)?.name ?? id);
  };

  private onBeltFocusOut = (ev: FocusEvent) => {
    const to = ev.relatedTarget as HTMLElement | null;
    if (to && this.beltEl.contains(to)) return;
    this.setHovered(null);
  };

  private onBeltDragStart = (ev: DragEvent) => {
    const slot = (ev.target as HTMLElement).closest<HTMLElement>('.hud-slot[data-item]');
    if (!slot) return;
    if (!ev.dataTransfer) {
      // No transfer object means no drop payload could ever arrive; refusing
      // the drag outright beats dragging a ghost that can never be delivered.
      ev.preventDefault();
      return;
    }
    const id = slot.dataset.item!;
    // `text/item` is the contract SceneView reads on drop.
    ev.dataTransfer.setData('text/item', id);
    ev.dataTransfer.setData('text/plain', this.lookupItem(id)?.name ?? id);
    ev.dataTransfer.effectAllowed = 'copy';
    slot.classList.add('is-dragging');
    // Dragging *is* picking up, so the scene should light its valid targets at
    // once — but only if the item is not already in hand, because `select` is
    // a toggle and would otherwise put it straight back down.
    if (id !== this.selectedItem) this.select(id);
  };

  private onBeltDragEnd = () => {
    // Sweep rather than target the source node: a state change mid-drag can
    // rebuild the belt, and the element the drag started on may be long gone.
    for (const s of this.beltEl.querySelectorAll<HTMLElement>('.hud-slot.is-dragging')) {
      s.classList.remove('is-dragging');
    }
  };

  private select(id: string | null) {
    this.setSelectedItem(id);
    this.cb.onSelectItem(id);
  }

  // -- toasts --------------------------------------------------------------

  private async pumpToasts() {
    if (this.toastPumping) return;
    this.toastPumping = true;
    try {
      while (this.toastQueue.length && !this.destroyed) {
        const req = this.toastQueue.shift()!;
        try {
          await this.showToast(req);
        } catch (err) {
          // A card that fails to render is a cosmetic problem. Letting its
          // promise hang would be a frozen game, so the chain is released
          // either way — `resolve` is idempotent.
          console.error('hud: toast failed', err);
        } finally {
          req.resolve();
        }
      }
    } finally {
      this.toastPumping = false;
    }
  }

  private async showToast(req: ToastRequest) {
    const enter = REDUCED() ? 90 : MS_ENTER;
    const exit = REDUCED() ? 90 : MS_EXIT;

    const card = document.createElement('div');
    card.className = 'hud-toast';
    card.dataset.kind = req.kind;

    // A clue has no art of its own — it is a note, so it gets the index card.
    const art = req.kind === 'clue' ? CLUE_MARK : artFor(req.icon, req.title);

    card.innerHTML =
      `<span class="hud-toast__art" aria-hidden="true">${art}</span>` +
      '<span class="hud-toast__text">' +
      `<span class="hud-toast__kicker">${
        req.kind === 'item' ? 'Item acquired' : 'Clue recorded'
      }</span>` +
      `<span class="hud-toast__title">${escapeHtml(req.title)}</span>` +
      '</span>';

    wireArt(card);
    this.toastHostEl.appendChild(card);

    // A forced reflow, deliberately NOT requestAnimationFrame: rAF is paused in
    // a background tab, and this sequence is awaited by the effect chain. A
    // player who alt-tabs mid-pickup would otherwise come back to a frozen game.
    void card.offsetWidth;
    card.classList.add('is-in');

    await this.sleep(enter);
    // The card is up. Hold the effect chain only long enough for the player to
    // register it, then release — the dwell and the exit play out behind
    // whatever happens next, and the queue keeps cards from stacking.
    await this.sleep(MS_ACK);
    req.resolve();

    await this.sleep(Math.max(0, MS_HOLD - MS_ACK));
    card.classList.remove('is-in');
    await this.sleep(exit);
    card.remove();
  }

  // -- timing helpers ------------------------------------------------------

  /** setTimeout that cannot outlive the HUD. Returns the id so callers can cancel. */
  private after(ms: number, fn: () => void): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  /**
   * Cancellable delay. Teardown settles every outstanding sleep instead of
   * dropping it, because the toast sequence awaits these — an abandoned timer
   * would strand a `giveItem` effect and hang the whole chain.
   */
  private sleep(ms: number): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((resolve) => {
      const settle = () => {
        this.pending.delete(settle);
        resolve();
      };
      this.pending.add(settle);
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        settle();
      }, ms);
      this.timers.add(id);
    });
  }
}

// ---------------------------------------------------------------------------
// Static template & glyphs
// ---------------------------------------------------------------------------

/**
 * Engraved brass glyphs. Stroked rather than filled and drawn on a 24-unit
 * grid so they read as tooling marks in metal at any HUD scale; the etched
 * highlight is a CSS drop-shadow, not a second path.
 */
const ICON = {
  journal:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6.6 3.5h11a1 1 0 0 1 1 1v16H8.1a1.5 1.5 0 0 1-1.5-1.5Z"/>' +
    '<path d="M6.6 17.6a1.5 1.5 0 0 1 1.5-1.4h10.5"/>' +
    '<path d="M13 3.5v6l2-1.4 2 1.4v-6"/>' +
    '<path d="M9.4 8h1.8M9.4 11h1.8"/></svg>',
  inventory:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.8 8.6h14.4l-1 11.4a1 1 0 0 1-1 .9H6.8a1 1 0 0 1-1-.9Z"/>' +
    '<path d="M8.6 8.6V6.9a3.4 3.4 0 0 1 6.8 0v1.7"/>' +
    '<path d="M9.6 13.4h4.8"/></svg>',
  map:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3.2 6.6 9 4.6l6 2 5.8-2v12.8l-5.8 2-6-2-5.8 2Z"/>' +
    '<path d="M9 4.6v12.8M15 6.6v12.8"/>' +
    '<path d="m12.4 10.6-.9 1.6 1.7.5"/></svg>',
  hints:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 5.2a3 3 0 0 1 6 0"/>' +
    '<path d="M7.4 6.8h9.2"/>' +
    '<path d="M8.6 6.8 7.6 16.6h8.8l-1-9.8"/>' +
    '<path d="M6.6 16.6h10.8l-.6 3.6H7.2Z"/>' +
    '<path d="M12 9.6c1.5 1.4 1.5 2.9 0 4.3-1.5-1.4-1.5-2.9 0-4.3Z"/></svg>',
  menu:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M5 7.5h14M5 12h10M5 16.5h14"/>' +
    '<path d="m18.4 12 1.6-1.6L21.6 12 20 13.6Z" stroke-linejoin="round"/></svg>',
} as const;

/** A pinned index card — the visual shorthand for evidence in the journal. */
const CLUE_MARK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4.5 5.5h15v13h-15Z"/><path d="M7.5 9.5h9M7.5 12.5h9M7.5 15.5h5"/>' +
  '<circle cx="12" cy="5.5" r="1.6"/></svg>';

/** `key` is the stamped cap; `shortcut` is the `aria-keyshortcuts` token. */
const TOOLS: {
  id: HudTool;
  label: string;
  key: string;
  shortcut: string;
  icon: string;
}[] = [
  { id: 'journal', label: 'Journal', key: 'J', shortcut: 'J', icon: ICON.journal },
  { id: 'inventory', label: 'Inventory', key: 'I', shortcut: 'I', icon: ICON.inventory },
  { id: 'map', label: 'Map', key: 'M', shortcut: 'M', icon: ICON.map },
  { id: 'hints', label: 'Hints', key: 'H', shortcut: 'H', icon: ICON.hints },
  { id: 'menu', label: 'Menu', key: 'Esc', shortcut: 'Escape', icon: ICON.menu },
];

const TEMPLATE = `
  <div class="hud__stage stage-box">
    <div class="hud__place">
      <span class="hud__act"></span>
      <span class="hud__location"></span>
      <span class="hud__subtitle"></span>
    </div>
    <div class="hud__tools" role="toolbar" aria-label="Case tools" aria-orientation="horizontal"></div>
    <div class="hud__nameplate" aria-hidden="true"><span class="hud__nameplate-text"></span></div>
    <div class="hud__belt" role="toolbar" aria-label="Carried items" aria-orientation="horizontal"></div>
    <div class="hud__toasts" role="status" aria-live="polite"></div>
  </div>`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Item art, degrading in three steps: the painted icon, then a monogram
 * pressed into the slot, then the raw id. Content is authored by another
 * workflow and may lag the code, so a missing item must look deliberate
 * rather than broken.
 */
function artFor(icon: string | undefined, name: string): string {
  const fallback = `<span class="hud-slot__mono" aria-hidden="true">${escapeHtml(monogram(name))}</span>`;
  if (!icon) return fallback;
  // Both are rendered; CSS hides the monogram while real art is present, and
  // `wireArt` drops the image if it 404s, revealing the monogram again.
  return `<img class="hud-slot__art" src="${escapeHtml(icon)}" alt="" draggable="false">${fallback}`;
}

/** Removes item art that failed to load so the monogram can take over. */
function wireArt(root: HTMLElement) {
  const img = root.querySelector<HTMLImageElement>('.hud-slot__art');
  if (img) img.addEventListener('error', () => img.remove(), { once: true });
}

/** First letters of up to two words — enough to tell two keys apart. */
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

/** Escapes for both text and double-quoted attribute contexts. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Attribute-selector safety: item ids come from content, not from code. */
function cssEscape(s: string): string {
  return CSS.escape(s);
}
