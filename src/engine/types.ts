/**
 * Content schema for The Lamplight Cipher.
 *
 * Everything the player sees is data: scenes, hotspots, dialogue, clues and
 * puzzles are declared in `src/game/**` and interpreted by the engine. Adding
 * a room or a conversation never means touching engine code.
 */

// ---------------------------------------------------------------------------
// Conditions & effects
// ---------------------------------------------------------------------------

/**
 * A predicate over game state. Conditions are plain data so they can live in
 * content files, be serialised, and be validated ahead of runtime.
 */
export type Condition =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'act'; min?: number; max?: number }
  | { kind: 'hasItem'; item: ItemId }
  | { kind: 'lacksItem'; item: ItemId }
  | { kind: 'hasClue'; clue: ClueId }
  | { kind: 'lacksClue'; clue: ClueId }
  | { kind: 'flag'; flag: string; value?: boolean }
  | { kind: 'puzzleSolved'; puzzle: PuzzleId }
  | { kind: 'puzzleUnsolved'; puzzle: PuzzleId }
  | { kind: 'visited'; scene: SceneId }
  | { kind: 'counter'; counter: string; min?: number; max?: number }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition };

/**
 * A state mutation or presentation beat. Effects are executed in order and may
 * be asynchronous (a line of narration waits for the player to dismiss it).
 */
export type Effect =
  | { kind: 'narrate'; text: string | string[]; speaker?: string }
  | { kind: 'think'; text: string | string[] }
  | { kind: 'giveItem'; item: ItemId; silent?: boolean }
  | { kind: 'takeItem'; item: ItemId }
  | { kind: 'giveClue'; clue: ClueId; silent?: boolean }
  | { kind: 'setFlag'; flag: string; value: boolean }
  | { kind: 'addCounter'; counter: string; by: number }
  | { kind: 'goto'; scene: SceneId; transition?: TransitionKind }
  | { kind: 'openPuzzle'; puzzle: PuzzleId }
  | { kind: 'talk'; character: CharacterId }
  | { kind: 'setAct'; act: number }
  | { kind: 'addTask'; id: string; text: string }
  | { kind: 'completeTask'; id: string }
  | { kind: 'playSound'; sound: string }
  | { kind: 'setAmbience'; ambience: string }
  | { kind: 'shake'; intensity?: number }
  | { kind: 'cinematic'; id: CinematicId }
  | { kind: 'unlockScene'; scene: SceneId }
  | { kind: 'endGame'; ending: string }
  | { kind: 'if'; cond: Condition; then: Effect[]; else?: Effect[] }
  | { kind: 'sequence'; of: Effect[] };

export type TransitionKind = 'fade' | 'push-left' | 'push-right' | 'iris' | 'none';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type SceneId = string;
export type ItemId = string;
export type ClueId = string;
export type CharacterId = string;
export type PuzzleId = string;
export type CinematicId = string;

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

/** Normalised rectangle in scene space (0..1), so hotspots survive any resize. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type HotspotShape =
  | { type: 'rect'; rect: Rect }
  /** Polygon points as normalised [x, y] pairs — for irregular targets. */
  | { type: 'poly'; points: [number, number][] };

export type CursorKind =
  | 'look'
  | 'take'
  | 'use'
  | 'talk'
  | 'walk'
  | 'walk-left'
  | 'walk-right'
  | 'walk-back'
  | 'puzzle';

export interface Hotspot {
  id: string;
  /** Shown in the on-hover nameplate. */
  label: string;
  shape: HotspotShape;
  cursor: CursorKind;
  /** Hidden entirely when this fails. Defaults to always visible. */
  visibleIf?: Condition;
  /** Visible but refuses interaction, playing `blockedEffects` instead. */
  enabledIf?: Condition;
  onInteract: Effect[];
  blockedEffects?: Effect[];
  /** Item that may be dragged onto this hotspot, and what that does. */
  accepts?: { item: ItemId; effects: Effect[] }[];
  /** Rejection line when an unrelated item is dropped here. */
  onWrongItem?: Effect[];
  /** Highlight this hotspot when the player uses the "look" affordance. */
  huntable?: boolean;
}

/**
 * A layered overlay painted above the background — a lit lamp, an opened
 * drawer, a removed painting. Lets one painted background express many states.
 */
export interface SceneLayer {
  id: string;
  src: string;
  visibleIf: Condition;
  /** CSS blend mode, for glows and shadows. */
  blend?: string;
  opacity?: number;
  /** Slow drift/flicker, for firelight and rain. */
  animate?: 'flicker' | 'drift' | 'pulse' | 'none';
}

export interface Scene {
  id: SceneId;
  name: string;
  /** Shown under the location name on arrival. */
  subtitle?: string;
  background: string;
  layers?: SceneLayer[];
  hotspots: Hotspot[];
  ambience?: string;
  /** Runs the first time the player arrives. */
  onFirstEnter?: Effect[];
  /** Runs on every arrival, after `onFirstEnter`. */
  onEnter?: Effect[];
  /** Gates travel into the scene entirely. */
  enterIf?: Condition;
  /** Weather/particle preset layered over everything. */
  weather?: 'none' | 'rain' | 'heavy-rain' | 'snow' | 'dust' | 'embers' | 'fog';
  /** Colour grade applied to the whole scene, for act-by-act mood shifts. */
  grade?: string;
}

// ---------------------------------------------------------------------------
// Items, clues, characters
// ---------------------------------------------------------------------------

export interface Item {
  id: ItemId;
  name: string;
  icon: string;
  description: string;
  /** Longer text in the item close-up view. */
  examineText?: string;
  /** A high-res image for the close-up, when the icon is not enough. */
  examineImage?: string;
  /** Combining two items into a third. */
  combinesWith?: { item: ItemId; produces: ItemId; effects?: Effect[] }[];
  /** Story items cannot be discarded and read as evidence, not equipment. */
  category?: 'evidence' | 'tool' | 'key' | 'document' | 'personal';
}

export interface Clue {
  id: ClueId;
  name: string;
  /** What the detective concluded. Written in the protagonist's voice. */
  summary: string;
  act: number;
  /** Which suspect(s) this bears on, for the deduction board. */
  bearsOn?: CharacterId[];
  /** Deduction-board grouping. */
  category: 'testimony' | 'physical' | 'document' | 'observation';
}

export interface DialogueNode {
  id: string;
  /** The line the player chooses. */
  playerLine: string;
  /** The character's answer; array renders as sequential lines. */
  reply: string | string[];
  availableIf?: Condition;
  /** Once chosen, the node disappears. Defaults true for story beats. */
  once?: boolean;
  effects?: Effect[];
  /** Renders in the accusing style and may end the conversation. */
  isConfrontation?: boolean;
  /** Nested follow-up options presented immediately after the reply. */
  children?: DialogueNode[];
}

export interface DialogueTree {
  characterId: CharacterId;
  act: number;
  greeting: string | string[];
  /** Shown when the player has exhausted every available topic. */
  exhausted?: string;
  farewell?: string;
  nodes: DialogueNode[];
  availableIf?: Condition;
}

export interface Character {
  id: CharacterId;
  name: string;
  role: string;
  portrait: string;
  /** Alternate portraits keyed by mood, e.g. `{ angry: '...' }`. */
  moods?: Record<string, string>;
  /** Accent colour for their nameplate. */
  color?: string;
  bio: string;
}

// ---------------------------------------------------------------------------
// Puzzles
// ---------------------------------------------------------------------------

export interface PuzzleDefinition {
  id: PuzzleId;
  name: string;
  /** Framing text shown when the puzzle opens. */
  premise: string;
  /** Three escalating in-fiction nudges. */
  hints: [string, string, string];
  onSolve: Effect[];
  /** Optional bail-out after repeated failures, for accessibility. */
  allowSkipAfterMs?: number;
}

/**
 * The contract every minigame implements. A puzzle owns its DOM subtree and
 * nothing else; it reports success through `onSolve` and is torn down after.
 */
export interface PuzzleModule {
  /** Build the interactive UI inside `root`. Call `ctx.solve()` when won. */
  mount(root: HTMLElement, ctx: PuzzleContext): void;
  unmount?(): void;
}

export interface PuzzleContext {
  /** Declare victory. Safe to call once; later calls are ignored. */
  solve(): void;
  /** Close without solving. */
  close(): void;
  /** Persisted per-puzzle scratch state, so progress survives a save. */
  state: Record<string, unknown>;
  save(): void;
  /** Feedback helpers so every puzzle reacts consistently. */
  feedback(kind: 'good' | 'bad' | 'click' | 'tick'): void;
  /** Player-facing note, e.g. "Three of the four dials line up." */
  note(text: string): void;
  hasItem(item: ItemId): boolean;
  hasClue(clue: ClueId): boolean;
}

// ---------------------------------------------------------------------------
// Cinematics
// ---------------------------------------------------------------------------

export interface CinematicBeat {
  image?: string;
  /** Ken Burns move across the still. */
  move?: 'in' | 'out' | 'left' | 'right' | 'none';
  text?: string | string[];
  speaker?: string;
  durationMs?: number;
  sound?: string;
}

export interface Cinematic {
  id: CinematicId;
  beats: CinematicBeat[];
  music?: string;
  skippable?: boolean;
}

// ---------------------------------------------------------------------------
// Acts & save data
// ---------------------------------------------------------------------------

export interface Act {
  number: number;
  title: string;
  /** Shown on the act title card. */
  epigraph?: string;
  /** Objective text for the journal. */
  goal: string;
}

export interface GameContent {
  title: string;
  scenes: Record<SceneId, Scene>;
  items: Record<ItemId, Item>;
  clues: Record<ClueId, Clue>;
  characters: Record<CharacterId, Character>;
  dialogue: DialogueTree[];
  puzzles: Record<PuzzleId, PuzzleDefinition>;
  cinematics: Record<CinematicId, Cinematic>;
  acts: Act[];
  startScene: SceneId;
  openingCinematic?: CinematicId;
}

export interface JournalTask {
  id: string;
  text: string;
  done: boolean;
}

export interface SaveData {
  version: number;
  savedAt: number;
  act: number;
  scene: SceneId;
  previousScene: SceneId | null;
  items: ItemId[];
  clues: ClueId[];
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  solvedPuzzles: PuzzleId[];
  visitedScenes: SceneId[];
  usedDialogueNodes: string[];
  unlockedScenes: SceneId[];
  tasks: JournalTask[];
  puzzleState: Record<string, Record<string, unknown>>;
  /** Seconds of wall-clock play, for the results screen. */
  playtime: number;
  /** Deduction board accusations the player has pinned. */
  accusations: Record<string, string[]>;
}
