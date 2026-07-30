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

const KEY_ART = './art/ui/key-art.webp';

/* Motion constants mirror the --dur-* tokens. They live here because these
   sequences are driven from JS and cannot read a CSS duration reliably. */
const MS_EXIT = 460;
/** How long the wax seal waits before it comes down on the dossier. */
const MS_SEAL = 900;

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

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

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
  private titlePointer: { layer: HTMLElement; onPointer: (ev: PointerEvent) => void } | null = null;

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

    const returnFocus = document.activeElement as HTMLElement | null;
    let settled = false;

    let close!: (value: T, instant?: boolean) => void;
    const done = new Promise<T>((resolve) => {
      close = (value: T, instant = false) => {
        if (settled) return;
        settled = true;
        layer.inert = true;
        layer.classList.remove('is-in');
        layer.classList.add('is-out');

        const teardown = () => {
          layer.remove();
          opts.cleanup?.();
          this.screens = this.screens.filter((s) => s.layer !== layer);
          const nowTop = this.screens[this.screens.length - 1];
          if (nowTop) {
            nowTop.layer.inert = false;
            // Focus has to come back to the screen underneath, or the player
            // is left tabbing through an inert document.
            const restore = nowTop.layer.querySelector<HTMLElement>('[data-menu-return]');
            (restore ?? nowTop.layer.querySelector<HTMLElement>(FOCUSABLE))?.focus();
          } else if (returnFocus?.isConnected) {
            returnFocus.focus();
          }
          resolve(value);
        };

        if (instant || REDUCED()) teardown();
        else this.after(MS_EXIT, teardown);
      };
    });

    const finish = (value: T) => close(value);

    layer.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && opts.escape) {
        ev.preventDefault();
        ev.stopPropagation();
        audio.playSound('click-soft');
        finish(opts.escape());
      } else if (ev.key === 'Tab') {
        trapTab(layer, ev);
      }
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
          <div class="title-art__lamp"></div>
          <div class="title-art__vignette"></div>`;
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

        const fog = new Weather(art.querySelector<HTMLCanvasElement>('.title-art__fog')!);
        const rain = new Weather(art.querySelector<HTMLCanvasElement>('.title-art__rain')!);
        fog.set('fog');
        rain.set('rain');
        this.weatherOnTitle = [fog, rain];

        // Parallax: the art drifts *against* the pointer, which reads as depth
        // rather than as the cursor dragging the picture around.
        const onPointer = (ev: PointerEvent) => {
          if (REDUCED()) return;
          const r = layer.getBoundingClientRect();
          const nx = (ev.clientX - r.left) / (r.width || 1) - 0.5;
          const ny = (ev.clientY - r.top) / (r.height || 1) - 0.5;
          art.style.setProperty('--par-x', `${(-nx * PARALLAX_MAX).toFixed(2)}px`);
          art.style.setProperty('--par-y', `${(-ny * PARALLAX_MAX * 0.6).toFixed(2)}px`);
        };
        layer.addEventListener('pointermove', onPointer);
        this.titlePointer = { layer, onPointer };

        const content = el('div', 'title-content');

        const wordmark = el('h1', 'title-wordmark');
        wordmark.setAttribute('aria-label', this.state.content.title);
        // Per-letter spans so the title can be lit from left to right on first
        // paint. Marked hidden from assistive tech; the h1 carries the label.
        let index = 0;
        for (const ch of this.state.content.title) {
          const span = el('span', 'title-wordmark__ch', ch === ' ' ? ' ' : ch);
          span.style.setProperty('--i', String(index++));
          span.setAttribute('aria-hidden', 'true');
          wordmark.appendChild(span);
        }
        content.appendChild(wordmark);

        content.appendChild(el('div', 'title-rule'));
        content.appendChild(
          el('p', 'title-subtitle', `A mystery in ${this.state.content.acts.length} acts`),
        );

        const nav = el('nav', 'title-menu');
        nav.setAttribute('aria-label', 'Main menu');
        const indicator = el('span', 'title-menu__indicator');
        indicator.setAttribute('aria-hidden', 'true');
        nav.appendChild(indicator);

        const items: { label: string; hint: string; enabled: boolean; run(): void }[] = [
          {
            label: 'New Case',
            hint: 'Begin from the first night',
            enabled: true,
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
            run: () => void this.settings(),
          },
        ];

        const buttons: HTMLButtonElement[] = [];
        const lightUp = (btn: HTMLElement | null) => {
          if (!btn) {
            indicator.classList.remove('is-on');
            return;
          }
          indicator.style.setProperty('--y', `${btn.offsetTop + btn.offsetHeight / 2}px`);
          indicator.classList.add('is-on');
        };

        items.forEach((item, i) => {
          const btn = el('button', 'title-item');
          btn.type = 'button';
          btn.disabled = !item.enabled;
          btn.style.setProperty('--i', String(i));
          btn.innerHTML = `<span class="title-item__label"></span><span class="title-item__hint"></span>`;
          btn.querySelector('.title-item__label')!.textContent = item.label;
          btn.querySelector('.title-item__hint')!.textContent = item.hint;
          if (!item.enabled) btn.setAttribute('aria-disabled', 'true');

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

        nav.addEventListener('pointerleave', () => lightUp(document.activeElement as HTMLElement));
        nav.addEventListener('keydown', (ev) => rove(ev, buttons.filter((b) => !b.disabled)));
        content.appendChild(nav);
        layer.appendChild(content);

        const colophon = el('div', 'title-colophon');
        colophon.appendChild(el('p', 'title-version', `Version ${BUILD_VERSION}`));
        colophon.appendChild(
          el('p', 'title-credit', 'An original work — score and atmosphere synthesised at runtime'),
        );
        layer.appendChild(colophon);

        // The mixer only wakes on a gesture, so ask twice: once now in case the
        // context is already live, and once after the first interaction, which
        // is when the shell's unlock listener will have run.
        audio.setMusic('main-theme');
        const nudge = () => {
          requestAnimationFrame(() => audio.setMusic('main-theme'));
          layer.removeEventListener('pointerdown', nudge);
          layer.removeEventListener('keydown', nudge);
        };
        layer.addEventListener('pointerdown', nudge);
        layer.addEventListener('keydown', nudge);
      },
      {
        label: 'The Lamplight Cipher — main menu',
        // Escape must not dismiss the title: there is nothing behind it.
        forced: () => 'new' as const,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.title-item:not([disabled])'),
        cleanup: () => {
          for (const w of this.weatherOnTitle) w.destroy();
          this.weatherOnTitle = [];
          if (this.titlePointer) {
            this.titlePointer.layer.removeEventListener('pointermove', this.titlePointer.onPointer);
            this.titlePointer = null;
          }
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
    return this.present<void>(
      'settings',
      (finish, layer) => {
        layer.appendChild(el('div', 'menu-scrim'));

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
        const rail = el('div', 'mset__rail');
        rail.setAttribute('role', 'tablist');
        rail.setAttribute('aria-orientation', 'vertical');
        rail.setAttribute('aria-label', 'Settings sections');
        const pages = el('div', 'mset__pages');

        const sections: { id: string; label: string; build(host: HTMLElement): void }[] = [
          { id: 'audio', label: 'Audio', build: (h) => this.buildAudioSection(h) },
          { id: 'display', label: 'Display', build: (h) => this.buildDisplaySection(h) },
          { id: 'gameplay', label: 'Gameplay', build: (h) => this.buildGameplaySection(h) },
          { id: 'access', label: 'Accessibility', build: (h) => this.buildAccessSection(h) },
        ];

        const tabs: HTMLButtonElement[] = [];
        const panels: HTMLElement[] = [];

        sections.forEach((section, i) => {
          const tabId = nextId('mset-tab');
          const panelId = nextId('mset-panel');

          const tab = el('button', 'mset__tab', section.label);
          tab.type = 'button';
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
            tabs.forEach((t, ti) => {
              t.setAttribute('aria-selected', String(ti === i));
              t.tabIndex = ti === i ? 0 : -1;
            });
            panels.forEach((p, pi) => {
              p.hidden = pi !== i;
            });
            rail.style.setProperty('--tab-y', `${tab.offsetTop + tab.offsetHeight / 2}px`);
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
        rail.appendChild(marker);

        body.appendChild(rail);
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
            // Cheapest correct redraw: close and reopen on the same frame the
            // player confirmed, so every control re-reads the fresh model.
            finish();
            void this.settings();
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
        requestAnimationFrame(() => {
          const first = tabs[0];
          if (first) rail.style.setProperty('--tab-y', `${first.offsetTop + first.offsetHeight / 2}px`);
        });
      },
      {
        label: 'Settings',
        escape: () => undefined,
        autofocus: (layer) => layer.querySelector<HTMLElement>('.mset__tab'),
      },
    );
  }

  /** Writes one field through to storage, the document and the audio engine. */
  private commit<K extends keyof Settings>(key: K, value: Settings[K]) {
    this.settingsModel = { ...this.settingsModel, [key]: value };
    applySettings(this.settingsModel);
    saveSettings(this.settingsModel);
  }

  private buildAudioSection(host: HTMLElement) {
    const s = () => this.settingsModel;
    host.appendChild(
      groupNote('The score, the weather and every latch are synthesised live; these are faders on a mixing desk, not file volumes.'),
    );

    const channels: [('master' | 'music' | 'ambience' | 'sfx'), string][] = [
      ['master', 'Master'],
      ['music', 'Music'],
      ['ambience', 'Ambience'],
      ['sfx', 'Effects'],
    ];
    for (const [key, label] of channels) {
      host.appendChild(
        this.slider({
          label,
          min: 0,
          max: 1,
          step: 0.05,
          value: s()[key],
          format: pct,
          onInput: (v) => this.commit(key, v),
          onCommit: () => audio.playSound('click-soft'),
        }),
      );
    }

    host.appendChild(
      this.toggle({
        label: 'Mute everything',
        hint: 'Silences the mixer without losing your levels',
        value: s().muted,
        onChange: (v) => this.commit('muted', v),
      }),
    );
  }

  private buildDisplaySection(host: HTMLElement) {
    const s = () => this.settingsModel;

    host.appendChild(
      this.slider({
        label: 'Brightness',
        min: 0.75,
        max: 1.25,
        step: 0.05,
        value: s().brightness,
        format: (v) => `${Math.round(v * 100)}%`,
        onInput: (v) => this.commit('brightness', v),
      }),
    );
    host.appendChild(
      this.slider({
        label: 'Contrast',
        min: 0.85,
        max: 1.2,
        step: 0.05,
        value: s().contrast,
        format: (v) => `${Math.round(v * 100)}%`,
        onInput: (v) => this.commit('contrast', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Film grain',
        hint: 'The emulsion pass that beds the interface into the artwork',
        value: s().filmGrain,
        onChange: (v) => this.commit('filmGrain', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Weather effects',
        hint: 'Rain, fog and embers over the scenes. Also the low-power option',
        value: s().weatherEffects,
        onChange: (v) => this.commit('weatherEffects', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Colour grade',
        hint: 'Per-scene grading. Off shows the paintings as they were made',
        value: s().colourGrade,
        onChange: (v) => this.commit('colourGrade', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Reduce motion',
        hint: 'Shortens every transition, whatever your system says',
        value: s().reduceMotion,
        onChange: (v) => this.commit('reduceMotion', v),
      }),
    );

    const fs = this.toggle({
      label: 'Fullscreen',
      hint: 'The game is framed for a full screen; the letterbox is intentional',
      value: !!document.fullscreenElement,
      onChange: (v) => {
        // Requesting fullscreen is only legal inside a gesture, which is why
        // this happens here and not in applySettings.
        const p = v
          ? document.documentElement.requestFullscreen?.()
          : document.exitFullscreen?.();
        void Promise.resolve(p)
          .catch(() => undefined)
          .then(() => this.commit('fullscreen', !!document.fullscreenElement));
      },
    });
    host.appendChild(fs);
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
      }),
    );
    host.appendChild(
      this.slider({
        label: 'Hint cooldown',
        min: 0,
        max: 180,
        step: 15,
        value: s().hintCooldown,
        format: (v) => (v === 0 ? 'None' : `${v}s`),
        onInput: (v) => this.commit('hintCooldown', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Second chance',
        hint: 'A wrong answer costs a beat rather than the whole puzzle',
        value: s().secondChance,
        onChange: (v) => this.commit('secondChance', v),
      }),
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
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Legible font',
        hint: 'Swaps the period serifs for a wide, evenly-weighted face',
        value: s().dyslexiaFont,
        onChange: (v) => this.commit('dyslexiaFont', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'High-contrast text',
        hint: 'Lifts prose off the artwork. Costs some atmosphere, deliberately',
        value: s().highContrast,
        onChange: (v) => this.commit('highContrast', v),
      }),
    );
    host.appendChild(
      this.toggle({
        label: 'Colour-blind safe puzzles',
        hint: 'Puzzles add shape and label wherever they would rely on hue',
        value: s().colourBlindSafe,
        onChange: (v) => this.commit('colourBlindSafe', v),
      }),
    );
  }

  // -- controls ------------------------------------------------------------

  /**
   * A brass fader.
   *
   * Built from divs because the control has to look machined, but it carries
   * the full `role="slider"` contract — value, range, text, and the same key
   * bindings a native range input has — so nothing is lost in the trade.
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
  }): HTMLElement {
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
      ev.preventDefault();
      slider.setPointerCapture(ev.pointerId);
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

    row.appendChild(slider);
    row.appendChild(readout);
    return row;
  }

  /** A brass rocker switch. `role="switch"`, so it announces as on or off. */
  private toggle(spec: {
    label: string;
    hint?: string;
    value: boolean;
    onChange(v: boolean): void;
  }): HTMLElement {
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
    return row;
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
      const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      ev.preventDefault();
      const current = buttons.findIndex((b) => b.dataset.value === value);
      const next = (current + dir + buttons.length) % buttons.length;
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
        head.appendChild(el('p', 'slots__eyebrow', mode === 'save' ? 'Commit to paper' : 'Return to the file'));
        head.appendChild(el('h2', 'slots__title', mode === 'save' ? 'Save Case' : 'Load Case'));
        panel.appendChild(head);

        const grid = el('div', 'slots__grid');
        panel.appendChild(grid);

        const render = () => {
          grid.textContent = '';
          const meta = new Map<SaveSlot, SaveMeta>(
            listSlots(this.state.content).map((m) => [m.slot, m]),
          );
          for (const slot of SAVE_SLOTS) {
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
                  grid.querySelector<HTMLElement>('.slot__face:not([disabled])')?.focus();
                });
              });
              card.appendChild(del);
            }

            grid.appendChild(card);
          }

        };

        // Bound once: `render()` re-runs whenever a file is discarded, and a
        // per-render listener would stack up duplicates.
        grid.addEventListener('keydown', (ev) =>
          rove(ev, [...grid.querySelectorAll<HTMLElement>('.slot__face:not([disabled])')], 'both'),
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
        card.appendChild(el('p', 'confirm__body', spec.body));

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

        const head = el('header', 'dossier__head');
        head.appendChild(el('p', 'dossier__eyebrow', 'Case file'));
        head.appendChild(el('h2', 'dossier__title', content.title));
        head.appendChild(el('div', 'dossier__rule'));
        dossier.appendChild(head);

        const verdict = el('div', 'dossier__verdict');
        verdict.appendChild(el('p', 'dossier__verdict-label', 'Resolution'));
        // `ending` is authored by the story workflow; it is shown verbatim so
        // this screen never has to know the plot.
        verdict.appendChild(el('p', 'dossier__verdict-text', ending));
        dossier.appendChild(verdict);

        const stats = el('dl', 'dossier__stats');
        const stat = (label: string, value: string, note?: string) => {
          const cell = el('div', 'dstat');
          cell.appendChild(el('dt', 'dstat__label', label));
          const dd = el('dd', 'dstat__value', value);
          cell.appendChild(dd);
          if (note) cell.appendChild(el('p', 'dstat__note', note));
          stats.appendChild(cell);
        };

        stat('Time on the case', formatPlaytime(state.playtime), 'hours : minutes');
        stat(
          'Evidence recovered',
          `${state.clues.size} / ${cluesTotal}`,
          cluesTotal && state.clues.size === cluesTotal ? 'Nothing left in the dark' : 'Some of it is still out there',
        );
        stat(
          'Puzzles solved',
          `${state.solvedPuzzles.size} / ${puzzlesTotal}`,
          state.solvedPuzzles.size === puzzlesTotal ? 'Every lock opened' : 'A few held out',
        );
        stat(
          'Culprit named',
          solved ? 'Correctly' : 'Unresolved',
          solved ? 'The right person, on the record' : 'The file closes without a name',
        );
        dossier.appendChild(stats);

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
        dossier.appendChild(foot);

        layer.appendChild(dossier);

        // The stamp comes down after the dossier has settled, and lands with a
        // knock in the mix — the only place in the game a sound is timed to a
        // CSS animation rather than the other way round.
        this.after(REDUCED() ? 0 : MS_SEAL, () => {
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
    this.forceClose();
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    for (const w of this.weatherOnTitle) w.destroy();
    this.weatherOnTitle = [];
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

/**
 * Arrow-key travel along a list of controls.
 *
 * Menus are lists, and a list should answer to arrows as well as Tab — a
 * player on a controller-style mental model should never have to discover
 * that Tab is the only way down.
 */
function rove(
  ev: KeyboardEvent,
  items: HTMLElement[],
  orientation: 'vertical' | 'horizontal' | 'both' = 'vertical',
) {
  const forwardKeys =
    orientation === 'vertical'
      ? ['ArrowDown']
      : orientation === 'horizontal'
        ? ['ArrowRight']
        : ['ArrowDown', 'ArrowRight'];
  const backKeys =
    orientation === 'vertical'
      ? ['ArrowUp']
      : orientation === 'horizontal'
        ? ['ArrowLeft']
        : ['ArrowUp', 'ArrowLeft'];

  const dir = forwardKeys.includes(ev.key) ? 1 : backKeys.includes(ev.key) ? -1 : 0;
  if (!dir && ev.key !== 'Home' && ev.key !== 'End') return;
  if (!items.length) return;

  ev.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLElement);
  // Focus sitting outside the list (a discard button, say) enters it from the
  // end the player was travelling towards, not from wherever index -1 lands.
  const from = current === -1 ? (dir > 0 ? -1 : 0) : current;
  const next =
    ev.key === 'Home'
      ? 0
      : ev.key === 'End'
        ? items.length - 1
        : (from + dir + items.length) % items.length;
  items[next]?.focus();
}

/** A line of framing text at the top of a settings page. */
function groupNote(text: string): HTMLElement {
  return el('p', 'mset__note', text);
}
