/**
 * Front of house: the title screen, the pause menu, settings, save/load and
 * the closing dossier.
 *
 * These are the only surfaces a player sees before the game has earned any
 * goodwill, so they are held to the same standard as the artwork: every plate
 * is a lit physical object, every transition settles rather than snaps, and
 * nothing here is a browser control wearing a costume. The custom sliders,
 * switches and segmented pickers exist because a native `<input type=range>`
 * cannot be made to look like brass, and because faking one with a background
 * image loses the keyboard semantics that make it usable in the first place —
 * so each one re-implements the ARIA contract properly instead.
 *
 * The module also owns the *settings model*. `applySettings` is the single
 * bridge between player preference and the rest of the game: it writes CSS
 * custom properties and `data-*` attributes onto `<html>` so every other
 * subsystem reacts declaratively in CSS, and pushes the mixer values into the
 * shared audio engine. Nothing else needs to import this file to honour a
 * setting — it just reads the attribute.
 */

import { audio } from '@/engine/audio';
import { SAVE_SLOTS, clearSlot, listSlots, readSlot } from '@/engine/state';
import type { GameState, SaveMeta, SaveSlot } from '@/engine/state';
import { Weather } from '@/engine/weather';

// ---------------------------------------------------------------------------
// Settings model
// ---------------------------------------------------------------------------

/** How aggressively the world hints at what can be clicked. */
export type HotspotHighlight = 'off' | 'hover' | 'always';

/** Narration reveal rate. `instant` prints a whole line at once. */
export type TextSpeed = 'slow' | 'normal' | 'instant';

/**
 * Everything the player can tune, in one flat, serialisable record.
 *
 * Flat rather than nested by section: the sections are a *presentation*
 * grouping that we expect to re-shuffle as the panel grows, and a nested shape
 * would force a migration every time a control moved between tabs.
 */
export interface Settings {
  // -- Audio (linear 0..1 gains, mirroring the mixer) ------------------------
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  muted: boolean;

  // -- Display ---------------------------------------------------------------
  /** Multiplier on the whole frame, 0.75..1.25. 1 leaves the image untouched. */
  brightness: number;
  /** Multiplier on the whole frame, 0.85..1.2. */
  contrast: number;
  /** The global emulsion pass. Off for players who read it as dirt. */
  filmGrain: boolean;
  /** Canvas rain/snow/fog over scenes. Off is also the low-power option. */
  weatherEffects: boolean;
  /** Per-scene colour grading. Off shows the paintings as authored. */
  colourGrade: boolean;
  /** Forces the reduced-motion token collapse on, even if the OS says nothing. */
  reduceMotion: boolean;
  /** Mirrors the document's fullscreen state; only ever changed by a gesture. */
  fullscreen: boolean;

  // -- Gameplay --------------------------------------------------------------
  hotspotHighlight: HotspotHighlight;
  textSpeed: TextSpeed;
  subtitles: boolean;
  /** Seconds between hints. 0 means "never make me wait". */
  hintCooldown: number;
  /** Forgiving puzzles: a wrong answer costs a beat, not the whole board. */
  secondChance: boolean;

  // -- Accessibility ---------------------------------------------------------
  /** Percent, 90..130. Scales the root font size, and so the whole UI. */
  uiScale: number;
  /** Swaps the serifs for a wide, high-legibility stack. */
  dyslexiaFont: boolean;
  /** Lifts body text off the artwork; costs some atmosphere, on purpose. */
  highContrast: boolean;
  /** Puzzles must not encode meaning in hue alone while this is on. */
  colourBlindSafe: boolean;
}

const SETTINGS_KEY = 'lamplight.settings';

/**
 * The shipped defaults. Audio defaults are deliberately absent here — they are
 * seeded from the live mixer in {@link loadSettings}, because the audio engine
 * persists its own levels and must stay the single source of truth for them.
 */
const DEFAULTS: Omit<Settings, 'master' | 'music' | 'ambience' | 'sfx' | 'muted'> = {
  brightness: 1,
  contrast: 1,
  filmGrain: true,
  weatherEffects: true,
  colourGrade: true,
  reduceMotion: false,
  fullscreen: false,
  hotspotHighlight: 'hover',
  textSpeed: 'normal',
  subtitles: true,
  hintCooldown: 45,
  secondChance: true,
  uiScale: 100,
  dyslexiaFont: false,
  highContrast: false,
  colourBlindSafe: false,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Reads persisted settings, falling back field-by-field.
 *
 * Per-field rather than all-or-nothing: adding a control in a later build must
 * not silently reset a returning player's entire configuration, so an unknown
 * or corrupt field takes its default while everything else survives.
 */
export function loadSettings(): Settings {
  const levels = audio.levels;
  const base: Settings = {
    master: levels.master,
    music: levels.music,
    ambience: levels.ambience,
    sfx: levels.sfx,
    muted: levels.muted,
    ...DEFAULTS,
  };

  let stored: Partial<Settings> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<Settings>;
  } catch {
    // Private mode, quota, or a hand-edited value: defaults are always valid.
    stored = {};
  }

  const num = (v: unknown, fallback: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;

  return {
    master: num(stored.master, base.master, 0, 1),
    music: num(stored.music, base.music, 0, 1),
    ambience: num(stored.ambience, base.ambience, 0, 1),
    sfx: num(stored.sfx, base.sfx, 0, 1),
    muted: bool(stored.muted, base.muted),

    brightness: num(stored.brightness, base.brightness, 0.75, 1.25),
    contrast: num(stored.contrast, base.contrast, 0.85, 1.2),
    filmGrain: bool(stored.filmGrain, base.filmGrain),
    weatherEffects: bool(stored.weatherEffects, base.weatherEffects),
    colourGrade: bool(stored.colourGrade, base.colourGrade),
    reduceMotion: bool(stored.reduceMotion, base.reduceMotion),
    // Never trust a stored `true` here: a reload starts windowed, and claiming
    // otherwise would leave the toggle lying about the document's real state.
    fullscreen: typeof document !== 'undefined' && !!document.fullscreenElement,

    hotspotHighlight: oneOf(stored.hotspotHighlight, ['off', 'hover', 'always'], base.hotspotHighlight),
    textSpeed: oneOf(stored.textSpeed, ['slow', 'normal', 'instant'], base.textSpeed),
    subtitles: bool(stored.subtitles, base.subtitles),
    hintCooldown: num(stored.hintCooldown, base.hintCooldown, 0, 180),
    secondChance: bool(stored.secondChance, base.secondChance),

    uiScale: num(stored.uiScale, base.uiScale, 90, 130),
    dyslexiaFont: bool(stored.dyslexiaFont, base.dyslexiaFont),
    highContrast: bool(stored.highContrast, base.highContrast),
    colourBlindSafe: bool(stored.colourBlindSafe, base.colourBlindSafe),
  };
}

/** Persists settings. Failure is silent: a locked store must not break play. */
export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Publishes settings to the document so the rest of the game can react in CSS.
 *
 * Two channels, chosen by what the value *is*: continuous quantities become
 * custom properties (so they can be interpolated and composed into filters),
 * discrete modes become `data-*` attributes (so stylesheets can switch on
 * them). Subsystems never import this module or subscribe to anything — they
 * simply live under `:root[data-grain='off']`, which means a setting can never
 * fall out of sync with the thing it controls.
 *
 * Fullscreen is the one setting this function will not enforce: entering
 * fullscreen requires a user gesture, so the toggle drives the document
 * directly and this only records the result.
 */
export function applySettings(s: Settings): void {
  const root = document.documentElement;

  // -- Mixer ---------------------------------------------------------------
  audio.setLevel('master', s.master);
  audio.setLevel('music', s.music);
  audio.setLevel('ambience', s.ambience);
  audio.setLevel('sfx', s.sfx);
  audio.setMuted(s.muted);

  // -- Continuous values ---------------------------------------------------
  root.style.setProperty('--display-brightness', String(s.brightness));
  root.style.setProperty('--display-contrast', String(s.contrast));
  root.style.setProperty('--ui-scale', String(s.uiScale / 100));

  // The whole scale is in rem, so the root font size *is* the UI scale. 100%
  // resolves to the player's own browser default rather than a hard 16px, so
  // someone who has already enlarged their text keeps that on top of ours.
  root.style.fontSize = s.uiScale === 100 ? '' : `${s.uiScale}%`;

  // Grading the frame costs a compositing layer, so only pay for it when the
  // player has actually moved a slider off centre.
  const graded = s.brightness !== 1 || s.contrast !== 1;
  document.body.style.filter = graded
    ? `brightness(${s.brightness}) contrast(${s.contrast})`
    : '';

  // -- Discrete modes ------------------------------------------------------
  root.dataset.grain = s.filmGrain ? 'on' : 'off';
  root.dataset.weather = s.weatherEffects ? 'on' : 'off';
  root.dataset.grade = s.colourGrade ? 'on' : 'off';
  root.dataset.motion = s.reduceMotion ? 'reduced' : 'full';
  root.dataset.hotspots = s.hotspotHighlight;
  root.dataset.textSpeed = s.textSpeed;
  root.dataset.subtitles = s.subtitles ? 'on' : 'off';
  root.dataset.secondChance = s.secondChance ? 'on' : 'off';
  root.dataset.dyslexia = s.dyslexiaFont ? 'on' : 'off';
  root.dataset.contrastBoost = s.highContrast ? 'on' : 'off';
  root.dataset.cbSafe = s.colourBlindSafe ? 'on' : 'off';
  root.dataset.hintCooldown = String(s.hintCooldown);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Shown quietly on the title screen. Kept in step with package.json by hand. */
const BUILD_VERSION = '1.0.0';

/**
 * The title plate, relit and resampled from the generated key art by
 * `tools/cook-title-plate.mjs`. The raw generation has the lantern dark, which
 * leaves the title screen with no key light at all; the cooked plate burns it.
 */
const KEY_ART = './art/ui/title-plate.webp';

/**
 * The drawn title wordmark, from `tools/generate-wordmark.mjs`.
 *
 * Gold on a transparent field, keyed out of a black plate rather than
 * requested as alpha — the mark *is* light, so a luminance key leaves each
 * stroke's bloom falling off naturally into the storm behind it.
 */
const WORDMARK = './art/ui/wordmark.webp';

/** Small numbers read as words in a title card; '5 acts' reads as marketing. */
const NUMERALS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
] as const;
const spellOut = (n: number) => NUMERALS[n] ?? String(n);

/**
 * Reads a duration token off the document root, in milliseconds.
 *
 * A screen's exit is choreographed in CSS but *timed* here, because the
 * caller's promise must not settle until the layer has actually gone. Reading
 * the token beats duplicating its value: the two can never drift, and the
 * reduced-motion collapse in `tokens.css` is picked up for free — where a
 * hardcoded 460 ms would leave a half-second of dead air on a screen the player
 * has already dismissed.
 */
function tokenMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = raw.endsWith('ms')
    ? Number.parseFloat(raw)
    : raw.endsWith('s')
      ? Number.parseFloat(raw) * 1000
      : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Mirrors `.menu-layer.is-out`, so a promise settles exactly as the layer goes. */
const exitMs = () => tokenMs('--dur-med', 260);

/** How long the dossier is allowed to settle before the seal comes down on it. */
const sealDelayMs = () => tokenMs('--dur-scene', 620) * 1.5;

/** Farthest the key art may drift under the pointer, in px. Any more reads as wobble. */
const PARALLAX_MAX = 14;

/**
 * Flags any of which mean "the player named the right person".
 *
 * Several are accepted because the story workflow owns the real flag name and
 * this screen must not be the thing that blocks on it; the dossier degrades to
 * "unresolved" rather than guessing wrong.
 */
const CULPRIT_FLAGS = ['culpritIdentified', 'accusedCorrectly', 'namedTheCulprit'] as const;

/** Queried once: a fresh MediaQueryList per call is garbage on every keypress. */
const motionQuery =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * True when travel should be suppressed.
 *
 * Reads the in-game override as well as the OS preference, because choosing
 * "reduce motion" in settings has to be indistinguishable from asking the
 * system for it — including for the sequences JS drives by hand.
 */
const REDUCED = () =>
  document.documentElement.dataset.motion === 'reduced' || !!motionQuery?.matches;

/**
 * Tab stops inside a screen.
 *
 * Roving-tabindex members (`tabindex="-1"`) are excluded on purpose: they are
 * reachable with the arrow keys, and letting focus restoration land on one
 * would strand the player in the middle of a group with no way back out.
 */
const FOCUSABLE =
  ':is(a[href], button, input, select, textarea, [tabindex]):not([disabled]):not([tabindex="-1"]):not([inert])';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Playtime as `h:mm`, the way a case file would log it. */
function formatPlaytime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** A save's age in words, so a slot list reads as history rather than epochs. */
function formatRelative(ts: number): string {
  const delta = Date.now() - ts;
  const mins = Math.round(delta / 60_000);
  if (mins < 1) return 'moments ago';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Roman numerals for act headings — the acts are titled, not numbered. */
function roman(n: number): string {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = Math.max(0, Math.floor(n));
  let out = '';
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out || '—';
}

/** `auto` is written by the engine; the numbered slots belong to the player. */
const slotLabel = (slot: SaveSlot) => (slot === 'auto' ? 'Autosave' : `Case File ${slot}`);

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${++uid}`;

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

interface ScreenHandle {
  layer: HTMLElement;
  /** Settles the screen with its escape/forced value, without animation. */
  hardClose(): void;
}

interface PresentOptions<T> {
  /** Accessible name for the dialog. */
  label: string;
  /** What Escape resolves to. Omitted means Escape is ignored on this screen. */
  escape?: () => T;
  /** What `forceClose()` resolves to. Defaults to the escape value. */
  forced?: () => T;
  /** Which element takes focus once the screen has settled in. */
  autofocus?(layer: HTMLElement): HTMLElement | null;
  /** Torn down after the exit transition — canvases, observers, timers. */
  cleanup?(): void;
}

/**
 * A settings control and the handle needed to correct it.
 *
 * `set` repaints without firing the change callback: it exists for the cases
 * where the truth lives somewhere else — the mixer, the document's fullscreen
 * state — and echoing that back as a player edit would be a feedback loop.
 */
interface Control<T> {
  el: HTMLElement;
  set(value: T): void;
}

/**
 * Is this a real control that can take focus right now?
 *
 * `<body>` passes every naive test and is what `document.activeElement` reports
 * when nothing is focused, so restoring to it would look like success and do
 * nothing — the check is deliberately for an interactive, rendered, non-inert
 * element and nothing else.
 */
const focusable = (node: Element | null | undefined): node is HTMLElement =>
  !!node &&
  node instanceof HTMLElement &&
  node.isConnected &&
  node.matches(FOCUSABLE) &&
  !node.closest('[inert]') &&
  node.getClientRects().length > 0;

/**
 * All the game's non-diegetic screens.
 *
 * One instance lives for the whole session and is mounted once into the
 * overlay root; each method opens a screen, awaits a decision and resolves
 * *after* the exit transition, so the caller's next beat never overlaps the
 * one it just closed.
 */
export class Menus {
  readonly el: HTMLElement;

  private state: GameState;
  private settingsModel: Settings;
  /** Open screens, innermost last. A confirm sits on top of its opener. */
  private screens: ScreenHandle[] = [];
  private timers = new Set<number>();
  private mounted = false;
  /** Weather rigs owned by the title screen, torn down when it leaves. */
  private weatherOnTitle: Weather[] = [];
  /**
   * Everything outside the menu layer that we made `inert` while a screen is
   * open, so it can be handed back exactly as it was found.
   */
  private silenced: HTMLElement[] = [];

  constructor(state: GameState) {
    this.state = state;
    this.settingsModel = loadSettings();

    // A pane of glass: only the screens mounted inside it take the pointer.
    this.el = el('div', 'menu-root');
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.el);
    this.mounted = true;
  }

  // -- screen plumbing -----------------------------------------------------

  private after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  /**
   * Makes the rest of the document inert for as long as a screen is open.
   *
   * Trapping Tab is not modality — a screen reader's virtual cursor, a
   * touch-explore gesture and a browser's find-in-page all walk straight past a
   * key handler into the room behind. Marking every sibling on the path from
   * the menu root up to `<body>` inert is what actually makes the menu the only
   * thing in the document, and it is reversible: only the nodes we set are
   * cleared again, so a subsystem that was already inert stays that way.
   */
  private silenceBackground() {
    if (this.silenced.length) return;
    for (let node: HTMLElement | null = this.el; node && node !== document.body; ) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        // Nothing to silence in a script or a stylesheet, and marking one
        // leaves a confusing attribute in the inspector for no benefit.
        if (sibling.matches('script, style, link, template, noscript')) continue;
        sibling.inert = true;
        this.silenced.push(sibling);
      }
      node = parent;
    }
  }

  private restoreBackground() {
    for (const node of this.silenced) node.inert = false;
    this.silenced = [];
  }

  /**
   * Mounts a screen, traps the keyboard inside it, and resolves once it has
   * animated back out.
   *
   * Screens stack: opening one makes the screen beneath it `inert`, so a
   * confirmation dialog genuinely owns the keyboard rather than merely
   * covering the thing behind it.
   */
  private present<T>(
    name: string,
    build: (finish: (value: T) => void, layer: HTMLElement) => void,
    opts: PresentOptions<T>,
  ): Promise<T> {
    const layer = el('div', `menu-layer menu-layer--${name}`);
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', opts.label);

    const below = this.screens[this.screens.length - 1];
    if (below) below.layer.inert = true;
    else this.silenceBackground();

    const returnFocus = document.activeElement;
    let settled = false;
    let torn = false;
    let outcome!: T;

    let close!: (value: T, instant?: boolean) => void;
    const done = new Promise<T>((resolve) => {
      const teardown = () => {
        if (torn) return;
        torn = true;

        // Only chase focus if this layer actually had it. A screen that closed
        // while the player was already working in the one that replaced it must
        // not yank them back — that is what turns "restore defaults" into a
        // half-second of focus ping-pong.
        const hadFocus = layer.contains(document.activeElement);
        layer.remove();
        opts.cleanup?.();
        this.screens = this.screens.filter((s) => s.layer !== layer);

        const nowTop = this.screens[this.screens.length - 1];
        if (nowTop) nowTop.layer.inert = false;
        else this.restoreBackground();

        if (hadFocus) {
          // Best answer first: the exact control the player left. It is only
          // usable if it survived and is not sitting under another screen.
          const beneath = nowTop
            ? nowTop.layer.querySelector<HTMLElement>('[data-menu-return]') ??
              nowTop.layer.querySelector<HTMLElement>(FOCUSABLE)
            : null;
          const target = focusable(returnFocus) ? returnFocus : beneath;
          target?.focus();
        }
        resolve(outcome);
      };

      close = (value: T, instant = false) => {
        if (settled) {
          // A second, forcing close: settle the animation immediately rather
          // than leaving a caller waiting on a timer that may be cleared.
          if (instant) teardown();
          return;
        }
        settled = true;
        outcome = value;
        layer.inert = true;
        layer.classList.remove('is-in');
        layer.classList.add('is-out');

        if (instant || REDUCED()) teardown();
        else this.after(exitMs(), teardown);
      };
    });

    const finish = (value: T) => close(value);

    layer.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && opts.escape) {
        ev.preventDefault();
        audio.playSound('click-soft');
        finish(opts.escape());
      } else if (ev.key === 'Tab') {
        trapTab(layer, ev);
      }
      // A modal owns the keyboard outright. The shell listens on `window` for
      // Escape and the single-letter shortcuts, and without this a J typed on
      // the title screen opens the journal behind it. Audio unlock is
      // unaffected: the mixer arms itself with capture-phase listeners.
      ev.stopPropagation();
    });

    build(finish, layer);

    this.screens.push({
      layer,
      hardClose: () => close((opts.forced ?? opts.escape ?? (() => undefined as T))(), true),
    });
    this.el.appendChild(layer);

    // Two frames: one to land the initial styles, one to animate off them.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (torn) return;
        layer.classList.add('is-in');
        const target = opts.autofocus?.(layer) ?? layer.querySelector<HTMLElement>(FOCUSABLE);
        target?.focus();
      }),
    );

    return done;
  }

  // -- title ---------------------------------------------------------------

  /**
   * The title screen. Resolves with the player's route into the game:
   * a fresh case, the autosave, or a specific slot chosen from the load list.
   */
  title(): Promise<'new' | 'continue' | { load: SaveSlot }> {
    type Result = 'new' | 'continue' | { load: SaveSlot };

    /** Set by the builder; unhooks the key-art probe and the parallax rig. */
    let releaseArt = () => {};

    return this.present<Result>(
      'title',
      (finish, layer) => {
        const hasAuto = !!readSlot('auto');
        const hasAny = listSlots(this.state.content).length > 0;

        const art = el('div', 'title-art');
        art.setAttribute('aria-hidden', 'true');
        art.innerHTML = `
          <div class="title-art__plate"></div>
          <div class="title-art__fallback"></div>
          <canvas class="title-art__fog"></canvas>
          <canvas class="title-art__rain"></canvas>
          <canvas class="title-art__rain title-art__rain--near"></canvas>
          <div class="title-art__lamp"></div>
          <div class="title-art__vignette"></div>
          <div class="title-art__grain"></div>`;
        layer.appendChild(art);

        // Painted key art if it exists; a lit room built out of gradients if
        // not. The fallback is not an error state — it is the same picture,
        // drawn with a coarser brush, so a missing file never looks broken.
        const plate = art.querySelector<HTMLElement>('.title-art__plate')!;
        const probe = new Image();
        probe.onload = () => {
          plate.style.backgroundImage = `url("${KEY_ART}")`;
          art.classList.add('has-art');
        };
        probe.onerror = () => art.classList.add('is-fallback');
        probe.src = KEY_ART;

        // The rigs are only built when weather is on. Hiding the canvas in CSS
        // would leave two requestAnimationFrame loops running against a
        // zero-sized element, which is precisely the cost the low-power option
        // exists to avoid.
        if (this.settingsModel.weatherEffects) {
          const fog = new Weather(art.querySelector<HTMLCanvasElement>('.title-art__fog')!);
          // Two curtains at different depths. One canvas gives a flat sheet of
          // ticks; a far field behind a near field is what reads as a volume of
          // falling water, and the near layer is the one that gets the blur.
          const rainFar = new Weather(art.querySelector<HTMLCanvasElement>('.title-art__rain')!);
          const rainNear = new Weather(
            art.querySelector<HTMLCanvasElement>('.title-art__rain--near')!,
          );
          fog.set('fog');
          rainFar.set('rain');
          rainNear.set('rain-near');
          this.weatherOnTitle = [fog, rainFar, rainNear];
        }

        // Parallax: the art drifts *against* the pointer, which reads as depth
        // rather than as the cursor dragging the picture around. Coalesced into
        // a frame because a pointermove burst would otherwise force one layout
        // read per event, on the one screen that is already painting weather.
        let pending = 0;
        let px = 0;
        let py = 0;
        const onPointer = (ev: PointerEvent) => {
          if (REDUCED()) return;
          px = ev.clientX;
          py = ev.clientY;
          if (pending) return;
          pending = requestAnimationFrame(() => {
            pending = 0;
            const r = layer.getBoundingClientRect();
            const nx = (px - r.left) / (r.width || 1) - 0.5;
            const ny = (py - r.top) / (r.height || 1) - 0.5;
            art.style.setProperty('--par-x', `${(-nx * PARALLAX_MAX).toFixed(2)}px`);
            art.style.setProperty('--par-y', `${(-ny * PARALLAX_MAX * 0.6).toFixed(2)}px`);
          });
        };
        layer.addEventListener('pointermove', onPointer);
        releaseArt = () => {
          cancelAnimationFrame(pending);
          probe.onload = null;
          probe.onerror = null;
          layer.removeEventListener('pointermove', onPointer);
        };

        const content = el('div', 'title-content');

        const wordmark = el('h1', 'title-wordmark');
        wordmark.setAttribute('aria-label', this.state.content.title);

        // The drawn wordmark, over the CSS one.
        //
        // The lettering below is good typography and it is not a logo — a
        // shipped adventure game has a *drawn* mark, with its own material and
        // its own light. `tools/generate-wordmark.mjs` renders one and keys its
        // alpha out of a black field.
        //
        // The CSS setting stays underneath as a real fallback rather than being
        // deleted: it is the same two lines, it needs no network, and it is what
        // the title screen shows if the asset ever fails to load. Only one is
        // ever visible — `has-mark` retires the type.
        const mark = new Image();
        mark.className = 'title-wordmark__mark';
        mark.decoding = 'async';
        // The h1 already carries the name for assistive tech; alt text here
        // would announce the title twice.
        mark.alt = '';
        mark.setAttribute('aria-hidden', 'true');
        mark.onload = () => wordmark.classList.add('has-mark');
        mark.src = WORDMARK;
        wordmark.appendChild(mark);

        // Per-letter spans so the title can be lit from left to right on first
        // paint. Marked hidden from assistive tech; the h1 carries the label.
        //
        // Letters are grouped per WORD. An inline-block is a line-break
        // opportunity, so a bare run of them lets the browser break mid-word
        // ("The La / mplight"); a non-breaking space between them does not
        // help, because the break is taken between two letter spans rather
        // than at the space. A nowrap wrapper per word restores normal
        // word-level wrapping while keeping the per-letter reveal.
        //
        // The break is authored, not left to the box. A three-word title left
        // to wrap gives "The / Lamplight / Cipher" — a definite article on its
        // own 100px display line, which is the first thing the eye lands on and
        // the least important word in the title. So the last word takes the
        // second line and everything before it takes the first.
        let index = 0;
        const words = this.state.content.title.split(' ');
        const lines =
          words.length > 2 ? [words.slice(0, -1), words.slice(-1)] : [words];
        lines.forEach((lineWords) => {
          const lineEl = el('span', 'title-wordmark__line');
          lineEl.setAttribute('aria-hidden', 'true');
          lineWords.forEach((word, w) => {
            const wordEl = el('span', 'title-wordmark__word');
            for (const ch of word) {
              const span = el('span', 'title-wordmark__ch', ch);
              span.style.setProperty('--i', String(index++));
              wordEl.appendChild(span);
            }
            lineEl.appendChild(wordEl);
            if (w < lineWords.length - 1) {
              // A real space between wrappers, so a line may still break here
              // if the viewport is narrow enough to force it.
              lineEl.appendChild(document.createTextNode(' '));
              index++;
            }
          });
          wordmark.appendChild(lineEl);
        });
        content.appendChild(wordmark);

        content.appendChild(el('div', 'title-rule'));
        content.appendChild(
          el(
            'p',
            'title-subtitle',
            `A mystery in ${spellOut(this.state.content.acts.length)} acts`,
          ),
        );

        const nav = el('nav', 'title-menu');
        nav.setAttribute('aria-label', 'Main menu');
        const indicator = el('span', 'title-menu__indicator');
        indicator.setAttribute('aria-hidden', 'true');
        nav.appendChild(indicator);

        const items: {
          label: string;
          hint: string;
          enabled: boolean;
          /** Extra class, for the primary route in and for the housekeeping row. */
          rank?: 'primary' | 'minor';
          run(): void;
        }[] = [
          {
            label: 'New Case',
            hint: 'Begin from the first night',
            enabled: true,
            rank: 'primary',
            run: () => finish('new'),
          },
          {
            label: 'Continue',
            hint: hasAuto ? 'Resume the autosave' : 'No case in progress',
            enabled: hasAuto,
            run: () => finish('continue'),
          },
          {
            label: 'Load Case',
            hint: hasAny ? 'Open a saved file' : 'No saved files',
            enabled: hasAny,
            run: () => {
              void this.saveMenu('load').then((slot) => {
                if (slot) finish({ load: slot });
              });
            },
          },
          {
            label: 'Settings',
            hint: 'Sound, picture, accessibility',
            enabled: true,
            rank: 'minor',
            run: () => void this.settings(),
          },
        ];

        const buttons: HTMLButtonElement[] = [];
        const lightUp = (btn: HTMLElement | null) => {
          if (!btn || !buttons.includes(btn as HTMLButtonElement)) {
            indicator.classList.remove('is-on');
            return;
          }
          // Centred on the LABEL's cap line, not on the item box. An item is
          // two lines tall, so its own centre falls in the gap between the
          // label and its hint — which is precisely where the old tick parked,
          // attached to nothing.
          const label = btn.querySelector<HTMLElement>('.title-item__label');
          const mid = label
            ? label.offsetTop + label.offsetHeight / 2
            : btn.offsetHeight / 2;
          indicator.style.setProperty('--y', `${btn.offsetTop + mid}px`);
          indicator.classList.add('is-on');
        };

        items.forEach((item, i) => {
          const btn = el('button', 'title-item');
          if (item.rank) btn.classList.add(`title-item--${item.rank}`);
          btn.type = 'button';
          btn.disabled = !item.enabled;
          // Opts out of the global focus ring: this control paints its own
          // selected state (a lit pool and a brass bar), and a browser outline
          // over the top of it is the one mark on this screen that could not
          // have been drawn on purpose. See base.css.
          btn.dataset.ring = 'own';
          btn.style.setProperty('--i', String(i));
          btn.innerHTML = `<span class="title-item__label"></span><span class="title-item__hint"></span>`;
          btn.querySelector('.title-item__label')!.textContent = item.label;
          btn.querySelector('.title-item__hint')!.textContent = item.hint;

          btn.addEventListener('pointerenter', () => {
            if (btn.disabled) return;
            lightUp(btn);
            audio.playSound('click-soft');
          });
          btn.addEventListener('focus', () => lightUp(btn));
          btn.addEventListener('click', () => {
            audio.playSound('click-brass');
            item.run();
          });
          nav.appendChild(btn);
          buttons.push(btn);
        });

        // The tick follows the keyboard when the pointer leaves, and goes out
        // entirely if focus is somewhere else — never parks on a stale row.
        nav.addEventListener('pointerleave', () => lightUp(document.activeElement as HTMLElement));
        nav.addEventListener('keydown', (ev) =>
          rove(
            ev,
            buttons.filter((b) => !b.disabled),
          ),
        );
        content.appendChild(nav);
        layer.appendChild(content);

        // Shipped copy, not a build note. "Score and atmosphere synthesised at
        // runtime" is an implementation detail; on a title card it reframes the
        // whole image as a tech demo. Credit first and brighter, version under
        // it and dimmer — the version is the least important string in the
        // frame and should be set like it.
        const colophon = el('div', 'title-colophon');
        colophon.appendChild(el('p', 'title-credit', '© 2026 — All rights reserved'));
        colophon.appendChild(el('p', 'title-version', `Version ${BUILD_VERSION}`));
        layer.appendChild(colophon);

        // Asked for once, unconditionally: the mixer records the request even
        // while it is still locked and starts the cue itself the moment the
        // first gesture wakes the context, so there is nothing to chase here.
        audio.setMusic('main-theme');
      },
      {
        label: `${this.state.content.title} — main menu`,
        // Escape must not dismiss the title: there is nothing behind it.
        forced: () => 'new' as const,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.title-item:not([disabled])'),
        cleanup: () => {
          for (const w of this.weatherOnTitle) w.destroy();
          this.weatherOnTitle = [];
          releaseArt();
          audio.setMusic(null);
        },
      },
    );
  }

  // -- pause ---------------------------------------------------------------

  /** The in-game menu. Resolves with the chosen route; Escape means resume. */
  pause(): Promise<'resume' | 'save' | 'load' | 'settings' | 'quit'> {
    type Result = 'resume' | 'save' | 'load' | 'settings' | 'quit';

    return this.present<Result>(
      'pause',
      (finish, layer) => {
        layer.appendChild(el('div', 'menu-scrim'));

        const card = el('div', 'pause-card');
        const head = el('header', 'pause-card__head');
        head.appendChild(el('p', 'pause-card__eyebrow', 'The case is on the table'));
        head.appendChild(el('h2', 'pause-card__title', 'Paused'));
        card.appendChild(head);

        const where = el('p', 'pause-card__where');
        const scene = this.state.content.scenes[this.state.scene];
        where.textContent = `Act ${roman(this.state.act)} · ${scene?.name ?? 'Unknown'} · ${formatPlaytime(
          this.state.playtime,
        )}`;
        card.appendChild(where);

        const list = el('div', 'pause-list');
        const options: { label: string; value: Result; danger?: boolean }[] = [
          { label: 'Resume', value: 'resume' },
          { label: 'Save Case', value: 'save' },
          { label: 'Load Case', value: 'load' },
          { label: 'Settings', value: 'settings' },
          { label: 'Quit to Title', value: 'quit', danger: true },
        ];

        const buttons: HTMLButtonElement[] = [];
        for (const opt of options) {
          const btn = el('button', 'pause-item', opt.label);
          btn.type = 'button';
          if (opt.danger) btn.classList.add('is-danger');
          btn.addEventListener('pointerenter', () => audio.playSound('click-soft'));
          btn.addEventListener('click', () => {
            audio.playSound('click-brass');
            if (opt.value !== 'quit') return finish(opt.value);
            void this.confirm({
              title: 'Leave the case?',
              body: 'Your progress will be written to the autosave before the file closes.',
              confirmLabel: 'Quit to title',
              danger: true,
            }).then((ok) => {
              if (ok) finish('quit');
            });
          });
          list.appendChild(btn);
          buttons.push(btn);
        }
        list.addEventListener('keydown', (ev) => rove(ev, buttons));
        card.appendChild(list);

        const foot = el('p', 'pause-card__foot', 'Esc to return to the room');
        card.appendChild(foot);
        layer.appendChild(card);
      },
      {
        label: 'Paused',
        escape: () => 'resume' as const,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.pause-item'),
      },
    );
  }

  // -- settings ------------------------------------------------------------

  /**
   * The settings panel. Every control writes through immediately — there is no
   * Apply button, because a player adjusting brightness needs to see the room
   * change while the slider is still under their thumb.
   */
  settings(): Promise<void> {
    // Torn down with the screen: the mixer subscription and the fullscreen
    // watcher both outlive any single control, and neither may survive it.
    const disposers: (() => void)[] = [];

    // The mixer is the source of truth for its own four faders and may have
    // moved since this instance last looked (a duck, another surface, a
    // restored session). Re-seeding on open stops the panel from writing a
    // stale level back through the first unrelated change the player makes.
    this.settingsModel = { ...this.settingsModel, ...audio.levels };

    return this.present<void>(
      'settings',
      (finish, layer) => {
        // Settings is a modal over the world like pause and confirm are, and
        // gets the same deeper blur: the plain scrim left the title art sharp
        // enough behind the panel that the panel's own edge had to compete with
        // it. Depth of field, not extra darkness.
        layer.appendChild(el('div', 'menu-scrim menu-scrim--deep'));

        const panel = el('div', 'mset');
        const head = el('header', 'mset__head');
        head.appendChild(el('p', 'mset__eyebrow', 'Adjustments'));
        head.appendChild(el('h2', 'mset__title', 'Settings'));
        const closeBtn = el('button', 'mset__close');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close settings');
        closeBtn.setAttribute('aria-keyshortcuts', 'Escape');
        closeBtn.innerHTML = '<span aria-hidden="true">×</span>';
        closeBtn.addEventListener('click', () => {
          audio.playSound('latch');
          finish();
        });
        head.appendChild(closeBtn);
        panel.appendChild(head);

        const body = el('div', 'mset__body');
        // The tablist owns only tabs; the travelling marker is a sibling inside
        // the wrapper. A stray child of `role="tablist"` is not a nicety — it
        // is a malformed group, and screen readers count the members.
        const railWrap = el('div', 'mset__rail-wrap');
        const rail = el('div', 'mset__rail');
        rail.setAttribute('role', 'tablist');
        rail.setAttribute('aria-orientation', 'vertical');
        rail.setAttribute('aria-label', 'Settings sections');
        const pages = el('div', 'mset__pages');

        const sections: { id: string; label: string; build(host: HTMLElement): void }[] = [
          { id: 'audio', label: 'Audio', build: (h) => this.buildAudioSection(h, disposers) },
          { id: 'display', label: 'Display', build: (h) => this.buildDisplaySection(h, disposers) },
          { id: 'gameplay', label: 'Gameplay', build: (h) => this.buildGameplaySection(h) },
          { id: 'access', label: 'Accessibility', build: (h) => this.buildAccessSection(h) },
        ];

        const tabs: HTMLButtonElement[] = [];
        const panels: HTMLElement[] = [];

        /**
         * Moves the thumb-index to the live tab.
         *
         * Both axes are published because the rail turns into a horizontal
         * strip below the narrow breakpoint, and the marker travels along
         * whichever one the layout is currently using.
         */
        const placeMarker = () => {
          const live = tabs.find((t) => t.getAttribute('aria-selected') === 'true') ?? tabs[0];
          if (!live) return;
          railWrap.style.setProperty('--tab-y', `${live.offsetTop + live.offsetHeight / 2}px`);
          railWrap.style.setProperty('--tab-x', `${live.offsetLeft + live.offsetWidth / 2}px`);
          // Announce the axis the layout actually chose, not the one it has at
          // full width: below the breakpoint the rail is a horizontal strip.
          rail.setAttribute(
            'aria-orientation',
            getComputedStyle(rail).flexDirection === 'column' ? 'vertical' : 'horizontal',
          );
        };

        sections.forEach((section, i) => {
          const tabId = nextId('mset-tab');
          const panelId = nextId('mset-panel');

          const tab = el('button', 'mset__tab', section.label);
          tab.type = 'button';
          // The tab paints its own focus and its own selected state, and the
          // two are deliberately different marks. The global ring would land
          // here on open — a browser rectangle round the loudest thing in the
          // rail — and would be indistinguishable from selection besides.
          tab.dataset.ring = 'own';
          tab.id = tabId;
          tab.setAttribute('role', 'tab');
          tab.setAttribute('aria-controls', panelId);
          tab.setAttribute('aria-selected', String(i === 0));
          tab.tabIndex = i === 0 ? 0 : -1;

          const page = el('section', 'mset__page');
          page.id = panelId;
          page.setAttribute('role', 'tabpanel');
          page.setAttribute('aria-labelledby', tabId);
          page.classList.add('scrollable');
          if (i !== 0) page.hidden = true;
          section.build(page);

          const select = (focusTab: boolean) => {
            if (tab.getAttribute('aria-selected') === 'true') return;
            tabs.forEach((t, ti) => {
              t.setAttribute('aria-selected', String(ti === i));
              t.tabIndex = ti === i ? 0 : -1;
            });
            panels.forEach((p, pi) => {
              p.hidden = pi !== i;
            });
            placeMarker();
            if (focusTab) tab.focus();
            audio.playSound('page-turn');
          };

          tab.addEventListener('click', () => select(false));
          rail.appendChild(tab);
          pages.appendChild(page);
          tabs.push(tab);
          panels.push(page);
        });

        // Follow-focus tabs: arrowing along the rail turns the page, which is
        // how a physical index tab behaves.
        rail.addEventListener('keydown', (ev) => {
          const dir =
            ev.key === 'ArrowDown' || ev.key === 'ArrowRight'
              ? 1
              : ev.key === 'ArrowUp' || ev.key === 'ArrowLeft'
                ? -1
                : ev.key === 'Home'
                  ? -tabs.length
                  : ev.key === 'End'
                    ? tabs.length
                    : 0;
          if (!dir) return;
          ev.preventDefault();
          const current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
          const next = clamp(current + dir, 0, tabs.length - 1);
          tabs[next]?.click();
          tabs[next]?.focus();
        });

        const marker = el('span', 'mset__rail-marker');
        marker.setAttribute('aria-hidden', 'true');
        railWrap.appendChild(rail);
        railWrap.appendChild(marker);

        // Four tabs leave the bottom two fifths of the rail empty, and an empty
        // rail beside a half-filled page is an L-shaped hole in the corner of
        // the panel. A colophon plate is the honest thing to put there: it is
        // information the player may actually want from a settings screen, and
        // it is the same engraved brass the rest of the fittings are cut from.
        const railFoot = el('div', 'mset__rail-foot');
        railFoot.appendChild(el('span', 'mset__rail-foot__title', 'The Lamplight Cipher'));
        railFoot.appendChild(el('span', 'mset__rail-foot__meta', `Version ${BUILD_VERSION}`));
        railWrap.appendChild(railFoot);

        body.appendChild(railWrap);
        body.appendChild(pages);
        panel.appendChild(body);

        const foot = el('footer', 'mset__foot');
        const reset = el('button', 'menu-btn menu-btn--ghost', 'Restore defaults');
        reset.type = 'button';
        reset.addEventListener('click', () => {
          void this.confirm({
            title: 'Restore defaults?',
            body: 'Every adjustment on all four pages returns to the shipped setting.',
            confirmLabel: 'Restore',
          }).then((ok) => {
            if (!ok) return;
            try {
              localStorage.removeItem(SETTINGS_KEY);
            } catch {
              /* storage unavailable */
            }
            this.settingsModel = loadSettings();
            applySettings(this.settingsModel);
            saveSettings(this.settingsModel);

            // Rebuilt in place rather than reopened. Closing and reopening the
            // whole screen crossed two transitions, threw the player's page
            // away and left focus chasing a layer that was already leaving.
            for (const dispose of disposers.splice(0)) dispose();
            sections.forEach((section, i) => {
              const page = panels[i];
              if (!page) return;
              page.textContent = '';
              section.build(page);
            });
            reset.focus();
            audio.playSound('drawer-open');
          });
        });
        foot.appendChild(reset);

        const doneBtn = el('button', 'menu-btn menu-btn--primary', 'Done');
        doneBtn.type = 'button';
        doneBtn.addEventListener('click', () => {
          audio.playSound('latch');
          finish();
        });
        foot.appendChild(doneBtn);
        panel.appendChild(foot);

        layer.appendChild(panel);

        // The rail marker needs real geometry, which only exists after layout.
        requestAnimationFrame(placeMarker);

        // Re-measured on resize, because the rail reflows into a horizontal
        // strip below the narrow breakpoint and the marker would otherwise
        // point at a row that no longer exists.
        const ro = new ResizeObserver(placeMarker);
        ro.observe(railWrap);
        disposers.push(() => ro.disconnect());
      },
      {
        label: 'Settings',
        escape: () => undefined,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.mset__tab'),
        cleanup: () => {
          for (const dispose of disposers.splice(0)) dispose();
        },
      },
    );
  }

  /** Writes one field through to storage, the document and the audio engine. */
  private commit<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.settingsModel = { ...this.settingsModel, [key]: value };
    applySettings(this.settingsModel);
    saveSettings(this.settingsModel);
  }

  private buildAudioSection(host: HTMLElement, disposers: (() => void)[]) {
    const s = () => this.settingsModel;
    host.appendChild(
      groupNote(
        'The score, the weather and every latch are synthesised live; these are faders on a mixing desk, not file volumes.',
      ),
    );

    const channels: ['master' | 'music' | 'ambience' | 'sfx', string][] = [
      ['master', 'Master'],
      ['music', 'Music'],
      ['ambience', 'Ambience'],
      ['sfx', 'Effects'],
    ];

    const faders = channels.map(([key, label]) => {
      const fader = this.slider({
        label,
        min: 0,
        max: 1,
        step: 0.05,
        value: s()[key],
        format: pct,
        onInput: (v) => this.commit(key, v),
        onCommit: () => audio.playSound('click-soft'),
      });
      host.appendChild(fader.el);
      return [key, fader] as const;
    });

    const mute = this.toggle({
      label: 'Mute everything',
      hint: 'Silences the mixer without losing your levels',
      value: s().muted,
      onChange: (v) => this.commit('muted', v),
    });
    host.appendChild(mute.el);

    // The mixer is shared, and it can move without this panel: a duck, a
    // keyboard mute, a level restored on wake. Following it keeps the brass
    // where the sound actually is instead of where the panel last left it.
    disposers.push(
      audio.subscribe(() => {
        const levels = audio.levels;
        this.settingsModel = { ...this.settingsModel, ...levels };
        for (const [key, fader] of faders) fader.set(levels[key]);
        mute.set(levels.muted);
      }),
    );
  }

  private buildDisplaySection(host: HTMLElement, disposers: (() => void)[]) {
    const s = () => this.settingsModel;

    host.appendChild(
      this.slider({
        label: 'Brightness',
        min: 0.75,
        max: 1.25,
        step: 0.05,
        value: s().brightness,
        format: pct,
        onInput: (v) => this.commit('brightness', v),
      }).el,
    );
    host.appendChild(
      this.slider({
        label: 'Contrast',
        min: 0.85,
        max: 1.2,
        step: 0.05,
        value: s().contrast,
        format: pct,
        onInput: (v) => this.commit('contrast', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Film grain',
        hint: 'The emulsion pass that beds the interface into the artwork',
        value: s().filmGrain,
        onChange: (v) => this.commit('filmGrain', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Weather effects',
        hint: 'Rain, fog and embers over the scenes. Also the low-power option',
        value: s().weatherEffects,
        onChange: (v) => this.commit('weatherEffects', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Colour grade',
        hint: 'Per-scene grading. Off shows the paintings as they were made',
        value: s().colourGrade,
        onChange: (v) => this.commit('colourGrade', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Reduce motion',
        hint: 'Shortens every transition, whatever your system says',
        value: s().reduceMotion,
        onChange: (v) => this.commit('reduceMotion', v),
      }).el,
    );

    const fs = this.toggle({
      label: 'Fullscreen',
      hint: 'The game is framed for a full screen; the letterbox is intentional',
      value: !!document.fullscreenElement,
      onChange: (v) => {
        // Requesting fullscreen is only legal inside a gesture, which is why
        // this happens here and not in applySettings. The rocker is corrected
        // from the document afterwards either way: a refused request must not
        // leave a switch claiming something the browser never did.
        // Optional calls: an embedded webview may not implement either, and a
        // missing API should leave the switch corrected, not throw.
        const p = v ? document.documentElement.requestFullscreen?.() : document.exitFullscreen?.();
        void Promise.resolve(p)
          .catch(() => undefined)
          .then(() => sync());
      },
    });
    host.appendChild(fs.el);

    // F11 and the browser's own Escape both change fullscreen behind our back.
    const sync = () => {
      const on = !!document.fullscreenElement;
      fs.set(on);
      if (this.settingsModel.fullscreen !== on) this.commit('fullscreen', on);
    };
    document.addEventListener('fullscreenchange', sync);
    disposers.push(() => document.removeEventListener('fullscreenchange', sync));
  }

  private buildGameplaySection(host: HTMLElement) {
    const s = () => this.settingsModel;

    host.appendChild(
      this.segmented<HotspotHighlight>({
        label: 'Hotspot highlight',
        hint: 'How eagerly the room admits what can be touched',
        options: [
          { value: 'off', label: 'Off' },
          { value: 'hover', label: 'On hover' },
          { value: 'always', label: 'Always' },
        ],
        value: s().hotspotHighlight,
        onChange: (v) => this.commit('hotspotHighlight', v),
      }),
    );
    host.appendChild(
      this.segmented<TextSpeed>({
        label: 'Text speed',
        hint: 'How quickly narration and dialogue print',
        options: [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'instant', label: 'Instant' },
        ],
        value: s().textSpeed,
        onChange: (v) => this.commit('textSpeed', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Subtitles',
        hint: 'Captions every spoken line and significant sound',
        value: s().subtitles,
        onChange: (v) => this.commit('subtitles', v),
      }).el,
    );
    host.appendChild(
      this.slider({
        label: 'Hint cooldown',
        hint: 'How long the detective takes to think of the next nudge',
        min: 0,
        max: 180,
        step: 15,
        value: s().hintCooldown,
        format: (v) => (v === 0 ? 'None' : `${v}s`),
        onInput: (v) => this.commit('hintCooldown', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Second chance',
        hint: 'A wrong answer costs a beat rather than the whole puzzle',
        value: s().secondChance,
        onChange: (v) => this.commit('secondChance', v),
      }).el,
    );
  }

  private buildAccessSection(host: HTMLElement) {
    const s = () => this.settingsModel;

    host.appendChild(
      this.slider({
        label: 'Interface scale',
        min: 90,
        max: 130,
        step: 5,
        value: s().uiScale,
        format: (v) => `${v}%`,
        onInput: (v) => this.commit('uiScale', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Legible font',
        hint: 'Swaps the period serifs for a wide, evenly-weighted face',
        value: s().dyslexiaFont,
        onChange: (v) => this.commit('dyslexiaFont', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'High-contrast text',
        hint: 'Lifts prose off the artwork. Costs some atmosphere, deliberately',
        value: s().highContrast,
        onChange: (v) => this.commit('highContrast', v),
      }).el,
    );
    host.appendChild(
      this.toggle({
        label: 'Colour-blind safe puzzles',
        hint: 'Puzzles add shape and label wherever they would rely on hue',
        value: s().colourBlindSafe,
        onChange: (v) => this.commit('colourBlindSafe', v),
      }).el,
    );
  }

  // -- controls ------------------------------------------------------------

  /**
   * A brass fader.
   *
   * Built from divs because the control has to look machined, but it carries
   * the full `role="slider"` contract — value, range, text, and the same key
   * bindings a native range input has — so nothing is lost in the trade.
   *
   * Returns a handle rather than a bare element because some of what these
   * controls show is owned elsewhere — the mixer, the document's fullscreen
   * state — and a control that cannot be told it is wrong will eventually lie.
   */
  private slider(spec: {
    label: string;
    hint?: string;
    min: number;
    max: number;
    step: number;
    value: number;
    format(v: number): string;
    onInput(v: number): void;
    onCommit?(): void;
  }): Control<number> {
    const row = el('div', 'mset-row mset-row--slider');
    const labelId = nextId('mset-label');

    const text = el('div', 'mset-row__text');
    const label = el('span', 'mset-row__label', spec.label);
    label.id = labelId;
    text.appendChild(label);
    if (spec.hint) text.appendChild(el('span', 'mset-row__hint', spec.hint));
    row.appendChild(text);

    const slider = el('div', 'mslider');
    slider.tabIndex = 0;
    slider.setAttribute('role', 'slider');
    slider.setAttribute('aria-labelledby', labelId);
    slider.setAttribute('aria-valuemin', String(spec.min));
    slider.setAttribute('aria-valuemax', String(spec.max));
    slider.innerHTML = `
      <span class="mslider__track"><span class="mslider__fill"></span></span>
      <span class="mslider__knob"></span>`;

    const readout = el('span', 'mset-row__value');

    // Steps are frequently fractional (0.05 gain), so quantise through integer
    // step counts — floating point drift otherwise strands a fader at 0.9999.
    const steps = Math.round((spec.max - spec.min) / spec.step);
    const quantise = (v: number) => {
      const n = clamp(Math.round((v - spec.min) / spec.step), 0, steps);
      return +(spec.min + n * spec.step).toFixed(4);
    };

    let value = quantise(spec.value);

    const paint = () => {
      const ratio = (value - spec.min) / (spec.max - spec.min || 1);
      slider.style.setProperty('--v', String(ratio));
      slider.setAttribute('aria-valuenow', String(value));
      slider.setAttribute('aria-valuetext', spec.format(value));
      readout.textContent = spec.format(value);
    };

    const setValue = (next: number, notify = true) => {
      const q = quantise(next);
      if (q === value) return;
      value = q;
      paint();
      if (notify) spec.onInput(value);
    };

    paint();

    slider.addEventListener('keydown', (ev) => {
      const big = (spec.max - spec.min) / 5;
      const delta =
        ev.key === 'ArrowRight' || ev.key === 'ArrowUp'
          ? spec.step
          : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown'
            ? -spec.step
            : ev.key === 'PageUp'
              ? big
              : ev.key === 'PageDown'
                ? -big
                : 0;
      if (delta) {
        ev.preventDefault();
        setValue(value + delta);
        spec.onCommit?.();
        return;
      }
      if (ev.key === 'Home' || ev.key === 'End') {
        ev.preventDefault();
        setValue(ev.key === 'Home' ? spec.min : spec.max);
        spec.onCommit?.();
      }
    });

    const track = slider.querySelector<HTMLElement>('.mslider__track')!;
    const fromPointer = (clientX: number) => {
      const r = track.getBoundingClientRect();
      const ratio = clamp((clientX - r.left) / (r.width || 1), 0, 1);
      setValue(spec.min + ratio * (spec.max - spec.min));
    };

    slider.addEventListener('pointerdown', (ev) => {
      // Primary button (or any touch/pen contact) only: a right-click on a
      // fader should open the context menu, not slam the level to the pointer.
      if (ev.button !== 0) return;
      ev.preventDefault();
      try {
        slider.setPointerCapture(ev.pointerId);
      } catch {
        // The pointer was already gone; dragging just will not track it.
      }
      slider.classList.add('is-dragging');
      slider.focus();
      fromPointer(ev.clientX);
    });
    slider.addEventListener('pointermove', (ev) => {
      if (!slider.hasPointerCapture(ev.pointerId)) return;
      fromPointer(ev.clientX);
    });
    const release = (ev: PointerEvent) => {
      if (!slider.hasPointerCapture(ev.pointerId)) return;
      slider.releasePointerCapture(ev.pointerId);
      slider.classList.remove('is-dragging');
      spec.onCommit?.();
    };
    slider.addEventListener('pointerup', release);
    slider.addEventListener('pointercancel', release);
    // Losing capture without a pointerup — a browser gesture, a tab switch
    // mid-drag — would otherwise leave the knob stuck in its enlarged state.
    slider.addEventListener('lostpointercapture', () =>
      slider.classList.remove('is-dragging'),
    );

    row.appendChild(slider);
    row.appendChild(readout);
    return {
      el: row,
      // Silent: an external correction is not a player edit and must not be
      // echoed back to whatever just told us about it.
      set: (v) => setValue(v, false),
    };
  }

  /** A brass rocker switch. `role="switch"`, so it announces as on or off. */
  private toggle(spec: {
    label: string;
    hint?: string;
    value: boolean;
    onChange(v: boolean): void;
  }): Control<boolean> {
    const row = el('div', 'mset-row mset-row--toggle');
    const labelId = nextId('mset-label');

    const text = el('div', 'mset-row__text');
    const label = el('span', 'mset-row__label', spec.label);
    label.id = labelId;
    text.appendChild(label);
    if (spec.hint) text.appendChild(el('span', 'mset-row__hint', spec.hint));
    row.appendChild(text);

    let value = spec.value;
    const btn = el('button', 'mswitch');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-labelledby', labelId);
    btn.innerHTML = `
      <span class="mswitch__track"><span class="mswitch__thumb"></span></span>
      <span class="mswitch__state"></span>`;
    const stateEl = btn.querySelector<HTMLElement>('.mswitch__state')!;

    const paint = () => {
      btn.setAttribute('aria-checked', String(value));
      btn.classList.toggle('is-on', value);
      stateEl.textContent = value ? 'On' : 'Off';
    };
    paint();

    btn.addEventListener('click', () => {
      value = !value;
      paint();
      audio.playSound(value ? 'lock-click' : 'latch');
      spec.onChange(value);
    });

    row.appendChild(btn);
    return {
      el: row,
      set: (v) => {
        if (v === value) return;
        value = v;
        paint();
      },
    };
  }

  /** A row of engraved plates, exactly one of which is pressed in. */
  private segmented<T extends string>(spec: {
    label: string;
    hint?: string;
    options: { value: T; label: string }[];
    value: T;
    onChange(v: T): void;
  }): HTMLElement {
    const row = el('div', 'mset-row mset-row--segmented');
    const labelId = nextId('mset-label');

    const text = el('div', 'mset-row__text');
    const label = el('span', 'mset-row__label', spec.label);
    label.id = labelId;
    text.appendChild(label);
    if (spec.hint) text.appendChild(el('span', 'mset-row__hint', spec.hint));
    row.appendChild(text);

    const group = el('div', 'mseg');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-labelledby', labelId);

    let value = spec.value;
    const buttons: HTMLButtonElement[] = [];

    const paint = () => {
      buttons.forEach((b) => {
        const on = b.dataset.value === value;
        b.setAttribute('aria-checked', String(on));
        b.classList.toggle('is-on', on);
        // Roving tabindex: the group is one Tab stop, arrows move inside it.
        b.tabIndex = on ? 0 : -1;
      });
    };

    for (const opt of spec.options) {
      const btn = el('button', 'mseg__opt', opt.label);
      btn.type = 'button';
      btn.dataset.value = opt.value;
      btn.setAttribute('role', 'radio');
      btn.addEventListener('click', () => {
        if (value === opt.value) return;
        value = opt.value;
        paint();
        audio.playSound('click-brass');
        spec.onChange(value);
      });
      group.appendChild(btn);
      buttons.push(btn);
    }
    paint();

    group.addEventListener('keydown', (ev) => {
      const dir =
        ev.key === 'ArrowRight' || ev.key === 'ArrowDown'
          ? 1
          : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp'
            ? -1
            : 0;
      const jump = ev.key === 'Home' ? 0 : ev.key === 'End' ? buttons.length - 1 : -1;
      if (!dir && jump < 0) return;
      ev.preventDefault();
      const current = buttons.findIndex((b) => b.dataset.value === value);
      const next = dir ? (current + dir + buttons.length) % buttons.length : jump;
      buttons[next]?.click();
      buttons[next]?.focus();
    });

    row.appendChild(group);
    return row;
  }

  // -- save / load ---------------------------------------------------------

  /**
   * The slot browser, in either direction.
   *
   * Resolves with the chosen slot, or `null` if the player backed out. Both
   * destructive paths — overwriting an occupied slot and clearing one — route
   * through an in-world confirmation, never a browser dialog.
   */
  saveMenu(mode: 'save' | 'load'): Promise<SaveSlot | null> {
    return this.present<SaveSlot | null>(
      mode === 'save' ? 'save' : 'load',
      (finish, layer) => {
        layer.appendChild(el('div', 'menu-scrim'));

        const panel = el('div', 'slots');
        const head = el('header', 'slots__head');
        head.appendChild(
          el('p', 'slots__eyebrow', mode === 'save' ? 'Commit to paper' : 'Return to the file'),
        );
        head.appendChild(el('h2', 'slots__title', mode === 'save' ? 'Save Case' : 'Load Case'));
        panel.appendChild(head);

        // The grid lives in its own scroll region: at one column on a short
        // window four case files are taller than the plate, and a panel that
        // simply overflows would drop the Back button off the bottom.
        const scroller = el('div', 'slots__scroll scrollable');
        const grid = el('div', 'slots__grid');
        scroller.appendChild(grid);
        panel.appendChild(scroller);

        const render = () => {
          grid.textContent = '';
          const meta = new Map<SaveSlot, SaveMeta>(
            listSlots(this.state.content).map((m) => [m.slot, m]),
          );
          /** Position of the card being built, so a discard can refocus in place. */
          let cursor = 0;
          for (const slot of SAVE_SLOTS) {
            const position = cursor++;
            const info = meta.get(slot) ?? null;
            // The engine owns the autosave; letting a player write over it by
            // hand would make "Continue" mean something different every time.
            const readOnly = mode === 'save' && slot === 'auto';
            const usable = mode === 'save' ? !readOnly : !!info;

            const card = el('div', 'slot');
            card.classList.toggle('is-empty', !info);
            card.classList.toggle('is-locked', !usable);

            const btn = el('button', 'slot__face');
            btn.type = 'button';
            btn.disabled = !usable;

            const title = el('span', 'slot__name', slotLabel(slot));
            btn.appendChild(title);

            if (info) {
              const line = el('span', 'slot__where');
              line.textContent = `Act ${roman(info.act)} · ${info.sceneName}`;
              btn.appendChild(line);

              const stats = el('span', 'slot__stats');
              stats.appendChild(el('span', 'slot__stat', formatPlaytime(info.playtime)));
              stats.appendChild(el('span', 'slot__dot', '·'));
              stats.appendChild(el('span', 'slot__stat', formatRelative(info.savedAt)));
              btn.appendChild(stats);
            } else {
              btn.appendChild(el('span', 'slot__where slot__where--empty', 'Empty'));
              btn.appendChild(
                el('span', 'slot__stats', readOnly ? 'Written by the game' : '—'),
              );
            }

            btn.setAttribute(
              'aria-label',
              info
                ? `${slotLabel(slot)}, act ${info.act}, ${info.sceneName}, ${formatPlaytime(info.playtime)} played, saved ${formatRelative(info.savedAt)}`
                : `${slotLabel(slot)}, empty`,
            );

            btn.addEventListener('pointerenter', () => audio.playSound('click-soft'));
            btn.addEventListener('click', () => {
              audio.playSound('paper-rustle');
              if (mode === 'load') return finish(slot);
              if (!info) return finish(slot);
              void this.confirm({
                title: 'Write over this file?',
                body: `${slotLabel(slot)} holds Act ${roman(info.act)} at ${info.sceneName}, ${formatPlaytime(info.playtime)} played. That record will be replaced.`,
                confirmLabel: 'Overwrite',
                danger: true,
              }).then((ok) => {
                if (ok) finish(slot);
              });
            });

            card.appendChild(btn);

            if (info && slot !== 'auto') {
              const del = el('button', 'slot__discard');
              del.type = 'button';
              del.setAttribute('aria-label', `Discard ${slotLabel(slot)}`);
              del.innerHTML = '<span aria-hidden="true">Discard</span>';
              del.addEventListener('click', () => {
                void this.confirm({
                  title: 'Discard this file?',
                  body: `${slotLabel(slot)} will be destroyed. There is no way back to it.`,
                  confirmLabel: 'Discard',
                  danger: true,
                }).then((ok) => {
                  if (!ok) return;
                  clearSlot(slot);
                  audio.playSound('drawer-open');
                  render();
                  // The card that had focus no longer exists. Land on the slot
                  // that took its place, or on Back if the drawer is now empty.
                  const landing =
                    grid.children[position]?.querySelector<HTMLElement>(
                      '.slot__face:not([disabled])',
                    ) ??
                    grid.querySelector<HTMLElement>('.slot__face:not([disabled])') ??
                    back;
                  landing.focus();
                });
              });
              card.appendChild(del);
            }

            grid.appendChild(card);
          }
        };

        // Bound once: `render()` re-runs whenever a file is discarded, and a
        // per-render listener would stack up duplicates. Arrows travel the grid
        // as a grid — down moves a row, not one card — because a 2×2 sheet of
        // case files that answers Down with "next" is a list wearing a costume.
        grid.addEventListener('keydown', (ev) =>
          rove(
            ev,
            [...grid.querySelectorAll<HTMLElement>('.slot__face:not([disabled])')],
            'grid',
            gridColumns(grid),
          ),
        );

        render();

        const foot = el('footer', 'slots__foot');
        const back = el('button', 'menu-btn menu-btn--ghost', 'Back');
        back.type = 'button';
        back.dataset.menuReturn = '';
        back.addEventListener('click', () => {
          audio.playSound('click-soft');
          finish(null);
        });
        foot.appendChild(back);
        panel.appendChild(foot);

        layer.appendChild(panel);
      },
      {
        label: mode === 'save' ? 'Save case' : 'Load case',
        escape: () => null,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.slot__face:not([disabled])'),
      },
    );
  }

  // -- confirmation --------------------------------------------------------

  /**
   * The in-world stand-in for `window.confirm`.
   *
   * A native dialog would break the fiction, ignore the design system, and —
   * worse — block the whole event loop while the fog canvas is mid-frame.
   */
  private confirm(spec: {
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel?: string;
    danger?: boolean;
  }): Promise<boolean> {
    return this.present<boolean>(
      'confirm',
      (finish, layer) => {
        layer.appendChild(el('div', 'menu-scrim menu-scrim--deep'));

        const card = el('div', 'confirm');
        if (spec.danger) card.classList.add('is-danger');
        card.appendChild(el('h3', 'confirm__title', spec.title));

        // The consequence is the whole point of a confirmation, so it is named
        // as the dialog's description and read out with the question.
        const bodyEl = el('p', 'confirm__body', spec.body);
        bodyEl.id = nextId('confirm-body');
        layer.setAttribute('aria-describedby', bodyEl.id);
        card.appendChild(bodyEl);

        const actions = el('div', 'confirm__actions');
        const cancel = el('button', 'menu-btn menu-btn--ghost', spec.cancelLabel ?? 'Cancel');
        cancel.type = 'button';
        cancel.addEventListener('click', () => {
          audio.playSound('click-soft');
          finish(false);
        });

        const ok = el(
          'button',
          `menu-btn ${spec.danger ? 'menu-btn--danger' : 'menu-btn--primary'}`,
          spec.confirmLabel,
        );
        ok.type = 'button';
        ok.addEventListener('click', () => {
          audio.playSound('lock-click');
          finish(true);
        });

        actions.appendChild(cancel);
        actions.appendChild(ok);
        card.appendChild(actions);

        const buttons = [cancel, ok];
        actions.addEventListener('keydown', (ev) => rove(ev, buttons, 'horizontal'));

        layer.appendChild(card);
      },
      {
        label: spec.title,
        escape: () => false,
        // Cancel takes focus: the safe answer should be the one already under
        // the player's thumb when a destructive question appears.
        autofocus: (layer) => layer.querySelector<HTMLElement>('.menu-btn--ghost'),
      },
    );
  }

  // -- results -------------------------------------------------------------

  /**
   * The closing dossier.
   *
   * Deliberately a *record* rather than a scoreboard: the numbers are there
   * because a detective's file would list them, and the wax seal lands last so
   * the final beat of the game is a physical one.
   */
  results(ending: string, state: GameState): Promise<void> {
    return this.present<void>(
      'results',
      (finish, layer) => {
        layer.appendChild(el('div', 'menu-scrim menu-scrim--deep'));

        const content = state.content;
        const cluesTotal = Object.keys(content.clues).length;
        const puzzlesTotal = Object.keys(content.puzzles).length;
        const solved = CULPRIT_FLAGS.some((f) => state.flags[f] === true);

        const dossier = el('div', 'dossier');
        // The sheet scrolls; the dossier does not. The seal is hung off the
        // paper's edge and would be sliced off by a scroll container, and a
        // long ending has to be readable at 1280×800 without one.
        const sheet = el('div', 'dossier__sheet scrollable');
        dossier.appendChild(sheet);

        const head = el('header', 'dossier__head');
        head.appendChild(el('p', 'dossier__eyebrow', 'Case file'));
        head.appendChild(el('h2', 'dossier__title', content.title));
        head.appendChild(el('div', 'dossier__rule'));
        sheet.appendChild(head);

        const verdict = el('div', 'dossier__verdict');
        verdict.appendChild(el('p', 'dossier__verdict-label', 'Resolution'));
        // `ending` is authored by the story workflow; it is shown verbatim so
        // this screen never has to know the plot.
        verdict.appendChild(el('p', 'dossier__verdict-text', ending));
        sheet.appendChild(verdict);

        const stats = el('dl', 'dossier__stats');
        const stat = (label: string, value: string, note?: string) => {
          const cell = el('div', 'dstat');
          cell.appendChild(el('dt', 'dstat__label', label));
          const dd = el('dd', 'dstat__value', value);
          cell.appendChild(dd);
          if (note) cell.appendChild(el('p', 'dstat__note', note));
          stats.appendChild(cell);
        };

        // `total > 0 &&` guards the empty-content case: a build with no clues
        // authored yet would otherwise congratulate the player on 0 / 0.
        const allOf = (found: number, total: number) => total > 0 && found >= total;

        stat('Time on the case', formatPlaytime(state.playtime), 'hours : minutes');
        stat(
          'Evidence recovered',
          `${state.clues.size} / ${cluesTotal}`,
          allOf(state.clues.size, cluesTotal)
            ? 'Nothing left in the dark'
            : 'Some of it is still out there',
        );
        stat(
          'Puzzles solved',
          `${state.solvedPuzzles.size} / ${puzzlesTotal}`,
          allOf(state.solvedPuzzles.size, puzzlesTotal) ? 'Every lock opened' : 'A few held out',
        );
        stat(
          'Culprit named',
          solved ? 'Correctly' : 'Unresolved',
          solved ? 'The right person, on the record' : 'The file closes without a name',
        );
        sheet.appendChild(stats);

        const seal = el('div', 'dossier__seal');
        seal.setAttribute('role', 'img');
        seal.setAttribute('aria-label', 'Case closed');
        seal.innerHTML = `
          <span class="dossier__seal-wax" aria-hidden="true"></span>
          <span class="dossier__seal-text" aria-hidden="true">Case<br>Closed</span>`;
        dossier.appendChild(seal);

        const foot = el('footer', 'dossier__foot');
        const btn = el('button', 'menu-btn menu-btn--primary', 'Close the file');
        btn.type = 'button';
        btn.addEventListener('click', () => {
          audio.playSound('latch');
          finish();
        });
        foot.appendChild(btn);
        // Outside the scrolling sheet: the way out of the last screen in the
        // game must never be something the player has to scroll to find.
        dossier.appendChild(foot);

        layer.appendChild(dossier);

        // The stamp comes down after the dossier has settled, and lands with a
        // knock in the mix — the only place in the game a sound is timed to a
        // CSS animation rather than the other way round.
        this.after(REDUCED() ? 0 : sealDelayMs(), () => {
          seal.classList.add('is-stamped');
          audio.playSound('door-heavy');
        });
      },
      {
        label: 'Case closed',
        escape: () => undefined,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.menu-btn'),
      },
    );
  }

  // -- teardown ------------------------------------------------------------

  /**
   * Slams every open screen shut without animation.
   *
   * Only for harnesses and hard state changes: each screen settles with its
   * escape value, so a caller awaiting `title()` or `pause()` still gets an
   * answer instead of hanging forever.
   */
  forceClose() {
    for (const screen of [...this.screens].reverse()) screen.hardClose();
  }

  destroy() {
    // `forceClose` settles every screen synchronously, which runs each one's
    // cleanup and resolves its promise — so clearing the timers underneath it
    // afterwards can no longer strand a caller mid-exit.
    this.forceClose();
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    for (const w of this.weatherOnTitle) w.destroy();
    this.weatherOnTitle = [];
    this.restoreBackground();
    if (this.mounted) this.el.remove();
    this.mounted = false;
  }
}

// ---------------------------------------------------------------------------
// Shared keyboard behaviour
// ---------------------------------------------------------------------------

/**
 * Keeps focus inside a modal layer.
 *
 * Recomputed on every Tab rather than cached, because slot lists and settings
 * pages rebuild themselves while open and a cached list would send focus to a
 * detached node.
 */
function trapTab(layer: HTMLElement, ev: KeyboardEvent) {
  const focusables = [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (n) => n.getClientRects().length > 0 || n === document.activeElement,
  );
  if (!focusables.length) return;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;

  if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault();
    first.focus();
  }
}

/** How many tracks a CSS grid is currently resolving to. */
function gridColumns(grid: HTMLElement): number {
  const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  return Math.max(1, tracks);
}

/**
 * Arrow-key travel across a set of controls.
 *
 * Menus are lists, and a list should answer to arrows as well as Tab — a player
 * on a controller-style mental model should never have to discover that Tab is
 * the only way down. `grid` is the two-dimensional case: Down moves a whole row
 * so a sheet of case files behaves like the sheet it looks like, and the column
 * count is measured rather than assumed because it collapses to one on narrow
 * windows.
 */
function rove(
  ev: KeyboardEvent,
  items: HTMLElement[],
  orientation: 'vertical' | 'horizontal' | 'both' | 'grid' = 'vertical',
  columns = 1,
) {
  if (!items.length) return;

  const cols = orientation === 'grid' ? Math.max(1, columns) : 1;
  const step = (key: string): number => {
    switch (key) {
      case 'ArrowDown':
        return orientation === 'horizontal' ? 0 : cols;
      case 'ArrowUp':
        return orientation === 'horizontal' ? 0 : -cols;
      case 'ArrowRight':
        return orientation === 'vertical' ? 0 : 1;
      case 'ArrowLeft':
        return orientation === 'vertical' ? 0 : -1;
      default:
        return 0;
    }
  };

  const dir = step(ev.key);
  const jump = ev.key === 'Home' ? 0 : ev.key === 'End' ? items.length - 1 : -1;
  if (!dir && jump < 0) return;

  ev.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLElement);
  // Focus sitting outside the list (a discard button, say) enters it from the
  // end the player was travelling towards, not from wherever index -1 lands.
  const from = current === -1 ? (dir > 0 ? -dir : 0) : current;
  let next = jump >= 0 ? jump : from + dir;
  // A row move off the end of a ragged grid lands on the last card rather than
  // wrapping to a column the player was not aiming at.
  if (next < 0) next = Math.abs(dir) === 1 ? items.length - 1 : 0;
  if (next >= items.length) next = Math.abs(dir) === 1 ? 0 : items.length - 1;
  items[next]?.focus();
}

/** A line of framing text at the top of a settings page. */
function groupNote(text: string): HTMLElement {
  return el('p', 'mset__note', text);
}
