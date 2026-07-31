/**
 * Authoring helpers for the scene graph.
 *
 * These are deliberately thin: they build the same plain `Condition`,
 * `Effect` and `Hotspot` data the engine already interprets, and exist only so
 * that thirty-four rooms of content read as prose rather than as punctuation.
 * Nothing here has behaviour — if a helper ever needs a branch, it belongs in
 * `src/engine/state.ts` instead.
 */

import type {
  Condition,
  Effect,
  Hotspot,
  HotspotShape,
  ItemId,
  ClueId,
  CharacterId,
  PuzzleId,
  SceneId,
  TransitionKind,
} from '@/engine/types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * A normalised rectangle in a 16:10 frame. Authored as `at(x, y, w, h)` with
 * the origin at the top left, so a hotspot reads in the same order as the
 * painting is described: how far across, how far down, how big.
 */
export const at = (x: number, y: number, w: number, h: number): HotspotShape => ({
  type: 'rect',
  rect: { x, y, w, h },
});

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export const inAct = (min: number, max?: number): Condition => ({ kind: 'act', min, max });
export const untilAct = (max: number): Condition => ({ kind: 'act', max });
export const all = (...of: Condition[]): Condition => ({ kind: 'all', of });
export const any = (...of: Condition[]): Condition => ({ kind: 'any', of });
export const not = (of: Condition): Condition => ({ kind: 'not', of });
export const has = (item: ItemId): Condition => ({ kind: 'hasItem', item });
export const lacks = (item: ItemId): Condition => ({ kind: 'lacksItem', item });
export const knows = (clue: ClueId): Condition => ({ kind: 'hasClue', clue });
export const unaware = (clue: ClueId): Condition => ({ kind: 'lacksClue', clue });
export const solved = (puzzle: PuzzleId): Condition => ({ kind: 'puzzleSolved', puzzle });
export const unsolved = (puzzle: PuzzleId): Condition => ({ kind: 'puzzleUnsolved', puzzle });
export const flagged = (flag: string, value = true): Condition => ({ kind: 'flag', flag, value });
export const seen = (scene: SceneId): Condition => ({ kind: 'visited', scene });

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** Wren, to herself. The default register of the whole game. */
export const think = (...text: string[]): Effect => ({ kind: 'think', text });

/** Anything with a voice: a person, or a document read aloud in their hand. */
export const say = (speaker: string, ...text: string[]): Effect => ({
  kind: 'narrate',
  text,
  speaker,
});

/** Unattributed narration — the room, or the text on the page. */
export const tell = (...text: string[]): Effect => ({ kind: 'narrate', text });

export const clue = (c: ClueId): Effect => ({ kind: 'giveClue', clue: c });
export const take = (i: ItemId): Effect => ({ kind: 'giveItem', item: i });
export const quietly = (i: ItemId): Effect => ({ kind: 'giveItem', item: i, silent: true });
export const drop = (i: ItemId): Effect => ({ kind: 'takeItem', item: i });
export const set = (flag: string, value = true): Effect => ({ kind: 'setFlag', flag, value });
export const puzzle = (p: PuzzleId): Effect => ({ kind: 'openPuzzle', puzzle: p });
export const speakTo = (character: CharacterId): Effect => ({ kind: 'talk', character });
export const sound = (s: string): Effect => ({ kind: 'playSound', sound: s });
export const ambience = (a: string): Effect => ({ kind: 'setAmbience', ambience: a });
export const shake = (intensity = 0.5): Effect => ({ kind: 'shake', intensity });
export const task = (id: string, text: string): Effect => ({ kind: 'addTask', id, text });
export const doneTask = (id: string): Effect => ({ kind: 'completeTask', id });
export const unlock = (scene: SceneId): Effect => ({ kind: 'unlockScene', scene });

export const when = (cond: Condition, then: Effect[], otherwise?: Effect[]): Effect =>
  otherwise ? { kind: 'if', cond, then, else: otherwise } : { kind: 'if', cond, then };

export const goto = (scene: SceneId, transition: TransitionKind = 'fade'): Effect => ({
  kind: 'goto',
  scene,
  transition,
});

/**
 * Idempotent act turn. The act gates in the design are puzzle completions, and
 * a puzzle's `onSolve` may raise the act itself; guarding on the current act
 * means whichever fires first wins and the second is a no-op, so the title
 * card never plays twice.
 */
export const advanceTo = (act: number): Effect =>
  when({ kind: 'act', max: act - 1 }, [{ kind: 'setAct', act }]);

// ---------------------------------------------------------------------------
// Hotspots
// ---------------------------------------------------------------------------

export interface ExitOptions {
  cursor?: Hotspot['cursor'];
  visibleIf?: Condition;
  enabledIf?: Condition;
  blockedEffects?: Effect[];
  /** Beats played before the transition — a look over the shoulder, a warning. */
  before?: Effect[];
  transition?: TransitionKind;
  huntable?: boolean;
}

/** A way out. Every room has at least one, and most have several. */
export const exit = (
  id: string,
  label: string,
  shape: HotspotShape,
  scene: SceneId,
  opts: ExitOptions = {},
): Hotspot => {
  const hs: Hotspot = {
    id,
    label,
    shape,
    cursor: opts.cursor ?? 'walk',
    onInteract: [...(opts.before ?? []), goto(scene, opts.transition)],
  };
  if (opts.visibleIf) hs.visibleIf = opts.visibleIf;
  if (opts.enabledIf) hs.enabledIf = opts.enabledIf;
  if (opts.blockedEffects) hs.blockedEffects = opts.blockedEffects;
  if (opts.huntable) hs.huntable = true;
  return hs;
};
